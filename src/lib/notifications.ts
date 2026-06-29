import { db, doc, setDoc, getUserPath, getUserDocPath, getDoc } from './firebase';
import { Sale, UserProfile } from '../types';

export const notifyFolderAction = async (
  sale: Sale,
  type: 'bdc' | 'release' | 'refund' | 'payment' | 'modification',
  title: string,
  description: string,
  teamMembers: UserProfile[],
  databaseUid: string
) => {
  if (!databaseUid) return;

  const recipientUids = new Set<string>();

  // 1. Notify all admins in the company
  teamMembers.forEach(member => {
    if (member.role === 'admin' && member.uid) {
      recipientUids.add(member.uid);
    }
  });

  // Always notify the database owner
  recipientUids.add(databaseUid);

  // 2. Notify the commercial assigned to the sale
  if (sale.commercial) {
    const assignedComm = teamMembers.find(member => 
      member.name?.toLowerCase().trim() === sale.commercial?.toLowerCase().trim() && member.role === 'commercial'
    );
    if (assignedComm?.uid) {
      recipientUids.add(assignedComm.uid);
    }
  }

  // Loop through and send
  for (const uid of recipientUids) {
    try {
      // Fetch recipient's user document to check preferences
      const userRef = doc(db, getUserDocPath(uid));
      const userSnap = await getDoc(userRef);
      
      let settings = { bdc: true, release: true, refund: true, payment: true, modification: true };
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.notificationSettings) {
          settings = { ...settings, ...userData.notificationSettings };
        }
      }

      // Check if this notification type is enabled
      const isEnabled = settings[type] ?? true;
      if (!isEnabled) continue;

      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notifRef = doc(db, getUserPath('notifications', uid), notifId);

      await setDoc(notifRef, {
        id: notifId,
        title,
        description,
        type,
        targetHash: `detail/${sale.id}`,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`Error sending notification to user ${uid}:`, e);
    }
  }
};

export const checkAndSendDeliveryReminders = async (
  sales: Sale[],
  teamMembers: UserProfile[],
  databaseUid: string
) => {
  if (!databaseUid || !sales || sales.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate date strings for 1, 2, and 3 days from now
  const addDays = (days: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const date1Day = addDays(1); // "YYYY-MM-DD" for tomorrow (24h)
  const date2Days = addDays(2); // "YYYY-MM-DD" for in 2 days (48h)
  const date3Days = addDays(3); // "YYYY-MM-DD" for in 3 days (72h)

  // Recipient uids to evaluate
  const recipientUids = new Set<string>();

  // 1. All admins and park managers
  teamMembers.forEach(member => {
    if ((member.role === 'admin' || member.role === 'park_manager') && member.uid) {
      recipientUids.add(member.uid);
    }
  });

  // Database owner is admin/superadmin
  recipientUids.add(databaseUid);

  // Evaluate notifications for each user based on their specific settings
  for (const uid of recipientUids) {
    try {
      const userRef = doc(db, getUserDocPath(uid));
      const userSnap = await getDoc(userRef);
      
      let settings = { bdc: true, release: true, refund: true, payment: true, modification: true, deliveryReminder: true, deliveryReminderHours: 24 };
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.notificationSettings) {
          settings = { ...settings, ...userData.notificationSettings };
        }
      }

      // If reminders are disabled, skip
      if (!(settings.deliveryReminder ?? true)) continue;

      const hours = settings.deliveryReminderHours ?? 24;
      let targetDateStr = date1Day;
      let timeLabel = "demain";

      if (hours === 48) {
        targetDateStr = date2Days;
        timeLabel = "dans 48h";
      } else if (hours === 72) {
        targetDateStr = date3Days;
        timeLabel = "dans 72h";
      }

      // Find any sales matching this target date and deliveryStatus === 'programmee'
      const salesNeedReminder = sales.filter(s => s.deliveryDate === targetDateStr && s.deliveryStatus === 'programmee');

      // Also check if this user is a commercial assigned to the sale, or if they are admin/park manager
      for (const sale of salesNeedReminder) {
        // If user is a commercial, only remind if they are the commercial assigned to this sale
        const isUserAssignedComm = teamMembers.some(member => 
          member.uid === uid && member.role === 'commercial' && 
          member.name?.toLowerCase().trim() === sale.commercial?.toLowerCase().trim()
        );

        const isUserAdminOrParkManager = teamMembers.some(member => 
          member.uid === uid && (member.role === 'admin' || member.role === 'park_manager')
        ) || uid === databaseUid;

        if (!isUserAssignedComm && !isUserAdminOrParkManager) {
          // If the commercial is not assigned, they don't get the reminder
          continue;
        }

        // Predictable reminder notification ID
        const notifId = `notif-reminder-${sale.id}-${hours}`;
        const notifRef = doc(db, getUserPath('notifications', uid), notifId);

        // Check if reminder already exists to avoid overwriting/resetting read status
        const notifSnap = await getDoc(notifRef);
        if (notifSnap.exists()) {
          continue;
        }

        const title = `⚠️ Livraison ${timeLabel} : ${sale.clientName}`;
        const description = `Rappel : La livraison du véhicule ${sale.marque} ${sale.modele} (Plaque: ${sale.plaque || '-'}) est planifiée pour le ${sale.deliveryDate} à ${sale.deliverySlot || 'l\'heure convenue'}.`;

        await setDoc(notifRef, {
          id: notifId,
          title,
          description,
          type: 'release',
          targetHash: `detail/${sale.id}`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`Error checking/sending delivery reminders for user ${uid}:`, err);
    }
  }
};
