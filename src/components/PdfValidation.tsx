import React, { useState } from 'react';
import { 
  ChevronLeft, Edit2, Plus, AlertTriangle, Building2, User, Phone, 
  Mail, Hash, Car, Palette, Banknote, Save, Loader2, Search, MapPin, Users, X, HelpCircle 
} from 'lucide-react';
import { useApp } from '../lib/context';
import { db, doc, setDoc, getUserPath } from '../lib/firebase';
import { Sale } from '../types';
import { notifyFolderAction } from '../lib/notifications';

interface Props {
  draftExtraction: any;
  onCancel: () => void;
  onShowToast: (msg: string, type?: 'success'|'error') => void;
  onSuccess: (saleId: string) => void;
}

export const PdfValidation: React.FC<Props> = ({ draftExtraction, onCancel, onShowToast, onSuccess }) => {
  const { sales, clients, payments, userAuth, databaseUid, teamMembers, userProfile } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState(draftExtraction);

  const [initialPrice, setInitialPrice] = useState<number | ''>(draft.initialPrice || draft.price || '');
  const [discountAmount, setDiscountAmount] = useState<number | ''>(draft.discountAmount || '');
  const [price, setPrice] = useState<number | ''>(draft.price || '');
  const [saleMode, setSaleMode] = useState<string>(draft.saleMode || 'export');
  const [tvaRate, setTvaRate] = useState<number | ''>(draft.tvaRate ?? 20);

  const [contactSearch, setContactSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'client' | 'intermediaire'>('all');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);

  const suggestedClients = React.useMemo(() => {
    const map = new Map<string, any>();
    // 1. Explicit clients from custom directory
    if (clients && Array.isArray(clients)) {
      clients.forEach(c => {
        const key = 'manual::' + String(c.id || '').trim().toLowerCase();
        map.set(key, {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          zipCode: c.zipCode || '',
          city: c.city || '',
          type: (c as any).type || 'client',
        });
      });
    }
    // 2. Extracted clients & references from previous sales
    if (sales && Array.isArray(sales)) {
      sales.forEach(s => {
        // End buyer / Owner
        const name = String(s.clientName || '').trim();
        if (name) {
          const clientKey = 'sale_client::' + name.toLowerCase();
          if (map.has(clientKey)) {
            const existing = map.get(clientKey);
            if (!existing.phone && s.phone) existing.phone = s.phone;
            if (!existing.email && s.email) existing.email = s.email;
            if (!existing.address && s.address) existing.address = s.address;
            if (!existing.zipCode && s.zipCode) existing.zipCode = s.zipCode;
            if (!existing.city && s.city) existing.city = s.city;
          } else {
            map.set(clientKey, {
              id: `sale-client-${s.id}`,
              name,
              phone: s.phone || '',
              email: s.email || '',
              address: s.address || '',
              zipCode: s.zipCode || '',
              city: s.city || '',
              type: 'client',
            });
          }
        }

        // Intermediary / Reference
        const refName = String(s.ref || '').trim();
        if (refName && refName !== '-' && refName.toLowerCase() !== 'aucun' && refName.toLowerCase() !== 'none') {
          const refKey = 'sale_ref::' + refName.toLowerCase();
          if (map.has(refKey)) {
            const existing = map.get(refKey);
            if (!existing.phone && s.refPhone) existing.phone = s.refPhone;
            if (!existing.email && s.refEmail) existing.email = s.refEmail;
          } else {
            map.set(refKey, {
              id: `sale-ref-${s.id}`,
              name: refName,
              phone: s.refPhone || '',
              email: s.refEmail || '',
              address: '',
              zipCode: '',
              city: '',
              type: 'intermediaire',
            });
          }
        }
      });
    }

    // Merge/de-duplicate by name and type
    const finalMap = new Map<string, any>();
    map.forEach((c) => {
      const matchKey = `${c.type}::${c.name.trim().toLowerCase()}`;
      if (finalMap.has(matchKey)) {
        const existing = finalMap.get(matchKey);
        if (!existing.phone && c.phone) existing.phone = c.phone;
        if (!existing.email && c.email) existing.email = c.email;
        if (!existing.address && c.address) existing.address = c.address;
        if (!existing.zipCode && c.zipCode) existing.zipCode = c.zipCode;
        if (!existing.city && c.city) existing.city = c.city;
      } else {
        finalMap.set(matchKey, c);
      }
    });

    return Array.from(finalMap.values());
  }, [clients, sales]);

  const filteredContacts = React.useMemo(() => {
    let list = suggestedClients;
    if (sidebarFilter !== 'all') {
      list = list.filter(c => c.type === sidebarFilter);
    }

    const q = contactSearch.toLowerCase().trim();
    if (!q) return list;

    return list.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  }, [suggestedClients, contactSearch, sidebarFilter]);

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraft({ ...draft, clientName: val });
    if (val.trim()) {
      const filtered = suggestedClients.filter(c => 
        c.type === 'client' && c.name.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (sugg: any) => {
    if (sugg.type === 'intermediaire') {
      setDraft({
        ...draft,
        ref: sugg.name,
        refPhone: sugg.phone || draft.refPhone || '',
        refEmail: sugg.email || draft.refEmail || '',
      });
    } else {
      setDraft({
        ...draft,
        clientName: sugg.name,
        phone: sugg.phone || draft.phone || '',
        email: sugg.email || draft.email || '',
        address: sugg.address || draft.address || '',
        zipCode: sugg.zipCode || draft.zipCode || '',
        city: sugg.city || draft.city || '',
      });
    }
    setShowSuggestions(false);
  };

  const handleInitialPriceChange = (val: string) => {
    const num = parseFloat(val);
    setInitialPrice(val === '' ? '' : num);
    if (!isNaN(num)) {
      const disc = typeof discountAmount === 'number' ? discountAmount : 0;
      setPrice(Number((num - disc).toFixed(2)));
    }
  };

  const handleInitialPriceHTChange = (val: string) => {
    if (val === '') {
      setInitialPrice('');
      setPrice('');
      return;
    }
    const ht = parseFloat(val);
    if (!isNaN(ht)) {
      const rate = typeof tvaRate === 'number' ? tvaRate : 20;
      const ttc = Number((ht * (1 + rate / 100)).toFixed(2));
      setInitialPrice(ttc);
      const disc = typeof discountAmount === 'number' ? discountAmount : 0;
      setPrice(Number((ttc - disc).toFixed(2)));
    }
  };

  const handleTvaChange = (val: string) => {
    const newRate = val === '' ? '' : parseFloat(val);
    const oldRate = typeof tvaRate === 'number' ? tvaRate : 20;
    setTvaRate(newRate);
    if (saleMode === 'locale' && typeof initialPrice === 'number' && typeof newRate === 'number') {
      const ht = initialPrice / (1 + oldRate / 100);
      const newTtc = Number((ht * (1 + newRate / 100)).toFixed(2));
      setInitialPrice(newTtc);
      const disc = typeof discountAmount === 'number' ? discountAmount : 0;
      setPrice(Number((newTtc - disc).toFixed(2)));
    }
  };

  const handleDiscountChange = (val: string) => {
    const num = parseFloat(val);
    setDiscountAmount(val === '' ? '' : num);
    if (!isNaN(num) && typeof initialPrice === 'number') {
      setPrice(Number((initialPrice - num).toFixed(2)));
    }
  };

  const handlePriceChange = (val: string) => {
    const num = parseFloat(val);
    setPrice(val === '' ? '' : num);
    if (!isNaN(num) && typeof initialPrice === 'number') {
      setDiscountAmount(Number((initialPrice - num).toFixed(2)));
    }
  };

  const handleSaleModeChange = (newMode: string) => {
    const oldMode = saleMode;
    setSaleMode(newMode);
    const rate = typeof tvaRate === 'number' ? tvaRate : 20;

    if (newMode === 'locale' && oldMode !== 'locale') {
      // Switching to Local (HT -> TTC)
      if (typeof initialPrice === 'number') {
        const newInitial = Number((initialPrice * (1 + rate / 100)).toFixed(2));
        setInitialPrice(newInitial);
        const disc = typeof discountAmount === 'number' ? discountAmount : 0;
        setPrice(Number((newInitial - disc).toFixed(2)));
      }
    } else if (newMode !== 'locale' && oldMode === 'locale') {
      // Switching from Local (TTC -> HT)
      if (typeof initialPrice === 'number') {
        const newInitial = Number((initialPrice / (1 + rate / 100)).toFixed(2));
        setInitialPrice(newInitial);
        const disc = typeof discountAmount === 'number' ? discountAmount : 0;
        setPrice(Number((newInitial - disc).toFixed(2)));
      }
    }
  };

  const isEditing = !!draft.id;
  const isExistingWarning = !isEditing && !draft.isManual && sales.some(s => s.company === draft.company && String(s.bdcNumber) === draft.bdcNumber && draft.bdcNumber !== '');

  const commerciaux = ['À assigner', ...Array.from(new Set(teamMembers.map(t => t.name)))];
  const userCompanies = userProfile?.companiesList || [];
  const entreprisesList = Array.from(new Set([
    ...(userProfile?.companyId ? [userProfile.companyId] : []),
    ...userCompanies,
    ...sales.map(s => s.company).filter(Boolean)
  ]));
  if (!entreprisesList.includes('KDB AUTO')) entreprisesList.push('KDB AUTO');
  if (!entreprisesList.includes('DJ CAR')) entreprisesList.push('DJ CAR');
  const entreprises = entreprisesList;

  const handleSaveDraft = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userAuth || !databaseUid) return;
    setIsLoading(true);

    const fd = new FormData(e.currentTarget);
    const data = {
      bdcNumber: String(fd.get('bdcNumber') || '').trim().toUpperCase(),
      company: fd.get('company') as string,
      clientName: String(fd.get('clientName') || '').toUpperCase(),
      phone: fd.get('phone') as string,
      email: (fd.get('email') as string) || '',
      marque: String(fd.get('marque') || '').toUpperCase(),
      modele: String(fd.get('modele') || '').toUpperCase(),
      color: String(fd.get('color') || '').toUpperCase(),
      vin: String(fd.get('vin') || '').toUpperCase(),
      plaque: String(fd.get('plaque') || '').toUpperCase(),
      mec: String(fd.get('mec') || '').trim().toUpperCase(),
      kms: fd.get('kms') ? parseInt(fd.get('kms') as string) : undefined,
      garantie: String(fd.get('garantie') || '').trim(),
      energie: String(fd.get('energie') || '').trim().toUpperCase(),
      price: parseFloat(fd.get('price') as string) || 0,
      transport: parseFloat(fd.get('transport') as string) || 0,
      date: fd.get('date') as string,
      commercial: fd.get('commercial') as string,
      ref: (fd.get('ref') as string) || '',
      refPhone: (fd.get('refPhone') as string) || '',
      refEmail: (fd.get('refEmail') as string) || '',
      address: String(fd.get('address') || '').trim(),
      zipCode: String(fd.get('zipCode') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      saleMode: (fd.get('saleMode') as string) || 'locale',
      tvaRate: parseFloat(fd.get('tvaRate') as string) || 20,
      initialPrice: parseFloat(fd.get('initialPrice') as string) || parseFloat(fd.get('price') as string) || 0,
      discountAmount: parseFloat(fd.get('discountAmount') as string) || 0
    };

    let targetId = draft.id;
    let existingSale = null;

    if (targetId) {
      existingSale = sales.find(s => s.id === targetId);
    } else {
      existingSale = sales.find(s => s.company === data.company && String(s.bdcNumber) === data.bdcNumber && data.bdcNumber !== '');
      targetId = existingSale ? existingSale.id : Date.now().toString();
    }

    try {
      const saleRef = doc(db, getUserPath('sales', databaseUid), targetId);
      const dataToSave = { ...data };
      
      if (existingSale) {
        const updatedSale = { ...existingSale, ...dataToSave } as Sale;
        await setDoc(saleRef, updatedSale, { merge: true });
        onShowToast(`Dossier mis à jour !`, 'success');
        notifyFolderAction(
          updatedSale,
          'modification',
          `Dossier modifié (${updatedSale.clientName})`,
          `${userProfile?.name || 'Un utilisateur'} a mis à jour les informations du dossier pour ${updatedSale.clientName} (${updatedSale.marque} ${updatedSale.modele}).`,
          teamMembers,
          databaseUid
        );
      } else {
        const newSale = { ...dataToSave, id: targetId, notes: [], factureStatus: 'non_facture', releaseStatus: 'non_sorti' } as Sale;
        await setDoc(saleRef, newSale, { merge: true });
        onShowToast(`Dossier créé avec succès !`, 'success');
        notifyFolderAction(
          newSale,
          'bdc',
          `Nouveau BDC importé : ${newSale.bdcNumber || ''}`,
          `${userProfile?.name || 'Un utilisateur'} a importé un nouveau dossier pour le client ${newSale.clientName} (${newSale.marque} ${newSale.modele}).`,
          teamMembers,
          databaseUid
        );
        
        // EXCLUSIVITÉ DJ CAR : Le système d'envoi d'e-mails pour les nouveaux bons de commande est réservé uniquement à DJ CAR.
        if (data.company === 'DJ CAR') {
          console.log("Notification d'e-mail automatique disponible uniquement pour la compagnie DJ CAR");
          // TODO: Configuration SMTP ou Webhook d'envoi d'e-mail complexe pour DJ CAR
        }
      }

      // IMPORT DES ACOMPTES INITIAUX ONLY IF NEW
      if (!draft.id && draft.draftPayments && draft.draftPayments.length > 0) {
         const existingPaymentsForSale = payments.filter(p => p.saleId === targetId);
         const selectedPayments = draft.draftPayments.filter((p: any) => p.selected);
         
         for (let i = 0; i < selectedPayments.length; i++) {
            const p = selectedPayments[i];
            const isDuplicate = existingPaymentsForSale.some(ep => Number(ep.amount) === Number(p.amount) && ep.type === p.type);
            if (!isDuplicate) {
               const payId = (Date.now() + i).toString();
               await setDoc(doc(db, getUserPath('payments', databaseUid), payId), { 
                 id: payId, saleId: targetId, type: p.type, payer: p.payer || data.clientName, date: data.date, amount: Number(p.amount) || 0 
               });
            }
         }
      }

      onSuccess(targetId);
    } catch (error: any) { 
      onShowToast("Erreur de sauvegarde : " + String(error.message), "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6 animate-fade-in-up px-4 md:px-8">
      <button onClick={onCancel} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors font-bold select-none">
        <ChevronLeft size={20} /><span>Annuler {isEditing ? 'la modification' : 'la saisie'}</span>
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden select-none">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Administration
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              {isEditing ? <Edit2 className="text-indigo-400" size={28} /> : <Plus className="text-indigo-400" size={28} />} 
              {isEditing ? 'Modification du dossier' : 'Création manuelle de dossier'}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
              {isEditing ? 'Modifiez les informations du client et du véhicule ci-dessous.' : 'Veuillez saisir les informations du véhicule et du client.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Left Side: Contact List */}
        <div className="w-full xl:w-80 2xl:w-96 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col h-auto xl:h-[800px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 select-none">
            <div>
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Users className="text-indigo-500 shrink-0" size={18} />
                Annuaire de contacts
              </h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase mt-0.5 tracking-wider">
                Cliquez pour pré-remplir
              </p>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-lg">
              {filteredContacts.length}
            </span>
          </div>

          {/* Sidebar Filter Tabs */}
          <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg mb-3 select-none text-[10px]">
            <button
              type="button"
              onClick={() => setSidebarFilter('all')}
              className={`flex-1 py-1.5 rounded-md font-black transition-all cursor-pointer text-center ${
                sidebarFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tout
            </button>
            <button
              type="button"
              onClick={() => setSidebarFilter('client')}
              className={`flex-1 py-1.5 rounded-md font-black transition-all cursor-pointer text-center ${
                sidebarFilter === 'client'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Acheteurs
            </button>
            <button
              type="button"
              onClick={() => setSidebarFilter('intermediaire')}
              className={`flex-1 py-1.5 rounded-md font-black transition-all cursor-pointer text-center ${
                sidebarFilter === 'intermediaire'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Réf / Interm
            </button>
          </div>

          {/* Contact Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher un contact..." 
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-indigo-400 transition-all"
            />
            {contactSearch && (
              <button 
                type="button"
                onClick={() => setContactSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 xl:max-h-[640px] max-h-[300px]">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                Aucun contact trouvé
              </div>
            ) : (
              filteredContacts.map((c, idx) => {
                const isSelected = 
                  (c.type === 'intermediaire' && draft.ref?.toLowerCase().trim() === c.name.toLowerCase().trim()) ||
                  (c.type === 'client' && draft.clientName?.toLowerCase().trim() === c.name.toLowerCase().trim());
                
                return (
                  <div 
                    key={idx}
                    onClick={() => handleSelectSuggestion(c)}
                    className={`p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50 cursor-pointer transition-all flex flex-col gap-1 select-none relative group ${
                      isSelected ? 'border-indigo-500 bg-indigo-50/20 shadow-xs font-bold' : ''
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                      <span className="truncate pr-2">{c.name}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0 ${
                        c.type === 'intermediaire' ? 'bg-sky-50 text-sky-700 border border-sky-100/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100/50'
                      }`}>
                        {c.type === 'intermediaire' ? 'Réf' : 'Client'}
                      </span>
                    </div>
                    {c.phone && (
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                        <Phone size={11} className="text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 truncate">
                        <Mail size={11} className="text-slate-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {(c.city || c.zipCode) && (
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400" />
                        <span>{c.city} {c.zipCode ? `(${c.zipCode})` : ''}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        
        {isExistingWarning && (
           <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mx-8 mt-6 flex gap-3">
             <AlertTriangle className="text-amber-500" />
             <div>
               <p className="font-bold text-amber-800">Ce Bon de Commande existe déjà dans le système !</p>
               <p className="text-sm text-amber-700">En validant, vous allez mettre à jour les informations du véhicule. L'ancien commercial, l'email et le numéro de téléphone seront conservés. Les nouveaux acomptes seront ajoutés automatiquement sans créer de doublons.</p>
             </div>
           </div>
        )}

        <form onSubmit={handleSaveDraft} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-200">
              <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4"><Building2 size={16}/> Identification BDC</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Entreprise</label>
                  <input list="entreprises-list" name="company" value={draft.company} onChange={(e) => setDraft({...draft, company: e.target.value.toUpperCase()})} className="w-full p-2.5 border-2 border-slate-300 rounded-md font-black focus:ring-0 focus:border-purple-500 outline-none text-sm uppercase" />
                  <datalist id="entreprises-list">
                    {entreprises.map(c => <option key={c} value={c}>{c}</option>)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">N° BDC <span className="text-red-500">*</span></label>
                  <input type="text" name="bdcNumber" required value={draft.bdcNumber} onChange={(e) => setDraft({...draft, bdcNumber: e.target.value})} className="w-full p-2.5 border-2 border-slate-300 rounded-md font-mono font-black focus:ring-0 focus:border-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date BDC <span className="text-red-500">*</span></label>
                  <input type="date" name="date" required defaultValue={draft.date} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4"><User size={16}/> Informations Client</h3>
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Client <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="clientName" 
                  required 
                  value={draft.clientName || ''} 
                  onChange={handleClientNameChange}
                  onFocus={() => { if ((draft.clientName || '').trim()) { setShowSuggestions(true); } }}
                  onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                  placeholder="Tapez pour rechercher un client existant..."
                  className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-bold text-sm" 
                  autoComplete="off"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((sugg, idx) => (
                      <div 
                        key={idx} 
                        onMouseDown={() => handleSelectSuggestion(sugg)}
                        className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <div className="font-bold text-xs text-slate-800">{sugg.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {sugg.phone && `📞 ${sugg.phone}`} {sugg.email && ` | ✉️ ${sugg.email}`} {sugg.city && ` | 📍 ${sugg.city}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Phone size={12} className="text-emerald-600"/> Téléphone</label>
                  <input 
                    type="text" 
                    name="phone" 
                    placeholder="ex: 06..." 
                    value={draft.phone || ''} 
                    onChange={(e) => setDraft({...draft, phone: e.target.value})}
                    className="w-full p-2.5 border border-emerald-300 bg-emerald-50 focus:bg-white rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Mail size={12} className="text-amber-600"/> Email</label>
                  <input 
                    type="email" 
                    name="email" 
                    placeholder="client@email.com" 
                    value={draft.email || ''} 
                    onChange={(e) => setDraft({...draft, email: e.target.value})}
                    className="w-full p-2.5 border border-amber-300 bg-amber-50 focus:bg-white rounded-md focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" 
                  />
                </div>
                 <div className="sm:col-span-3 mt-2 pt-4 border-t border-slate-200">
                   <div className="flex items-center gap-1.5 mb-2">
                     <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                       Intermédiaire (Réf)
                     </span>
                     <div className="group relative cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                       <HelpCircle size={14} />
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none z-50 leading-relaxed font-bold">
                         <span className="block text-indigo-400 mb-1 font-black text-xs uppercase">Réf / Intermédiaire</span>
                         L'intermédiaire, revendeur ou apporteurs d'affaires avec qui on communique, tandis que la vente principale est facturée au nom du client final.
                       </div>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <div>
                       <label className="block text-[10px] font-bold text-slate-600 mb-1">Nom / Réf</label>
                       <input 
                         type="text" 
                         name="ref" 
                         placeholder="Nom de l'intermédiaire" 
                         value={draft.ref || ''} 
                         onChange={(e) => setDraft({...draft, ref: e.target.value})}
                         className="w-full p-2 border border-blue-200 bg-blue-50/20 focus:bg-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium" 
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-600 mb-1">Téléphone Réf</label>
                       <input 
                         type="text" 
                         name="refPhone" 
                         placeholder="Téléphone de l'intermédiaire" 
                         value={draft.refPhone || ''} 
                         onChange={(e) => setDraft({...draft, refPhone: e.target.value})}
                         className="w-full p-2 border border-blue-200 bg-blue-50/20 focus:bg-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium" 
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-600 mb-1">Email Réf</label>
                       <input 
                         type="email" 
                         name="refEmail" 
                         placeholder="email@intermediaire.com" 
                         value={draft.refEmail || ''} 
                         onChange={(e) => setDraft({...draft, refEmail: e.target.value})}
                         className="w-full p-2 border border-blue-200 bg-blue-50/20 focus:bg-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium" 
                       />
                     </div>
                   </div>
                 </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
                  <input 
                    type="text" 
                    name="address" 
                    placeholder="ex: 12 Rue de la Paix" 
                    value={draft.address || ''} 
                    onChange={(e) => setDraft({...draft, address: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code Postal</label>
                  <input 
                    type="text" 
                    name="zipCode" 
                    placeholder="ex: 75000" 
                    value={draft.zipCode || ''} 
                    onChange={(e) => setDraft({...draft, zipCode: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" 
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                  <input 
                    type="text" 
                    name="city" 
                    placeholder="ex: Paris" 
                    value={draft.city || ''} 
                    onChange={(e) => setDraft({...draft, city: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
             <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4"><Car size={16}/> Véhicule Commandé</h3>
             <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marque <span className="text-red-500">*</span></label>
                  <input type="text" name="marque" required defaultValue={draft.marque} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
                <div className="col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modèle <span className="text-red-500">*</span></label>
                  <input type="text" name="modele" required defaultValue={draft.modele} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Palette size={14}/> Couleur</label>
                  <input type="text" name="color" defaultValue={draft.color} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plaque (Immat)</label>
                  <input type="text" name="plaque" defaultValue={draft.plaque} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold font-mono" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">M.E.C. / Année</label>
                  <input type="text" name="mec" placeholder="JJ/MM/AAAA ou Année" defaultValue={draft.mec} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">VIN</label>
                  <input type="text" name="vin" defaultValue={draft.vin} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold font-mono" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kilométrage (Kms)</label>
                  <input type="number" name="kms" placeholder="ex: 45000" defaultValue={draft.kms === undefined ? '' : draft.kms} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Énergie (Carburant)</label>
                  <input type="text" name="energie" placeholder="ex: DIESEL, ESSENCE, HYBRIDE" defaultValue={draft.energie || ''} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold uppercase" />
                </div>
                <div className="col-span-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Garantie (Mois / Type)</label>
                  <input type="text" name="garantie" placeholder="ex: 12 Mois Garantie Or" defaultValue={draft.garantie || ''} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
                </div>
             </div>
          </div>
          
          <div className="pt-6 border-t border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4">Détails de la Vente</h3>
                   <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Mode de vente</label>
                        <select name="saleMode" value={saleMode} onChange={(e) => handleSaleModeChange(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md font-medium focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white">
                          <option value="locale">Vente Locale</option>
                          <option value="export">Vente Export</option>
                          <option value="marchand">Vente Marchand</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Vendeur assigné <span className="text-red-500">*</span></label>
                        <select name="commercial" defaultValue={draft.commercial} className="w-full p-2 border border-slate-300 rounded-md font-medium focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white">
                          {commerciaux.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                   </div>

                   <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4 mt-6">Tarification & Remises</h3>
                   <div className="grid grid-cols-1 gap-4">
                      {saleMode === 'locale' && (
                        <div className="flex items-center gap-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                          <label className="block text-xs font-bold text-purple-900">TVA Applicable (%) :</label>
                          <input type="number" name="tvaRate" value={tvaRate} onChange={e => handleTvaChange(e.target.value)} className="w-20 p-1.5 border border-purple-200 rounded text-right font-bold text-sm outline-none" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        {saleMode === 'locale' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Prix Initial HT (€)
                            </label>
                            <input type="number" min="0" step="0.01" value={typeof initialPrice === 'number' ? Number((initialPrice / (1 + (typeof tvaRate === 'number' ? tvaRate : 20) / 100)).toFixed(2)) : ''} onChange={(e) => handleInitialPriceHTChange(e.target.value)} placeholder="Ex: 12500" className="w-full p-2 border border-slate-300 rounded-md text-right font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500" />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Prix Initial {saleMode === 'locale' ? 'TTC' : 'HT'} (€)
                          </label>
                          <input type="number" name="initialPrice" min="0" step="0.01" value={initialPrice} onChange={(e) => handleInitialPriceChange(e.target.value)} placeholder="Ex: 15000" className="w-full p-2 border border-slate-300 rounded-md text-right font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Remise Accordée {saleMode === 'locale' ? 'TTC' : 'HT'} (€)
                          </label>
                          <input type="number" name="discountAmount" min="0" step="0.01" value={discountAmount} onChange={(e) => handleDiscountChange(e.target.value)} placeholder="Ex: 500" className="w-full p-2 border border-slate-300 rounded-md text-right font-bold text-red-600 outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-purple-900 mb-1">
                          Prix de vente final {saleMode === 'locale' ? 'TTC' : 'HT'} (€) <span className="text-red-500">*</span>
                        </label>
                        <input type="number" name="price" required min="0" step="0.01" value={price} onChange={(e) => handlePriceChange(e.target.value)} className="w-full p-3 border-2 border-purple-300 bg-purple-50 rounded-md text-right font-black text-xl text-purple-900 focus:border-purple-600 focus:ring-0 outline-none" />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Saisissez le prix final {saleMode === 'locale' ? 'TTC' : 'HT'} qui sera facturé (après remise éventuelle).
                        </p>
                      </div>
                   </div>
                </div>

                {!isEditing && draft.draftPayments && draft.draftPayments.length > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 shadow-inner">
                    <h3 className="text-sm font-black text-emerald-800 mb-4 flex items-center gap-2">
                      <Banknote size={18} /> Modalités : Acomptes détectés
                    </h3>
                    <div className="space-y-3">
                      {draft.draftPayments.map((payment: any, index: number) => (
                        <div key={payment.id} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
                          <label className="flex items-center gap-2 cursor-pointer w-full">
                            <input 
                              type="checkbox" checked={payment.selected} 
                              onChange={(e) => {
                                const newPayments = [...draft.draftPayments];
                                newPayments[index].selected = e.target.checked;
                                setDraft({...draft, draftPayments: newPayments});
                              }}
                              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span className="font-black text-slate-800 text-sm">Acompte N°{index + 1}</span>
                          </label>
                          {payment.selected && (
                            <div className="flex w-full gap-2 pl-6 pt-2 border-t border-slate-100">
                              <div className="w-1/4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Moyen</label>
                                <select 
                                  value={payment.type} 
                                  onChange={(e) => {
                                    const newPayments = [...draft.draftPayments];
                                    newPayments[index].type = e.target.value;
                                    setDraft({...draft, draftPayments: newPayments});
                                  }}
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs font-bold bg-slate-50 focus:ring-emerald-500 outline-none"
                                >
                                  <option value="VIR">VIR</option>
                                  <option value="ESP">ESP</option>
                                  <option value="CHQ">CHQ</option>
                                  <option value="CB">CB</option>
                                  <option value="AUTRES">AUTRES</option>
                                </select>
                              </div>
                              <div className="w-2/4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Payeur / Note</label>
                                <input 
                                  type="text" 
                                  value={payment.payer} 
                                  onChange={(e) => {
                                    const newPayments = [...draft.draftPayments];
                                    newPayments[index].payer = e.target.value;
                                    setDraft({...draft, draftPayments: newPayments});
                                  }}
                                  placeholder="Nom du payeur" className="w-full p-1.5 border border-slate-300 rounded text-xs font-medium focus:ring-emerald-500 outline-none"
                                />
                              </div>
                              <div className="w-1/4">
                                <label className="block text-[10px] font-bold text-emerald-600 uppercase">Montant</label>
                                <input 
                                  type="number" 
                                  value={payment.amount} 
                                  onChange={(e) => {
                                    const newPayments = [...draft.draftPayments];
                                    newPayments[index].amount = parseFloat(e.target.value) || 0;
                                    setDraft({...draft, draftPayments: newPayments});
                                  }}
                                  className="w-full p-1.5 border-2 border-emerald-300 rounded text-sm font-black text-right text-emerald-800 focus:ring-emerald-500 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-emerald-600 mt-3 font-medium">L'OCR a pré-rempli ces informations. Vous pouvez les corriger avant l'importation.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-md font-black text-lg transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {isEditing ? 'Enregistrer les modifications' : (draft.isManual ? 'Enregistrer manuellement' : 'Créer & Sauvegarder')}
            </button>
          </div>
        </form>
      </div>
     </div>
    </div>
  );
};
