import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // --- Firebase Admin Initialization ---
  // You need to set the FIREBASE_SERVICE_ACCOUNT variable with you service account JSON string
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("Firebase Admin Initialized Successfully with service account");
    } else {
      // Try to initialize using ADC (Application Default Credentials)
      initializeApp();
      console.log("Firebase Admin Initialized Successfully using Application Default Credentials");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }

  // --- API Routes ---
  
  app.get("/api/sales", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const snap = await getFirestore().collectionGroup('sales').get();
      const sales: any[] = [];
      snap.forEach(doc => {
        sales.push({ id: doc.id, refPath: doc.ref.path, ...doc.data() });
      });
      res.json(sales);
    } catch (e: any) {
      console.error("Error fetching all sales in admin:", e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/users", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const snap = await getFirestore().collection('users').get();
      const users: any[] = [];
      snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/users/team", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const { companyId, adminUid } = req.query;
      const snap = await getFirestore().collection('users').get();
      const users: any[] = [];
      snap.forEach(doc => {
         const data = doc.data();
         if ((adminUid && data.adminUid === adminUid) || (companyId && data.companyId === companyId) || (adminUid && doc.id === adminUid)) {
            users.push({ uid: doc.id, ...data });
         }
      });
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update a user via Firebase Admin
  app.put("/api/users/:uid", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const { uid } = req.params;
      const { password, ...firestoreData } = req.body;

      if (password) {
        await getAuth().updateUser(uid, { password });
      }

      if (Object.keys(firestoreData).length > 0) {
        await getFirestore().collection('users').doc(uid).update(firestoreData);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new commercial user via Firebase Admin
  app.post("/api/users", async (req, res) => {
    try {
      if (!getApps().length) {
        return res.status(500).json({ error: "Firebase Admin n'est pas configuré sur le serveur." });
      }

      const { email, password, name, adminUid, companyId, testMode } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Veuillez fournir tous les champs requis." });
      }

      // Create the user in Firebase Auth
      const userRecord = await getAuth().createUser({
        email: email,
        password: password,
        displayName: name,
      });

      // Add the user to the Firestore users collection
      await getFirestore().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: email,
        name: name,
        companyId: companyId || '',
        adminUid: adminUid || '',
        role: req.body.role || "commercial",
        testMode: testMode || false,
      });

      res.status(201).json({ success: true, uid: userRecord.uid, message: "Utilisateur créé avec succès" });

    } catch (error: any) {
      console.error("Error creating user:", error);
      // Map Firebase Admin error codes for frontend handling
      if (error.code === 'auth/email-already-exists') {
        res.status(409).json({ error: "Cet email est déjà utilisé." });
      } else {
         res.status(500).json({ error: error.message || "Erreur interne" });
      }
    }
  });

  // Delete a user via Firebase Admin
  app.delete("/api/users/:uid", async (req, res) => {
    try {
      if (!getApps().length) {
        return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      }

      const { uid } = req.params;
      
      // Delete user from Firebase Auth
      await getAuth().deleteUser(uid);

      // Delete user from Firestore users collection
      await getFirestore().collection('users').doc(uid).delete();

      res.status(200).json({ success: true, message: "Utilisateur supprimé avec succès" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message || "Erreur interne lors de la suppression" });
    }
  });

  // Public booking fetch
  app.get("/api/booking/:saleId", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const { saleId } = req.params;
      
      const salesQuery = await getFirestore().collectionGroup('sales').get();
      let foundDoc: any = null;
      salesQuery.forEach(doc => {
        if (doc.id === saleId) {
          foundDoc = { id: doc.id, path: doc.ref.path, ...doc.data() };
        }
      });

      if (!foundDoc) {
        return res.status(404).json({ error: "Dossier de commande introuvable." });
      }

      const pathParts = foundDoc.path.split('/');
      const usersIndex = pathParts.indexOf('users');
      const ownerId = usersIndex !== -1 ? pathParts[usersIndex + 1] : null;

      if (!ownerId) {
        return res.status(400).json({ error: "Propriétaire du dossier introuvable." });
      }

      const configDoc = await getFirestore().collection('users').doc(ownerId).collection('settings').doc('delivery_config').get();
      const config = configDoc.exists ? configDoc.data() : {
        slots: ["09:00 - 10:30", "10:30 - 12:00", "14:00 - 15:30", "15:30 - 17:00"],
        workingDays: [1, 2, 3, 4, 5],
        dischargeText: "Je soussigné, [Client], certifie avoir pris livraison du véhicule [Marque] [Modèle] immatriculé [Plaque] (N° VIN : [VIN]) en parfait état et muni de tous ses documents administratifs."
      };

      const bookedSalesSnap = await getFirestore().collection('users').doc(ownerId).collection('sales').get();
      const bookings: any[] = [];
      bookedSalesSnap.forEach(doc => {
        const data = doc.data();
        if (data.deliveryDate && data.deliveryStatus === 'programmee') {
          bookings.push({
            date: data.deliveryDate,
            slot: data.deliverySlot
          });
        }
      });

      res.json({
        sale: {
          id: foundDoc.id,
          clientName: foundDoc.clientName,
          marque: foundDoc.marque,
          modele: foundDoc.modele,
          plaque: foundDoc.plaque,
          vin: foundDoc.vin,
          company: foundDoc.company,
          deliveryDate: foundDoc.deliveryDate,
          deliverySlot: foundDoc.deliverySlot,
          deliveryStatus: foundDoc.deliveryStatus
        },
        config,
        bookings
      });

    } catch (e: any) {
      console.error("Booking fetch error", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Public booking submit
  app.post("/api/booking/:saleId", async (req, res) => {
    try {
      if (!getApps().length) return res.status(500).json({ error: "Firebase Admin n'est pas configuré." });
      const { saleId } = req.params;
      const { date, slot } = req.body;

      if (!date || !slot) {
        return res.status(400).json({ error: "Date et créneau requis." });
      }

      const salesQuery = await getFirestore().collectionGroup('sales').get();
      let foundDoc: any = null;
      salesQuery.forEach(doc => {
        if (doc.id === saleId) {
          foundDoc = { id: doc.id, path: doc.ref.path, ...doc.data() };
        }
      });

      if (!foundDoc) {
        return res.status(404).json({ error: "Dossier de commande introuvable." });
      }

      const pathParts = foundDoc.path.split('/');
      const usersIndex = pathParts.indexOf('users');
      const ownerId = usersIndex !== -1 ? pathParts[usersIndex + 1] : null;

      if (!ownerId) {
        return res.status(400).json({ error: "Propriétaire du dossier introuvable." });
      }

      // Check config limits and blocked periods
      const configDoc = await getFirestore().collection('users').doc(ownerId).collection('settings').doc('delivery_config').get();
      if (configDoc.exists) {
        const configData = configDoc.data() || {};
        
        // 1. Check Blocked Periods
        const blockedPeriods = configData.blockedPeriods || [];
        const isBlocked = blockedPeriods.some((p: any) => {
          if (!p.from || !p.to) return false;
          return date >= p.from && date <= p.to;
        });
        if (isBlocked) {
          return res.status(400).json({ error: "Cette période est temporairement bloquée pour les livraisons." });
        }

        // 2. Check max deliveries limit
        const maxLimit = configData.maxDeliveriesPerDay;
        if (maxLimit && maxLimit > 0) {
          const bookedSalesSnap = await getFirestore().collection('users').doc(ownerId).collection('sales').get();
          let dayDeliveriesCount = 0;
          bookedSalesSnap.forEach(doc => {
            const data = doc.data();
            // Count active deliveries on this date, excluding this sale itself if it is already programmed on this date
            if (data.deliveryDate === date && data.deliveryStatus === 'programmee' && doc.id !== saleId) {
              dayDeliveriesCount++;
            }
          });

          if (dayDeliveriesCount >= maxLimit) {
            return res.status(400).json({ error: "La limite maximale de livraisons pour cette date a été atteinte. Veuillez choisir une autre date." });
          }
        }
      }

      const docRef = getFirestore().doc(foundDoc.path);

      const logEntry = {
        user: "Client (Lien de réservation)",
        action: `Créneau de livraison réservé pour le ${date} à ${slot}`,
        timestamp: new Date().toISOString()
      };

      const existingLog = foundDoc.deliveryLog || [];

      await docRef.update({
        deliveryDate: date,
        deliverySlot: slot,
        deliveryStatus: 'programmee',
        deliveryLog: [...existingLog, logEntry]
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error("Booking submit error", e);
      res.status(500).json({ error: e.message });
    }
  });


  // --- Vite Middleware for Development ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Fallback for single page applications
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failed to start server", e);
  process.exit(1);
});
