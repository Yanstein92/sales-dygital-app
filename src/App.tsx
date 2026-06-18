import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, LogOut, Users } from 'lucide-react';
import { AppProvider, useApp } from './lib/context';
import { auth, signOut } from './lib/firebase';
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
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF.js non chargé");
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
  const { userAuth, userProfile, isDbLoading, sales } = useApp();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [draftExtraction, setDraftExtraction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminPath, setIsAdminPath] = useState(window.location.pathname === '/salesadmin');

  useEffect(() => {
    //
    if (!document.getElementById('pdfjs-script')) {
      const script = document.createElement('script');
      script.id = 'pdfjs-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => { if ((window as any).pdfjsLib) (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; };
      document.body.appendChild(script);
    }

    const handleLocationChange = () => setIsAdminPath(window.location.pathname === '/salesadmin');
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 4000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), duration);
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
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-12 relative">
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

      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CustomLogo className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-black tracking-tight">Sales - Dygital <span className="text-blue-400 font-medium text-lg ml-2 hidden md:inline">Espace Entreprise</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {userProfile && (
               <div className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 hidden sm:flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
                 {userProfile.name} ({userProfile.companyId})
               </div>
            )}
            {userProfile?.role === 'admin' && (
              <button onClick={() => setShowTeam(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-all shadow-md">
                <Users size={16} /> <span className="hidden sm:inline">Équipe</span>
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-red-600 border border-slate-700 hover:border-red-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-all shadow-sm">
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
