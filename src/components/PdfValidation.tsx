import React, { useState } from 'react';
import { 
  ChevronLeft, Edit2, Plus, AlertTriangle, Building2, User, Phone, 
  Mail, Hash, Car, Palette, Banknote, Save, Loader2 
} from 'lucide-react';
import { useApp } from '../lib/context';
import { db, doc, setDoc, getUserPath } from '../lib/firebase';
import { Sale } from '../types';

interface Props {
  draftExtraction: any;
  onCancel: () => void;
  onShowToast: (msg: string, type?: 'success'|'error') => void;
  onSuccess: (saleId: string) => void;
}

export const PdfValidation: React.FC<Props> = ({ draftExtraction, onCancel, onShowToast, onSuccess }) => {
  const { sales, payments, userAuth, databaseUid, teamMembers, userProfile } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState(draftExtraction);

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
      price: parseFloat(fd.get('price') as string) || 0,
      transport: parseFloat(fd.get('transport') as string) || 0,
      date: fd.get('date') as string,
      commercial: fd.get('commercial') as string,
      ref: (fd.get('ref') as string) || '',
      address: String(fd.get('address') || '').trim(),
      zipCode: String(fd.get('zipCode') || '').trim(),
      city: String(fd.get('city') || '').trim()
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
        await setDoc(saleRef, { ...existingSale, ...dataToSave }, { merge: true });
        onShowToast(`Dossier mis à jour !`, 'success');
      } else {
        await setDoc(saleRef, { ...dataToSave, id: targetId, notes: [], factureStatus: 'non_facture', releaseStatus: 'non_sorti' }, { merge: true });
        onShowToast(`Dossier créé avec succès !`, 'success');
        
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <button onClick={onCancel} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors font-bold">
        <ChevronLeft size={20} /><span>Annuler {isEditing ? 'la modification' : 'la saisie'}</span>
      </button>

      <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-purple-900 px-8 py-6 text-white flex items-start gap-4">
          <div className="bg-purple-800 p-3 rounded-lg">{isEditing ? <Edit2 size={32} className="text-purple-300" /> : <Plus size={32} className="text-purple-300" />}</div>
          <div>
            <h2 className="text-2xl font-black mb-1">{isEditing ? 'Modification du dossier' : 'Création manuelle de dossier'}</h2>
            <p className="text-purple-200 text-sm font-medium">{isEditing ? 'Modifiez les informations du client et du véhicule ci-dessous.' : 'Veuillez saisir les informations du véhicule et du client.'}</p>
          </div>
        </div>
        
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Client <span className="text-red-500">*</span></label>
                <input type="text" name="clientName" required defaultValue={draft.clientName} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-bold text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Phone size={12} className="text-emerald-600"/> Téléphone</label>
                  <input type="tel" name="phone" placeholder="ex: 06..." defaultValue={draft.phone} className="w-full p-2.5 border border-emerald-300 bg-emerald-50 focus:bg-white rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Mail size={12} className="text-amber-600"/> Email</label>
                  <input type="email" name="email" placeholder="client@email.com" defaultValue={draft.email} className="w-full p-2.5 border border-amber-300 bg-amber-50 focus:bg-white rounded-md focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Hash size={12} className="text-blue-600"/> Référence</label>
                  <input type="text" name="ref" placeholder="Intermédiaire..." defaultValue={draft.ref} className="w-full p-2.5 border border-blue-300 bg-blue-50 focus:bg-white rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
                  <input type="text" name="address" placeholder="ex: 12 Rue de la Paix" defaultValue={draft.address || ''} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code Postal</label>
                  <input type="text" name="zipCode" placeholder="ex: 75000" defaultValue={draft.zipCode || ''} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                  <input type="text" name="city" placeholder="ex: Paris" defaultValue={draft.city || ''} className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium" />
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
             </div>
          </div>
          
          <div className="pt-6 border-t border-slate-200">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-4">Commercial & Prix</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Vendeur assigné <span className="text-red-500">*</span></label>
                        <select name="commercial" defaultValue={draft.commercial} className="w-full p-3 border border-slate-300 rounded-md font-medium focus:ring-2 focus:ring-purple-500 outline-none text-sm">
                          {commerciaux.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-purple-900 mb-1">Prix de vente net HT (€) <span className="text-red-500">*</span></label>
                        <input type="number" name="price" required min="0" step="0.01" defaultValue={draft.price} className="w-full p-3 border-2 border-purple-300 bg-purple-50 rounded-md text-right font-black text-xl text-purple-900 focus:border-purple-600 focus:ring-0 outline-none" />
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
  );
};
