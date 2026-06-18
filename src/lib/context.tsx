import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, db, getUserPath, getUserDocPath, onAuthStateChanged, collection, onSnapshot, signInWithCustomToken, doc, getDoc, query, where, limit, getDocs, or } from './firebase';
import { Sale, Payment, UserProfile } from '../types';

interface AppContextType {
  userAuth: User | null;
  userProfile: UserProfile | null;
  sales: Sale[];
  payments: Payment[];
  isDbLoading: boolean;
  setAuthError: (err: string | null) => void;
  authError: string | null;
  databaseUid: string;
  teamMembers: UserProfile[];
  refreshTeam: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userAuth, setUserAuth] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [databaseUid, setDatabaseUid] = useState<string>('');

  const fetchTeamData = async (profile: UserProfile, dbUid: string, uAuthUid: string) => {
    try {
      let apiUrl = `/api/users/team?`;
      if (profile.role === 'admin') {
         apiUrl += `adminUid=${uAuthUid}&companyId=${encodeURIComponent(profile.companyId || '')}`;
      } else {
         apiUrl += `adminUid=${dbUid}&companyId=${encodeURIComponent(profile.companyId || '')}`;
      }
      const res = await fetch(apiUrl);
      if (res.ok) {
         const data = await res.json();
         setTeamMembers(data);
      }
    } catch (e) {
      console.error("Team fetch error", e);
    }
  };

  const refreshTeam = () => {
     if (userProfile && userAuth) {
        fetchTeamData(userProfile, databaseUid, userAuth.uid);
     }
  };

  useEffect(() => {
    const initCanvasAuth = async () => {
      const token = (window as any).__initial_auth_token;
      if (token) {
        try { await signInWithCustomToken(auth, token); } catch (err) {}
      }
    };
    initCanvasAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUserAuth(currentUser);
      if (!currentUser) {
        setSales([]);
        setPayments([]);
        setUserProfile(null);
        setIsDbLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userAuth) return;
    setIsDbLoading(true);
    setAuthError(null);

    const fetchProfileAndData = async () => {
      try {
        const profileRef = doc(db, getUserDocPath(userAuth.uid));
        const profileSnap = await getDoc(profileRef);
        
        let profile: UserProfile;
        if (profileSnap.exists()) {
          profile = profileSnap.data() as UserProfile;
        } else {
          // Retro-compatibility: if no profile exists, assume legacy DJCAR admin
          profile = {
            uid: userAuth.uid,
            email: userAuth.email || '',
            companyId: 'Toutes', 
            role: 'admin',
            name: userAuth.email?.split('@')[0] || 'Utilisateur'
          };
        }
        setUserProfile(profile);

        let finalDatabaseUid = userAuth.uid;
        if (profile.role === 'commercial') {
          if (profile.adminUid) {
            finalDatabaseUid = profile.adminUid;
          } else if (profile.companyId) {
            try {
              const adminQ = query(collection(db, 'users'), where('companyId', '==', profile.companyId), where('role', '==', 'admin'), limit(1));
              const adminSnap = await getDocs(adminQ);
              if (!adminSnap.empty) {
                finalDatabaseUid = adminSnap.docs[0].id;
              }
            } catch (e) {
              console.error("Error finding admin:", e);
            }
          }
        }
        setDatabaseUid(finalDatabaseUid);

        // Fetch standard data:
        const pathSales = getUserPath('sales', finalDatabaseUid);
        const pathPayments = getUserPath('payments', finalDatabaseUid);

        // Fetch team members globally using server API
        fetchTeamData(profile, finalDatabaseUid, userAuth.uid);

        const unsubSales = onSnapshot(collection(db, pathSales), (snapshot) => {
          setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
          setIsDbLoading(false);
        }, (error) => {
          setAuthError("Permissions ou connexion refusée.");
          setIsDbLoading(false);
        });

        const unsubPayments = onSnapshot(collection(db, pathPayments), (snapshot) => {
          setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        });

        return () => { unsubSales(); unsubPayments(); };
      } catch (err) {
        setAuthError("Erreur de profil initial.");
        setIsDbLoading(false);
      }
    };

    let cleanupFns: any = null;
    fetchProfileAndData().then(cleanup => { cleanupFns = cleanup; });

    return () => { if (cleanupFns) cleanupFns(); };
  }, [userAuth]);

  return (
    <AppContext.Provider value={{ userAuth, userProfile, sales, payments, isDbLoading, authError, setAuthError, databaseUid, teamMembers, refreshTeam }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
