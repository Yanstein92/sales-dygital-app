import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, LogOut, Users, Edit2, Check } from 'lucide-react';
import { AppProvider, useApp } from './lib/context';
import { auth, signOut, db, doc, setDoc, getUserDocPath } from './lib/firebase';
import { CustomLogo } from './components/CustomLogo';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SaleDetail } from './components/SaleDetail';
import { PdfValidation } from './components/PdfValidation';
import { TeamManagement } from './components/TeamManagement';
import { SuperAdmin } from './components/SuperAdmin';
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

    let clientMatch = (fullText.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-Ÿa-zÀ-ÿ\s-]+?)(?=\s+\d+|\s+Adresse|\s+T[ée]l|\s+Email|\s+Courriel|\s+BON|\s+Le|$)/i) || [])[1] || '';
    let nameParts = clientMatch.trim().split(/\s+/);
    if (nameParts.length > 4) nameParts = nameParts.slice(0, 4); 
    let clientName = [...new Set(nameParts)].join(' ').replace(/[-_]$/, '').trim();

    const marque = (fullText.match(/Marque[\s",:]+(?:Marque[\s",:]+)?([A-Z]+)/i) || [])[1]?.trim() || '';
    const modele = (fullText.match(/Modèle[\s",:]+(?:Modèle[\s",:]+)?([A-Z\s0-9.-]+?)(?=\s*Version|\s*M\.E\.C|\s*Km|\s*Couleur|")/i) || [])[1]?.trim() || '';
    const color = (fullText.match(/Couleur[\s",:]+(?:Couleur[\s",:]+)?([A-Z\s]+?)(?=\s*Puiss|\s*1ère|\s*Immat|")/i) || [])[1]?.trim() || '';
    const plaque = (fullText.match(/Immat\.?[\s",:]+(?:Immat\.?[\s",:]+)?([A-Z0-9-]{7,9})/i) || [])[1] || '';
    const vin = (fullText.match(/VIN[\s",:]+(?:VIN[\s",:]+)?([A-Z0-9]{17})/i) || [])[1] || '';

    let price = 0;
    const htExactMatch = fullText.match(/Total HT du v[ée]hicule\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})/i);
    if (htExactMatch) price = parseFloat(htExactMatch[1].replace(/[\s\u00A0]/g, '').replace(',', '.'));

    const extractedAcomptes = [...fullText.matchAll(/ACOMPTE N[°º]?\s*\d+(.*?)(?=ACOMPTE N[°º]?\s*\d+|Reste à payer|Solde|Total|$)/gi)].map((block, index) => {
      const amount = parseFloat((block[1].match(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/) || [])[1]?.replace(/[\s\u00A0]/g, '').replace(',', '.') || '0');
      let type = 'VIR';
      const tUp = block[1].toUpperCase();
      if (tUp.includes('ESPÈCE') || tUp.includes('ESP')) type = 'ESP';
      if (tUp.includes('CHÈQUE') || tUp.includes('CHQ')) type = 'CHQ';
      let bank = block[1].replace(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/g, '').replace(/Virement|Espèces?|Chèque|Banque\s*:?/ig, '').replace(/[-_:,"]/g, ' ').trim().replace(/\s{2,}/g, ' ');
      return { id: `draft-pay-${index}`, amount, type, payer: bank ? `${clientName} (${bank.substring(0,20)})` : clientName, selected: true };
    }).filter(p => p.amount > 0); 

    const existingSale = sales.find(s => s.company === company && String(s.bdcNumber) === finalBdc && finalBdc !== '');

    setDraftExtraction({
      isManual: false, 
      id: null, 
      bdcNumber: finalBdc, 
      company, 
      clientName, 
      marque, modele, color, vin, plaque, 
      price: price ? price.toString() : (existingSale ? existingSale.price.toString() : ''), 
      date: dateFormatted, 
      commercial: existingSale ? (existingSale.commercial || 'À assigner') : 'À assigner', 
      phone: existingSale ? (existingSale.phone || '') : '', 
      email: existingSale ? (existingSale.email || '') : '', 
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
  const { userAuth, userProfile, isDbLoading, sales, teamMembers } = useApp();
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
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-6 relative flex flex-col">
      {toast.show && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 z-50 text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <CheckCircle2 size={20} />{toast.message}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
            <div className= "bg-purple-100 p-4 rounded-full mb-4"><Loader2 className="animate-spin text-purple-600" size={40} /></div>
            <p className="text-slate-800 font-black text-xl text-center">Traitement en cours...</p>
            <p className="text-slate-500 text-sm mt-2 text-center">Opération sécurisée en cours.</p>
          </div>
        </div>
      )}

      <header className="bg-slate-950 border-b border-slate-800 text-white shadow-2xl sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center space-x-4 sm:space-x-6">
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => setCurrentView('dashboard')}>
               {/* SAAS LOGO PLACEHOLDER */}
               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-blue-900/20 overflow-hidden ring-1 ring-white/10 relative">
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <CustomLogo className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-300" />
                  {/* Replace CustomLogo with <img src="/logo-saas.svg" /> here */}
               </div>
               <div className="flex flex-col">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white/90 leading-tight">Sales <span className="text-blue-400">Dygital</span></h1>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 tracking-wider">Espace de Gestion</span>
               </div>
            </div>
            
            <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
            
            {/* SAAS Client Company Placehoder */}
            <div className="hidden md:flex items-center gap-2 group relative">
                 <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-xs font-black text-slate-400">
                   {userProfile?.companyId?.charAt(0) || 'E'}
                 </div>
                 {isEditingCompany && userProfile?.role === 'admin' ? (
                   <form onSubmit={handleRenameCompany} className="flex items-center gap-1">
                     <input
                       type="text"
                       value={newCompanyName}
                       onChange={(e) => setNewCompanyName(e.target.value)}
                       className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-500 max-w-[150px]"
                       autoFocus
                       onBlur={handleRenameCompany}
                     />
                   </form>
                 ) : (
                   <div 
                     className={`flex items-center gap-2 ${userProfile?.role === 'admin' ? 'cursor-pointer hover:text-white transition-colors py-1' : ''}`}
                     onClick={() => userProfile?.role === 'admin' && setIsEditingCompany(true)}
                     title={userProfile?.role === 'admin' ? "Renommer l'entreprise" : ""}
                   >
                     <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                       {userProfile?.companyId || 'Entreprise'}
                     </span>
                     {userProfile?.role === 'admin' && (
                       <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                     )}
                   </div>
                 )}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {userProfile && (
               <div className="text-xs font-bold text-slate-300 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800 hidden lg:flex items-center gap-2 shadow-inner">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> 
                 {userProfile.name}
               </div>
            )}
            {userProfile?.role === 'admin' && (
              <button onClick={() => setShowTeam(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-bold transition-all shadow-md border border-slate-700 focus:ring-2 ring-slate-500/50">
                <Users size={16} className="text-blue-400" /> <span className="hidden sm:inline">Équipe</span>
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-900 text-slate-400 hover:text-red-400 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm focus:ring-2 ring-red-900">
              <LogOut size={16} /> <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {showTeam && <TeamManagement onClose={() => setShowTeam(false)} onShowToast={showToast} />}
      {showSuperAdmin && <SuperAdmin onClose={() => setShowSuperAdmin(false)} onShowToast={showToast} />}

      <main className="max-w-6xl mx-auto pt-8 px-4">
        {isDbLoading ? (
           <div className="text-center py-20"><Loader2 className="animate-spin text-purple-600 mx-auto mb-4" size={48}/> <p className="text-slate-500 font-bold">Chargement de votre espace sécurisé...</p></div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard 
                onSelectSale={(id) => { setSelectedSaleId(id); setCurrentView('detail'); }} 
                onProcessPdf={(f) => processPDFFile(f, sales, setDraftExtraction, setCurrentView, showToast, setIsLoading)}
                onManualEntry={() => {
                  setDraftExtraction({ isManual: true, bdcNumber: '', company: 'KDB AUTO', clientName: '', marque: '', modele: '', color: '', vin: '', plaque: '', price: '', date: new Date().toISOString().split('T')[0], commercial: 'À assigner', phone: '', email: '', ref: '', draftPayments: [] });
                  setCurrentView('pdf_validation');
                }}
              />
            )}
            {currentView === 'detail' && selectedSaleId && (
              <SaleDetail 
                saleId={selectedSaleId} 
                onBack={() => setCurrentView('dashboard')} 
                onEditSale={(sale) => {
                  setDraftExtraction({ ...sale, isManual: true, draftPayments: [] });
                  setCurrentView('pdf_validation');
                }}
                onShowToast={showToast}
              />
            )}
            {currentView === 'pdf_validation' && draftExtraction && (
              <PdfValidation 
                draftExtraction={draftExtraction}
                onCancel={() => {
                  setDraftExtraction(null);
                  setCurrentView(draftExtraction.id ? 'detail' : 'dashboard');
                }}
                onShowToast={showToast}
                onSuccess={(saleId) => {
                  setDraftExtraction(null);
                  setSelectedSaleId(saleId);
                  setCurrentView('detail');
                }}
              />
            )}
          </>
        )}
      </main>

      <footer className="max-w-6xl w-full mx-auto mt-auto py-6 px-4 text-center border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
          <div>
            Sales Dygital © {new Date().getFullYear()}
          </div>
          <a 
            href="https://stats.uptimerobot.com/EjAcm5FoSR" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-800 transition-colors flex items-center gap-1.5"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Statut du Système (UptimeRobot)
          </a>
        </div>
      </footer>

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
