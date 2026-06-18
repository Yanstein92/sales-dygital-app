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
      console.log("Firebase Admin Initialized Successfully");
    } else {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is missing. Setup Firebase Admin SDK in standard settings if needed.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }

  // --- API Routes ---
  
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
      const data = req.body;
      await getFirestore().collection('users').doc(uid).update(data);
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
        role: "commercial",
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
