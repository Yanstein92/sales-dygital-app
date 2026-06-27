import React, { useState, useRef } from 'react';
import { 
  User, Building2, Banknote, Search, UploadCloud, Plus, X, 
  ArrowUpDown, ChevronUp, ChevronDown, Clock, CheckCircle2, 
  Car, MessageCircle, Mail, Hash, CreditCard, ChevronRight,
  RotateCcw, Plane, MapPin, Store
} from 'lucide-react';
import { db, doc, setDoc, getDoc, getUserPath, getUserDocPath } from '../lib/firebase';
import { useApp } from '../lib/context';
import { Sale } from '../types';

export const Dashboard: React.FC<{
  onSelectSale: (saleId: string) => void;
  onProcessPdf: (file: File) => void;
  onManualEntry: () => void;
}> = ({ onSelectSale, onProcessPdf, onManualEntry }) => {
  const { sales, payments, userProfile, teamMembers, databaseUid } = useApp();

  
  const [filterCommercial, setFilterCommercial] = useState('Tous');
  const [filterStatus, setFilterStatus] = useState('Tous'); 
  const [filterCompany, setFilterCompany] = useState('Toutes');
  const [filterReleaseStatus, setFilterReleaseStatus] = useState('Tous'); // Release statuses: 'Tous', 'Non sorti', 'Programmé', 'Sorti', 'Sorti TPD'
  const [filterFacture, setFilterFacture] = useState('Tous'); // 'Tous', 'Facturé', 'Non facturé', 'Remboursé'
  const [showFilters, setShowFilters] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [isDragging, setIsDragging] = useState(false);

  const [latePaymentDays, setLatePaymentDays] = useState<number>(5);

  React.useEffect(() => {
    const fetchThreshold = async () => {
      if (!databaseUid) return;
      try {
        const configDocRef = doc(db, getUserDocPath(databaseUid) + '/settings/enterprise_config');
        const snap = await getDoc(configDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.latePaymentDaysThreshold === 'number') {
            setLatePaymentDays(data.latePaymentDaysThreshold);
          }
        }
      } catch (e) {
        console.error("Error reading enterprise config in Dashboard:", e);
      }
    };
    fetchThreshold();
  }, [databaseUid]);

  const defaultCommercial = (userProfile && userProfile.role !== 'admin' && userProfile.name) ? userProfile.name : 'Tous';
  const hasActiveFilters = 
    searchQuery !== '' ||
    filterCommercial !== defaultCommercial ||
    filterStatus !== 'Tous' ||
    filterCompany !== 'Toutes' ||
    filterReleaseStatus !== 'Tous' ||
    filterFacture !== 'Tous';

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCommercial(defaultCommercial);
    setFilterStatus('Tous');
    setFilterCompany('Toutes');
    setFilterReleaseStatus('Tous');
    setFilterFacture('Tous');
  };

  const pdfInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (userProfile && userProfile.role !== 'admin' && userProfile.name) {
      setFilterCommercial(userProfile.name);
    }
  }, [userProfile]);

  const calculateTotalPaid = (saleId: string) => 
    payments.filter(p => p.saleId === saleId).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  
  const calculateRemaining = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return 0;
    if (sale.factureStatus === 'rembourse') return 0;
    const price = Number(sale.price) || 0;
    const transport = Number(sale.transport) || 0;
    return (price + transport) - calculateTotalPaid(saleId);
  };

  const getDaysInfo = (saleDate: string) => {
    if (!saleDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dateVente = new Date(saleDate); 
    if (isNaN(dateVente.getTime())) return 0;
    dateVente.setHours(0, 0, 0, 0);
    const dateLimite = new Date(dateVente); 
    dateLimite.setDate(dateLimite.getDate() + latePaymentDays); 
    return Math.ceil((dateLimite.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) || 0;
  };

  const handleUpdateReleaseStatus = async (saleId: string, status: string) => {
    if (!databaseUid) return;
    try {
      await setDoc(doc(db, getUserPath('sales', databaseUid), saleId), { releaseStatus: status }, { merge: true });
    } catch (e) {
      console.error('Error updating release status', e);
    }
  };

  const handleAddSaleCheck = (action: () => void) => {
    if (userProfile?.testMode && sales.length >= (userProfile.maxClients || 4)) {
      alert(`⚠️ Compte Test limité à ${userProfile.maxClients || 4} clients. Veuillez nous contacter pour passer en mode SaaS Premium et lever cette limite !`);
      return;
    }
    action();
  };

  let processedSales = sales.filter(s => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientMatch = String(s.clientName || '').toLowerCase().includes(q);
      const vinMatch = String(s.vin || '').toLowerCase().includes(q);
      const plaqueMatch = String(s.plaque || '').toLowerCase().includes(q);
      const refMatch = String(s.ref || '').toLowerCase().includes(q);
      const bdcMatch = String(s.bdcNumber || '').toLowerCase().includes(q);
      const marqueMatch = String(s.marque || '').toLowerCase().includes(q);
      const modeleMatch = String(s.modele || '').toLowerCase().includes(q);
      return clientMatch || vinMatch || plaqueMatch || refMatch || bdcMatch || marqueMatch || modeleMatch;
    }

    // Role based filtering: 
    // Commercials can only see their own by default, unless they override. 
    // Wait, the prompt says "Commerciaux: controle sur les cartes qu'ils ont creer + celles des autres"
    // So they can see everything but maybe with a warning later.
    
    if (filterCommercial !== 'Tous' && s.commercial !== filterCommercial) return false;
    if (filterCompany !== 'Toutes' && s.company !== filterCompany) return false;
    
    const remaining = calculateRemaining(s.id);
    if (filterStatus === 'Soldé' && remaining > 0) return false;
    if (filterStatus === 'À payer' && remaining <= 0) return false;

    if (filterFacture === 'Facturé' && s.factureStatus !== 'facture') return false;
    if (filterFacture === 'Non facturé' && (s.factureStatus === 'facture' || s.factureStatus === 'rembourse')) return false;
    if (filterFacture === 'Remboursé' && s.factureStatus !== 'rembourse') return false;

    // Default releaseStatus is effectively 'non_sorti' if undefined
    const relStat = s.releaseStatus || 'non_sorti';
    if (filterReleaseStatus !== 'Tous') {
      if (filterReleaseStatus === 'Non sorti' && relStat !== 'non_sorti') return false;
      if (filterReleaseStatus === 'Programmé' && relStat !== 'programmee') return false;
      if (filterReleaseStatus === 'Sorti' && relStat !== 'sorti') return false;
      if (filterReleaseStatus === 'Sorti TPD' && relStat !== 'sorti_tpd') return false;
    }

    return true;
  });

  // Split into active (remaining > 0 and not refunded) and settled (paid or refunded) so settled ones are always at the bottom
  const activeSales = processedSales.filter(s => {
    const remaining = calculateRemaining(s.id);
    const isRefunded = s.factureStatus === 'rembourse';
    return remaining > 0 && !isRefunded;
  });

  const settledSales = processedSales.filter(s => {
    const remaining = calculateRemaining(s.id);
    const isRefunded = s.factureStatus === 'rembourse';
    return remaining <= 0 || isRefunded;
  });

  const sortFunction = (a: Sale, b: Sale) => {
    let valA, valB;
    
    switch (sortConfig.key) {
      case 'bdcNumber':
        valA = parseInt(a.bdcNumber) || 0; valB = parseInt(b.bdcNumber) || 0; break;
      case 'client':
        valA = String(a.clientName || '').toLowerCase(); valB = String(b.clientName || '').toLowerCase(); break;
      case 'vehicule':
        valA = `${a.marque || ''} ${a.modele || ''}`.toLowerCase(); valB = `${b.marque || ''} ${b.modele || ''}`.toLowerCase(); break;
      case 'reste':
        valA = calculateRemaining(a.id); valB = calculateRemaining(b.id); break;
      case 'date':
      default:
        valA = new Date(a.date || 0).getTime(); valB = new Date(b.date || 0).getTime(); break;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  };

  activeSales.sort(sortFunction);
  settledSales.sort(sortFunction);

  const finalProcessedSales = [...activeSales, ...settledSales];

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // For date and reste, default to descending to show newest/highest remaining first
      if (key === 'date' || key === 'reste') {
        direction = 'desc';
      }
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-300 group-hover:text-slate-500" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />;
  };

  const commerciaux = ['Tous', 'À assigner', ...Array.from(new Set(teamMembers.map(t => t.name)))];
  const entreprisesList = Array.from(new Set(sales.map(s => s.company).filter(Boolean)));
  const entreprises = ['Toutes', ...entreprisesList];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Espace {userProfile?.role === 'admin' || userProfile?.role === 'superadmin' ? 'Direction' : 'Commercial'}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Dossiers & Ventes
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
              Gérez l'ensemble de vos dossiers clients, suivez l'évolution de vos ventes et centralisez vos documents.
            </p>
          </div>
        </div>
      </div>

      {/* BARRE D'ACTIONS AVEC DROPZONE */}
      <div 
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }} 
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }} 
        onDrop={(e) => {
          e.preventDefault(); 
          e.stopPropagation();
          setIsDragging(false); 
          const f = e.dataTransfer.files[0]; 
          if(f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith('.pdf'))) {
            handleAddSaleCheck(() => onProcessPdf(f));
          } else if (f) {
            alert("Veuillez sélectionner un fichier PDF");
          }
        }} 
        className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 relative ${isDragging ? 'border-indigo-500 border-2 border-dashed bg-indigo-50 scale-[1.01]' : ''}`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-indigo-500/10 rounded-2xl border-2 border-indigo-500 border-dashed backdrop-blur-[1px] pointer-events-none">
            <div className="bg-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 text-indigo-700 font-black animate-bounce pointer-events-none">
              <UploadCloud size={24} /> Relâchez le BDC (PDF) ici pour scanner !
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 whitespace-nowrap">Dossiers en cours</h2>
            
            <div className="flex w-full md:w-auto items-center gap-2">
              <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors" 
                  placeholder="Rechercher Plaque, VIN, Nom, Réf, BDC..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X className="h-4 w-4"/></button>}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="flex-none p-2 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors cursor-pointer flex items-center justify-center animate-scale-up"
                  title="Réinitialiser tous les filtres"
                >
                  <RotateCcw size={15} />
                </button>
              )}

              <button 
                onClick={() => setShowFilters(!showFilters)} 
                className={`flex-none flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                title="Afficher les filtres avancés"
              >
                <span className="text-sm font-bold hidden sm:inline">Filtres</span>
                {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 border-t border-slate-100 pt-6 mt-2">
            {showFilters ? (
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <User size={16} className="text-slate-500" />
                  <select className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 outline-none cursor-pointer font-bold" value={filterCommercial} onChange={(e) => setFilterCommercial(e.target.value)}>
                    {commerciaux.map((c, i) => <option key={`com_${i}_${c}`} value={c}>{c === 'Tous' ? 'Tous les commerciaux' : c}</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <Building2 size={16} className="text-slate-500" />
                  <select className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 outline-none cursor-pointer font-bold" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
                    {entreprises.map((c, i) => <option key={`ent_${i}_${c}`} value={c}>{c === 'Toutes' ? 'Toutes les entreprises' : c}</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <Banknote size={16} className="text-slate-500" />
                  <select className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 outline-none cursor-pointer font-bold" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="Tous">Paiement : Tous</option>
                    <option value="Soldé">Soldés ✔️</option>
                    <option value="À payer">Reste à payer ⏳</option>
                  </select>
                </div>
                {/* NEW FILTERS */}
                <select className="bg-slate-50 px-3 py-2 border border-slate-200 shadow-sm rounded-xl text-sm outline-none font-bold text-slate-700 cursor-pointer" value={filterFacture} onChange={(e) => setFilterFacture(e.target.value)}>
                  <option value="Tous">Facture : Toutes</option>
                  <option value="Facturé">Facturées</option>
                  <option value="Non facturé">Non facturées</option>
                  <option value="Remboursé">Remboursés</option>
                </select>
                <select className="bg-slate-50 px-3 py-2 border border-slate-200 shadow-sm rounded-xl text-sm outline-none font-bold text-slate-700 cursor-pointer" value={filterReleaseStatus} onChange={(e) => setFilterReleaseStatus(e.target.value)}>
                  <option value="Tous">État : Tout</option>
                  <option value="Non sorti">En Parc</option>
                  <option value="Programmé">Programmées</option>
                  <option value="Sorti">Sorties</option>
                  <option value="Sorti TPD">Sorties (TPD)</option>
                </select>
              </div>
            ) : (
              <div className="hidden lg:block w-px"></div>
            )}

            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap lg:flex-nowrap lg:ml-auto">
              <input type="file" accept=".pdf" className="hidden" ref={pdfInputRef} onChange={(e) => e.target.files && handleAddSaleCheck(() => onProcessPdf(e.target.files![0]))} />
              <button onClick={() => handleAddSaleCheck(() => pdfInputRef.current?.click())} className={`flex flex-none items-center justify-center p-2.5 rounded-xl transition-all shadow-sm transform hover:-translate-y-0.5 border bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50`} title="Scanner un PDF">
                <UploadCloud size={20} />
              </button>
              <button onClick={() => handleAddSaleCheck(onManualEntry)} className="flex flex-1 lg:flex-none items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all text-sm font-bold shadow-sm transform hover:-translate-y-0.5">
                <Plus size={18} /><span>Créer BDC</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[1000px]">
             <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[11px] font-black tracking-wider">
              <tr>
                <th className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => handleSort('bdcNumber')}>
                  <div className="flex items-center gap-2">N° BDC <SortIcon columnKey="bdcNumber" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => handleSort('client')}>
                  <div className="flex items-center gap-2">Client & Contact <SortIcon columnKey="client" /></div>
                </th>
                <th className="px-5 py-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => handleSort('vehicule')}>
                  <div className="flex items-center gap-2">Véhicule & Infos <SortIcon columnKey="vehicule" /></div>
                </th>
                <th className="px-5 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => handleSort('date')}>
                  <div className="flex items-center justify-center gap-2">Date & Délai <SortIcon columnKey="date" /></div>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors group select-none" onClick={() => handleSort('reste')}>
                  <div className="flex items-center justify-end gap-2"><SortIcon columnKey="reste" /> Reste à payer</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finalProcessedSales.map((sale) => {
                const remaining = calculateRemaining(sale.id);
                const isPaid = remaining <= 0;
                const isRefunded = sale.factureStatus === 'rembourse';
                const isSettled = isPaid || isRefunded;
                const daysDiff = getDaysInfo(sale.date);
                const isOverdue = !isPaid && daysDiff < 0;
                
                // Color based on status
                let rowClass = 'hover:bg-slate-50';
                if (isRefunded) {
                   rowClass = 'bg-slate-100/40 opacity-55 text-slate-400 select-none';
                } else if (sale.releaseStatus === 'sorti' || sale.releaseStatus === 'sorti_tpd') {
                   rowClass = 'bg-slate-50 opacity-80 hover:opacity-100';
                } else if (isOverdue) {
                   rowClass = 'bg-red-50 hover:bg-red-100';
                }

                return (
                  <tr 
                    key={sale.id} 
                    onClick={() => onSelectSale(sale.id)} 
                    className={`${rowClass} transition-colors cursor-pointer hover:shadow-inner group/row`}
                  >
                    <td className="px-5 py-4 align-top w-28 text-left">
                      <div className={`text-[11px] uppercase font-black tracking-wider ${sale.company === 'KDB AUTO' ? 'text-red-600' : 'text-indigo-600'}`}>
                        {sale.company}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-500 mt-1">
                        #{sale.bdcNumber}
                      </div>
                      {sale.saleMode && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black tracking-wider uppercase text-slate-400">
                          {sale.saleMode === 'export' && <><Plane size={11} className="text-blue-500" /> <span className="text-blue-600/80">Export</span></>}
                          {sale.saleMode === 'locale' && <><MapPin size={11} className="text-emerald-500" /> <span className="text-emerald-600/80">Locale</span></>}
                          {sale.saleMode === 'marchand' && <><Store size={11} className="text-purple-500" /> <span className="text-purple-600/80">Marchand</span></>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top w-64">
                      <div className="font-black text-slate-800 text-base flex items-center relative group">
                        <span className={isRefunded ? 'line-through text-slate-400' : ''} onClick={(e) => e.stopPropagation()}>{sale.clientName}</span>
                        {sale.notes && sale.notes.length > 0 && (
                          <div className="relative ml-2 flex items-center justify-center">
                            <span className="bg-amber-400 text-amber-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-sm" title={`${sale.notes.length} note(s)`}>
                              {sale.notes.length}
                            </span>
                            {/* NOUVEAU: Hover tooltip pour lire les notes */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 z-30 pointer-events-none">
                              <h4 className="font-bold border-b border-slate-600 pb-1 mb-2">Dernières notes</h4>
                              {sale.notes.map((n, i) => (
                                <div key={n.id || `note-${i}`} className="mb-2 last:mb-0">
                                  <span className="text-[10px] text-amber-300 block">{new Date(n.date).toLocaleDateString()}</span>
                                  <span className="break-words text-white">{n.text}</span>
                                </div>
                              ))}
                              <div className="absolute top-full left-3 w-3 h-3 bg-slate-800 transform rotate-45 -mt-1.5"></div>
                            </div>
                          </div>
                        )}
                      </div>
                      {sale.ref && <div className="text-xs font-bold text-slate-500 mt-0.5 flex items-center" onClick={(e) => e.stopPropagation()}><Hash size={10} className="mr-0.5 text-indigo-500"/> Réf: {sale.ref}</div>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${sale.commercial === 'À assigner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'}`}>
                          {sale.commercial}
                        </span>
                        {sale.factureStatus === 'facture' && (
                           <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                             <CheckCircle2 size={10} /> Facturé
                           </span>
                        )}
                        {sale.factureStatus === 'a_rembourser' && (
                           <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center shadow-sm">
                             À Rembourser
                           </span>
                        )}
                        {sale.factureStatus === 'rembourse' && (
                           <span className="bg-purple-50 border border-purple-200 text-purple-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center shadow-sm">
                             Remboursé
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top w-80">
                      <div className={`font-bold text-slate-800 text-base ${isRefunded ? 'text-slate-400 font-normal' : ''}`} onClick={(e) => e.stopPropagation()}>{sale.marque} {sale.modele} <span className="text-sm font-medium text-slate-500">({sale.color})</span></div>
                      <div className="mt-2 flex flex-col gap-1.5 items-start">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 shadow-sm" onClick={(e) => e.stopPropagation()}><Car size={12}/> {sale.plaque || '-'}</span>
                          {(sale as any).mec && (
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center shadow-sm" onClick={(e) => e.stopPropagation()}>
                              M.E.C : {(sale as any).mec}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 break-all leading-tight shadow-sm" onClick={(e) => e.stopPropagation()}>
                             {sale.vin || '-'}
                           </span>
                           <div className="relative group/status flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                             <span className={`cursor-pointer inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shadow-sm transition-colors ${
                               !sale.releaseStatus || sale.releaseStatus === 'non_sorti' ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100' : 
                               sale.releaseStatus === 'programmee' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 
                               'bg-slate-800 border-slate-900 text-white hover:bg-slate-700'
                             }`}>
                               {!sale.releaseStatus || sale.releaseStatus === 'non_sorti' ? 'En Parc' : sale.releaseStatus === 'programmee' ? 'Sortie Prog.' : sale.releaseStatus === 'sorti_tpd' ? 'Sorti TPD' : 'Sorti'}
                               <ChevronDown size={10} className="ml-1 opacity-50" />
                             </span>
                             <div className="absolute top-full left-0 mt-1 hidden group-hover/status:flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl z-20 w-28 p-1" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleUpdateReleaseStatus(sale.id, 'non_sorti')} className="text-left px-2 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors">En Parc</button>
                                <button onClick={() => handleUpdateReleaseStatus(sale.id, 'programmee')} className="text-left px-2 py-1.5 text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">Sortie Prog.</button>
                                <button onClick={() => handleUpdateReleaseStatus(sale.id, 'sorti')} className="text-left px-2 py-1.5 text-[10px] font-bold uppercase text-slate-900 hover:bg-slate-100 rounded-md transition-colors">Sorti</button>
                                <button onClick={() => handleUpdateReleaseStatus(sale.id, 'sorti_tpd')} className="text-left px-2 py-1.5 text-[10px] font-bold uppercase text-slate-900 hover:bg-slate-100 rounded-md transition-colors">Sorti TPD</button>
                             </div>
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center align-top w-32">
                        <div className="font-black text-slate-700 mb-2">{new Date(sale.date).toLocaleDateString('fr-FR')}</div>
                        <div className="flex justify-center">
                          {isPaid ? <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-500"/> Soldé</span> : isOverdue ? <span className="text-[11px] font-black text-red-600 flex items-center gap-1"><Clock size={12}/> Retard {Math.abs(daysDiff)}j</span> : <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1"><Clock size={12}/> {daysDiff} jour(s) rest.</span>}
                        </div>
                    </td>
                    <td className="px-5 py-4 text-right align-top w-44">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`px-4 py-2 rounded-xl text-sm font-black shadow-sm inline-block min-w-[100px] text-center whitespace-nowrap border ${isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isOverdue ? 'bg-red-500 border-red-600 text-white shadow-md shadow-red-500/20' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{remaining.toLocaleString()} €</span>
                        <div className="text-slate-400 group-hover/row:text-indigo-600 group-hover/row:translate-x-1 transition-all duration-200">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {finalProcessedSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 cursor-default">
                    <div className="text-slate-400 mb-2"><Search size={40} className="mx-auto opacity-50" /></div>
                    <p className="text-slate-500 font-bold text-lg">Aucun dossier trouvé.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
