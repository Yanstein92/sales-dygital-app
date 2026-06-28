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
