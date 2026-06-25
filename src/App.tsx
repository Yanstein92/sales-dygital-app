import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, LogOut, Users, Edit2, Check, KeyRound, LayoutDashboard, Car, ShieldCheck, Activity, Menu, X, Trash2, TrendingUp } from 'lucide-react';
import { AppProvider, useApp } from './lib/context';
import { auth, signOut, db, doc, setDoc, getUserDocPath } from './lib/firebase';
import { CustomLogo } from './components/CustomLogo';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SaleDetail } from './components/SaleDetail';
import { PdfValidation } from './components/PdfValidation';
import { TeamManagement } from './components/TeamManagement';
import { SuperAdmin } from './components/SuperAdmin';
import { CompanyManagement } from './components/CompanyManagement';
import { AdminPerformanceDashboard } from './components/AdminPerformanceDashboard';
import { Sale } from './types';
// PDF parsing logic pulled into helper to keep App clean
const processPDFFile = async (
  file: File, 
  sales: Sale[], 
  setDraftExtraction: (data: any) => void, 
  setCurrentView: (view: string) => void,
  showToast: (msg: string, type?: 'success'|'error') => void,
  setIsLoading: (val: boolean) => void
) => {
  setIsLoading(true);
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
    }

    const company = fullText.includes('DJ CAR') ? 'DJ CAR' : 'KDB AUTO';
    const extractedBdc = (fullText.match(/BON DE COMMANDE N°\s*(\d+)/i) || [])[1] || '';
    const finalBdc = extractedBdc || file.name.match(/\d{3,5}/)?.[0] || '';

    const dateMatch = fullText.match(/Le\s*(\d{2}\/\d{2}\/\d{4})/i);
    let dateFormatted = new Date().toISOString().split('T')[0];
    if (dateMatch) { const parts = dateMatch[1].split('/'); dateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`; }

    // Enhanced Client Name Extraction (including fallbacks)
    let clientMatch = (fullText.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-Ÿa-zÀ-ÿ\s-]+?)(?=\s+\d+|\s+Adresse|\s+T[ée]l|\s+Email|\s+Courriel|\s+BON|\s+Le|$)/i) || [])[1] || '';
    if (!clientMatch) {
      const altClientMatch = fullText.match(/(?:Client|Acheteur|Nom de l'acheteur|Nom)\s*[:\s]+([A-ZÀ-Ÿa-zÀ-ÿ\s-]+?)(?=\s+\d+|\s+Adresse|\s+T[ée]l|\s+Email|\s+Courriel|\s+BON|\s+Le|$)/i);
      if (altClientMatch) {
        clientMatch = altClientMatch[1];
      }
    }
    let nameParts = clientMatch.trim().split(/\s+/);
    if (nameParts.length > 4) nameParts = nameParts.slice(0, 4); 
    let clientName = [...new Set(nameParts)].join(' ').replace(/[-_]$/, '').trim() || 'Client inconnu';

    // Direct Extraction of Email & Phone
    const emailMatch = fullText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch ? emailMatch[1].trim() : '';

    const phoneRegex = /(?:tél|téléphone|port|portable|gsm|tel)\s*[:\s.-]*(\+?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i;
    const phoneRegexAlt = /(?:\D|^)(0[1-9](?:[\s.-]?\d{2}){4})(?:\D|$)/;
    const phoneMatch = fullText.match(phoneRegex) || fullText.match(phoneRegexAlt);
    const phone = phoneMatch ? phoneMatch[1].replace(/[^0-9+]/g, '').trim() : '';

    const marque = (fullText.match(/Marque[\s",:]+(?:Marque[\s",:]+)?([A-Z]+)/i) || [])[1]?.trim() || '';
    const modele = (fullText.match(/Modèle[\s",:]+(?:Modèle[\s",:]+)?([A-Z\s0-9.-]+?)(?=\s*Version|\s*M\.E\.C|\s*Km|\s*Couleur|")/i) || [])[1]?.trim() || '';
    const color = (fullText.match(/Couleur[\s",:]+(?:Couleur[\s",:]+)?([A-Z\s]+?)(?=\s*Puiss|\s*1ère|\s*Immat|")/i) || [])[1]?.trim() || '';
    const plaque = (fullText.match(/Immat\.?[\s",:]+(?:Immat\.?[\s",:]+)?([A-Z0-9-]{7,9})/i) || [])[1] || '';
    const vin = (fullText.match(/VIN[\s",:]+(?:VIN[\s",:]+)?([A-Z0-9]{17})/i) || [])[1] || '';
    const mec = (fullText.match(/M\.E\.C\.?\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || '';

    // Robust Vehicle Price Extraction with Cascading Fallbacks
    let price = 0;
    const htExactMatch = fullText.match(/Total HT du v[ée]hicule\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i);
    const fallbackPriceMatch = 
      fullText.match(/Prix de vente\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Prix TTC\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Total TTC\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Net [aà] payer\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Prix du v[ée]hicule\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Montant total\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i);

    const priceString = htExactMatch ? htExactMatch[1] : (fallbackPriceMatch ? fallbackPriceMatch[1] : '');
    if (priceString) {
      price = parseFloat(priceString.replace(/[\s\u00A0]/g, '').replace(',', '.'));
    }

    // Payment Extraction
    let extractedAcomptes = [...fullText.matchAll(/ACOMPTE N[°º]?\s*\d+(.*?)(?=ACOMPTE N[°º]?\s*\d+|Reste à payer|Solde|Total|$)/gi)].map((block, index) => {
      const amount = parseFloat((block[1].match(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/) || [])[1]?.replace(/[\s\u00A0]/g, '').replace(',', '.') || '0');
      let type = 'VIR';
      const tUp = block[1].toUpperCase();
      if (tUp.includes('ESPÈCE') || tUp.includes('ESP')) type = 'ESP';
      if (tUp.includes('CHÈQUE') || tUp.includes('CHQ')) type = 'CHQ';
      let bank = block[1].replace(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/g, '').replace(/Virement|Espèces?|Chèque|Banque\s*:?/ig, '').replace(/[-_:,"]/g, ' ').trim().replace(/\s{2,}/g, ' ');
      return { id: `draft-pay-${index}`, amount, type, payer: bank ? `${clientName} (${bank.substring(0,20)})` : clientName, selected: true };
    }).filter(p => p.amount > 0); 

    if (extractedAcomptes.length === 0) {
      const singleAcompteMatch = fullText.match(/(?:Acompte|Règlement|Paiement)\s*[:\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)\s*€/i);
      if (singleAcompteMatch) {
        const amt = parseFloat(singleAcompteMatch[1].replace(/[\s\u00A0]/g, '').replace(',', '.'));
        if (amt > 0) {
          extractedAcomptes.push({
            id: `draft-pay-0`,
            amount: amt,
            type: fullText.toUpperCase().includes('CHQ') || fullText.toUpperCase().includes('CHÈQUE') ? 'CHQ' : fullText.toUpperCase().includes('ESP') || fullText.toUpperCase().includes('ESPÈCE') ? 'ESP' : 'VIR',
            payer: clientName,
            selected: true
          });
        }
      }
    }

    const existingSale = sales.find(s => s.company === company && String(s.bdcNumber) === finalBdc && finalBdc !== '');

    setDraftExtraction({
      isManual: false, 
      id: null, 
      bdcNumber: finalBdc, 
      company, 
      clientName, 
      marque, modele, color, vin, plaque, mec,
      price: price ? price.toString() : (existingSale ? existingSale.price.toString() : ''), 
      date: dateFormatted, 
      commercial: existingSale ? (existingSale.commercial || 'À assigner') : 'À assigner', 
      phone: phone || (existingSale ? (existingSale.phone || '') : ''), 
      email: email || (existingSale ? (existingSale.email || '') : ''), 
      ref: existingSale ? (existingSale.ref || '') : '', 
      draftPayments: extractedAcomptes
    });
    setCurrentView('pdf_validation');
  } catch (error) { 
    showToast("Erreur d'analyse PDF. Vérifiez le format.", "error"); 
  } finally { 
    setIsLoading(false); 
  }
};

const MainAppContent: React.FC = () => {
  const { userAuth, userProfile, isDbLoading, sales, teamMembers, payments } = useApp();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [draftExtraction, setDraftExtraction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminPath, setIsAdminPath] = useState(window.location.pathname === '/salesadmin');

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showManageCompanies, setShowManageCompanies] = useState(false);

  useEffect(() => {
    if (userProfile?.companyId) {
      setNewCompanyName(userProfile.companyId);
    }
  }, [userProfile?.companyId]);

  useEffect(() => {
    const handleLocationChange = () => setIsAdminPath(window.location.pathname === '/salesadmin');
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Synchronise state with window.location.hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#detail/')) {
        const id = hash.replace('#detail/', '');
        setSelectedSaleId(id);
        setCurrentView('detail');
      } else if (hash === '#pdf_validation') {
        setCurrentView('pdf_validation');
      } else if (hash === '#perf_dashboard') {
        if (userProfile?.role === 'admin') {
          setCurrentView('perf_dashboard');
        } else {
          window.location.hash = 'dashboard';
        }
      } else {
        setSelectedSaleId(null);
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Initial sync
    if (window.location.hash) {
      handleHashChange();
    } else if (userProfile) {
      window.location.hash = userProfile.role === 'admin' ? 'perf_dashboard' : 'dashboard';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [userProfile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 4000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), duration);
  };

  const handleRenameCompany = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCompanyName.trim() || newCompanyName.trim() === userProfile?.companyId) {
      setIsEditingCompany(false);
      return;
    }
    try {
      setIsLoading(true);
      const newName = newCompanyName.trim();
      const promises = teamMembers.flatMap(member => [
        fetch(`/api/users/${member.uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: newName })
        }),
        setDoc(doc(db, getUserDocPath(member.uid)), { companyId: newName }, { merge: true })
      ]);
      // Ensure current user is updated in the API
      if (userAuth?.uid) {
        promises.push(
          fetch(`/api/users/${userAuth.uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: newName })
          })
        );
        // Also update local canvas document directly so frontend reads it properly on load
        const updatedProfile = { 
          ...userProfile, 
          companyId: newName,
          uid: userAuth.uid,
          email: userAuth.email || '',
          name: userProfile?.name || userAuth.email?.split('@')[0] || 'Utilisateur',
          role: userProfile?.role || 'admin'
        };
        promises.push(
          setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true })
        );
      }
      
      await Promise.all(promises);
      showToast("Nom de l'entreprise mis à jour", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast("Erreur lors de la mise à jour", "error");
    } finally {
      setIsLoading(false);
      setIsEditingCompany(false);
    }
  };

  // ----- Admin Route Handler -----
  if (isAdminPath) {
    if (!showSuperAdmin) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-xl w-full max-w-sm text-center shadow-xl">
            <h2 className="text-white text-xl font-bold mb-6">Accès Super Admin</h2>
            <input 
              type="password" 
              placeholder="Mot de passe"
              className="w-full bg-slate-700 text-white border-0 rounded-lg py-2 px-3 mb-4 focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (adminPassword === 'SalesDygital#321321') {
                    setShowSuperAdmin(true);
                  } else {
                    alert('Mot de passe incorrect');
                  }
                }
              }}
            />
            <button 
              onClick={() => {
                if (adminPassword === 'SalesDygital#321321') {
                  setShowSuperAdmin(true);
                } else {
                  alert('Mot de passe incorrect');
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-md"
            >
              Valider
            </button>
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/');
                setIsAdminPath(false);
              }}
              className="mt-4 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }
    
    return <SuperAdmin onClose={() => { setShowSuperAdmin(false); window.history.pushState({}, '', '/'); setIsAdminPath(false); }} onShowToast={showToast} />;
  }
  // -------------------------------

  const handleLogout = async () => {
    try { await signOut(auth); } catch (err) {}
  };

  if (!userAuth) {
    return (
      <>
        <Login onShowToast={showToast} />
        {toast.show && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 z-50 text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <CheckCircle2 size={20} />{toast.message}
          </div>
        )}
      </>
    );
  }



  const totalPortfolio = sales.reduce((sum, s) => {
    const salePayments = (payments || []).filter(p => p.saleId === s.id);
    const paidAmount = salePayments.reduce((tot, p) => tot + p.amount, 0);
    const remaining = Math.max(0, s.price - paidAmount);
    return sum + remaining;
  }, 0);

  const handleUserChangeName = async () => {
    if (!userProfile?.uid || !userAuth?.uid) return;
    const newName = window.prompt("Saisir votre nouveau nom d'utilisateur :", userProfile.name);
    if (newName && newName.trim()) {
      try {
        setIsLoading(true);
        const trimmedName = newName.trim();
        const updatedProfile = { 
          ...userProfile, 
          name: trimmedName,
          uid: userAuth.uid,
          email: userAuth.email || '',
          role: userProfile?.role || 'commercial',
          companyId: userProfile?.companyId || 'Entreprise'
        };
        await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
        showToast("Nom d'utilisateur mis à jour avec succès.", "success");
        setTimeout(() => window.location.reload(), 500);
      } catch (e) {
        showToast("Erreur lors de la mise à jour du nom.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUserChangePassword = async () => {
    if (!userProfile?.uid) return;
    const newPass = window.prompt("Saisir votre nouveau mot de passe (Minimum 6 caractères) :");
    if (newPass) {
      if (newPass.length < 6) {
        alert("Le mot de passe doit comporter au moins 6 caractères.");
        return;
      }
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userProfile.uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPass })
        });
        if (response.ok) {
          showToast("Votre mot de passe a été modifié avec succès.", "success");
        } else {
          const err = await response.json();
          showToast(`Erreur : ${err.error || "Mise à jour échouée."}`, "error");
        }
      } catch (e) {
        showToast("Erreur réseau.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative flex overflow-hidden h-screen">
      {toast.show && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 z-50 text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <CheckCircle2 size={20} />{toast.message}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
            <div className="bg-purple-100 p-4 rounded-full mb-4"><Loader2 className="animate-spin text-purple-600" size={40} /></div>
            <p className="text-slate-800 font-black text-xl text-center">Traitement en cours...</p>
            <p className="text-slate-500 text-sm mt-2 text-center">Opération sécurisée en cours.</p>
          </div>
        </div>
      )}

      {/* NEW NARROW SIDEBAR (ERP RAIL LAYOUT) */}
      <aside className="w-16 md:w-20 bg-slate-950 border-r border-slate-900 flex flex-col items-center py-6 justify-between text-white shrink-0 select-none z-30 shadow-2xl">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo brand */}
          <div className="flex items-center justify-center cursor-pointer group" onClick={() => window.location.hash = 'dashboard'}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-blue-900/40 overflow-hidden ring-1 ring-white/10 relative transform group-hover:scale-105 transition-all">
              <CustomLogo className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>

          <div className="h-px w-8 bg-slate-800"></div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-4 w-full px-2">
            <button 
              onClick={() => window.location.hash = 'dashboard'}
              className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 w-full transition-all group relative ${currentView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              title="Tableau de bord"
            >
              <LayoutDashboard size={20} />
              <span className="text-[9px] font-bold tracking-tight block md:hidden lg:block">Ventes</span>
              {/* Tooltip for desktop */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Tableau de bord</div>
            </button>

            {userProfile?.role === 'admin' && (
              <button 
                onClick={() => window.location.hash = 'perf_dashboard'}
                className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 w-full transition-all group relative ${currentView === 'perf_dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                title="Performance"
              >
                <TrendingUp size={20} />
                <span className="text-[9px] font-bold tracking-tight block md:hidden lg:block">Stats</span>
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Performances</div>
              </button>
            )}

            {userProfile?.role === 'admin' && (
              <button 
                onClick={() => setShowTeam(true)}
                className="p-3 rounded-xl flex flex-col items-center justify-center gap-1 w-full text-slate-400 hover:text-white hover:bg-slate-900 transition-all group relative"
                title="Équipe"
              >
                <Users size={20} />
                <span className="text-[9px] font-bold tracking-tight block md:hidden lg:block">Équipe</span>
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Gérer l'équipe</div>
              </button>
            )}

            <a 
              href="https://stats.uptimerobot.com/EjAcm5FoSR" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-3 rounded-xl flex flex-col items-center justify-center gap-1 w-full text-slate-400 hover:text-white hover:bg-slate-900 transition-all group relative text-center"
              title="Statut"
            >
              <Activity size={20} className="text-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold tracking-tight block md:hidden lg:block text-emerald-500">Statut</span>
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">UptimeRobot</div>
            </a>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-4 w-full px-2">
          {/* User profile avatar, clickable to change password */}
          {userProfile && (
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-white transition-all duration-200 flex items-center justify-center font-black text-xs text-slate-300 hover:text-white cursor-pointer"
                title="Mon Compte & Paramètres"
              >
                {userProfile.name.slice(0, 2).toUpperCase()}
              </button>

              {showProfileMenu && (
                <>
                  {/* Backdrop click closer */}
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowProfileMenu(false)} />
                  
                  {/* Popover Card */}
                  <div className="fixed bottom-24 left-4 md:left-6 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 z-50 animate-fade-in text-slate-900 flex flex-col gap-4">
                    {/* Header profile info */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center font-black text-xs text-white">
                        {userProfile.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-slate-800 truncate">{userProfile.name}</span>
                        <span className="text-[10px] text-slate-400 truncate">{userProfile.email}</span>
                        <span className="text-[9px] uppercase bg-slate-100 text-slate-600 self-start px-1.5 py-0.5 rounded font-black mt-1">
                          {userProfile.role}
                        </span>
                      </div>
                    </div>

                    {/* Account actions */}
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Mon Compte</p>
                      
                      <button 
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleUserChangeName();
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left"
                      >
                        <Edit2 size={14} className="text-blue-500" />
                        <span>Modifier mon nom</span>
                      </button>

                      <button 
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleUserChangePassword();
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left"
                      >
                        <KeyRound size={14} className="text-blue-500" />
                        <span>Modifier mon mot de passe</span>
                      </button>
                    </div>

                    {/* Organization settings */}
                    <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Mon Entreprise</p>
                      
                      <div className="flex items-center justify-between px-2.5 py-1 text-slate-700">
                        <span className="text-xs font-bold text-slate-500">Nom actuel :</span>
                        <span className="text-xs font-black text-slate-800">{userProfile.companyId}</span>
                      </div>

                      {userProfile.role === 'admin' && (
                        <>
                          <button 
                            onClick={() => {
                              setShowProfileMenu(false);
                              setIsEditingCompany(true);
                              const newName = window.prompt("Saisir le nouveau nom de l'entreprise :", userProfile.companyId);
                              if (newName && newName.trim() && newName.trim() !== userProfile.companyId) {
                                setNewCompanyName(newName);
                                const triggerRename = async () => {
                                  try {
                                    setIsLoading(true);
                                    const newNameTrimmed = newName.trim();
                                    const promises = teamMembers.flatMap(member => [
                                      fetch(`/api/users/${member.uid}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ companyId: newNameTrimmed })
                                      }),
                                      setDoc(doc(db, getUserDocPath(member.uid)), { companyId: newNameTrimmed }, { merge: true })
                                    ]);
                                    if (userAuth?.uid) {
                                      promises.push(
                                        fetch(`/api/users/${userAuth.uid}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ companyId: newNameTrimmed })
                                        }),
                                        setDoc(doc(db, getUserDocPath(userAuth.uid)), { 
                                          ...userProfile, 
                                          companyId: newNameTrimmed,
                                          uid: userAuth.uid,
                                          email: userAuth.email || '',
                                          name: userProfile?.name || 'Utilisateur',
                                          role: userProfile?.role || 'admin'
                                        }, { merge: true })
                                      );
                                    }
                                    await Promise.all(promises);
                                    showToast("Nom de l'entreprise mis à jour", "success");
                                    setTimeout(() => window.location.reload(), 800);
                                  } catch (err) {
                                    showToast("Erreur lors de la mise à jour", "error");
                                  } finally {
                                    setIsLoading(false);
                                  }
                                };
                                triggerRename();
                              }
                            }}
                            className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left"
                          >
                            <Edit2 size={14} className="text-slate-500" />
                            <span>Renommer l'entreprise</span>
                          </button>

                          <button 
                            onClick={() => {
                              setShowProfileMenu(false);
                              setShowTeam(true);
                            }}
                            className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left"
                          >
                            <Users size={14} className="text-slate-500" />
                            <span>Gérer l'équipe</span>
                          </button>

                          <button 
                            onClick={() => {
                              setShowProfileMenu(false);
                              setShowManageCompanies(true);
                            }}
                            className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left"
                          >
                            <Car size={14} className="text-slate-500" />
                            <span>Gérer mes filiales</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Logout */}
                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="flex items-center justify-center gap-2 w-full mt-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="h-px w-8 bg-slate-800"></div>

          <button 
            onClick={handleLogout} 
            className="p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-950/20 w-full flex flex-col items-center justify-center gap-1 transition-all group relative"
            title="Déconnexion"
          >
            <LogOut size={20} />
            <div className="absolute left-full ml-2 px-2 py-1 bg-red-950 border border-red-900 text-red-200 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Déconnexion</div>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER next to Sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* UPPER MAIN HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
          {/* Left: Breadcrumbs & Company Renamer */}
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <span>Sales Dygital</span>
                <span>/</span>
                <span className="text-slate-600 font-black">
                  {currentView === 'dashboard' ? 'Bons de commande' : currentView === 'detail' ? 'Détails du dossier' : 'Validation' }
                </span>
              </div>
              <div className="flex items-center gap-2 group mt-0.5">
                <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center border border-slate-200 text-[10px] font-black text-slate-600">
                  {userProfile?.companyId?.charAt(0) || 'E'}
                </div>
                {isEditingCompany && userProfile?.role === 'admin' ? (
                  <form onSubmit={handleRenameCompany} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="bg-slate-100 text-slate-800 border border-slate-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-500 font-bold max-w-[150px]"
                      autoFocus
                      onBlur={handleRenameCompany}
                    />
                  </form>
                ) : (
                  <div 
                    className={`flex items-center gap-1.5 ${userProfile?.role === 'admin' ? 'cursor-pointer hover:text-slate-900 transition-colors py-0.5' : ''}`}
                    onClick={() => userProfile?.role === 'admin' && setIsEditingCompany(true)}
                    title={userProfile?.role === 'admin' ? "Renommer l'entreprise" : ""}
                  >
                    <span className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                      {userProfile?.companyId || 'Entreprise'}
                    </span>
                    {userProfile?.role === 'admin' && (
                      <Edit2 size={11} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right actions & KPIs */}
          <div className="flex items-center gap-4">
            {userProfile?.role === 'admin' && (
              <button
                onClick={() => window.location.hash = currentView === 'perf_dashboard' ? 'dashboard' : 'perf_dashboard'}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 border shadow-sm cursor-pointer ${
                  currentView === 'perf_dashboard'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-500'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-indigo-600'
                }`}
              >
                <TrendingUp size={14} />
                <span>{currentView === 'perf_dashboard' ? 'Voir Ventes' : 'Performances'}</span>
              </button>
            )}

            {/* Portefeuille actif KPI (Forte valeur ajoutée artisanale) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 flex flex-col text-right shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Portefeuille actif</span>
              <span className="text-xs font-black text-slate-800">
                {(totalPortfolio).toLocaleString('fr-FR')} €
              </span>
            </div>

            {/* Logged in User Tag */}
            {userProfile && (
              <div className="hidden md:flex items-center gap-2">
                <div className="text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                  {userProfile.name}
                  <span className="text-[9px] uppercase bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-1 font-bold">
                    {userProfile.role}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {showTeam && <TeamManagement onClose={() => setShowTeam(false)} onShowToast={showToast} />}
        {showSuperAdmin && <SuperAdmin onClose={() => setShowSuperAdmin(false)} onShowToast={showToast} />}
        {showManageCompanies && <CompanyManagement onClose={() => setShowManageCompanies(false)} onShowToast={showToast} />}

        {/* FLUID WORKSPACE (No boxed max-width restrictions!) */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {isDbLoading ? (
            <div className="text-center py-24">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48}/> 
              <p className="text-slate-500 font-bold text-lg">Chargement de votre espace sécurisé...</p>
            </div>
          ) : (
            <div className="w-full">
              {currentView === 'dashboard' && (
                <Dashboard 
                  onSelectSale={(id) => window.location.hash = `detail/${id}`} 
                  onProcessPdf={(f) => processPDFFile(f, sales, setDraftExtraction, (view) => window.location.hash = view, showToast, setIsLoading)}
                  onManualEntry={() => {
                    setDraftExtraction({ isManual: true, bdcNumber: '', company: 'KDB AUTO', clientName: '', marque: '', modele: '', color: '', vin: '', plaque: '', mec: '', price: '', date: new Date().toISOString().split('T')[0], commercial: 'À assigner', phone: '', email: '', ref: '', draftPayments: [] });
                    window.location.hash = 'pdf_validation';
                  }}
                />
              )}
              {currentView === 'perf_dashboard' && (
                <AdminPerformanceDashboard />
              )}
              {currentView === 'detail' && selectedSaleId && (
                <SaleDetail 
                  saleId={selectedSaleId} 
                  onBack={() => window.location.hash = 'dashboard'} 
                  onEditSale={(sale) => {
                    setDraftExtraction({ ...sale, isManual: true, draftPayments: [] });
                    window.location.hash = 'pdf_validation';
                  }}
                  onShowToast={showToast}
                />
              )}
              {currentView === 'pdf_validation' && draftExtraction && (
                <PdfValidation 
                  draftExtraction={draftExtraction}
                  onCancel={() => {
                    setDraftExtraction(null);
                    window.location.hash = draftExtraction.id ? `detail/${draftExtraction.id}` : 'dashboard';
                  }}
                  onShowToast={showToast}
                  onSuccess={(saleId) => {
                    setDraftExtraction(null);
                    window.location.hash = `detail/${saleId}`;
                  }}
                />
              )}
            </div>
          )}
        </main>

        {/* BOTTOM GLOBAL FOOTER */}
        <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-6 shrink-0 text-[10px] font-bold text-slate-400">
          <div>
            Sales Dygital © {new Date().getFullYear()}
          </div>
          <a 
            href="https://stats.uptimerobot.com/EjAcm5FoSR" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Statut du Système (UptimeRobot)
          </a>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
