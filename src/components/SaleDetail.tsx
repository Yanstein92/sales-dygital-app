import React, { useState } from 'react';
import { 
  ChevronLeft, Calendar, Edit2, Trash2, User, FileText, Send, 
  CreditCard, CheckCircle2, X, MessageCircle, Mail, Hash, Car,
  CheckSquare, Plane, MapPin, Store
} from 'lucide-react';
import { useApp } from '../lib/context';
import { Payment, Sale } from '../types';
import { deleteDoc, doc, setDoc, db, getUserPath } from '../lib/firebase';

interface Props {
  saleId: string;
  onBack: () => void;
  onEditSale: (sale: Sale) => void;
  onShowToast: (msg: string, type?: 'success'|'error', duration?: number) => void;
}

export const SaleDetail: React.FC<Props> = ({ saleId, onBack, onEditSale, onShowToast }) => {
  const { sales, payments, userAuth, userProfile, databaseUid } = useApp();
  const [noteInput, setNoteInput] = useState('');
  const [showApptPopup, setShowApptPopup] = useState(false);
  const [apptForm, setApptForm] = useState({ date: '', time: '10:00' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundData, setRefundData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'VIR', details: '' });

  const sale = sales.find(s => s.id === saleId);
  if (!sale || !userAuth) return null;

  const salePayments = payments.filter(p => p.saleId === saleId);
  const totalPaid = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = (Number(sale.price) + Number(sale.transport || 0)) - totalPaid;
  const isPaid = remaining <= 0;

  const handleUpdateField = async (fieldsToUpdate: Partial<Sale>) => {
    try {
      await setDoc(doc(db, getUserPath('sales', databaseUid), sale.id), fieldsToUpdate, { merge: true });
      onShowToast("Dossier mis à jour.", "success");
    } catch (err) {
      onShowToast("Erreur lors de la mise à jour.", "error");
    }
  };

  const handleReleaseStatusChange = async (newStatus: 'non_sorti' | 'programmee' | 'sorti' | 'sorti_tpd') => {
    if (newStatus === 'non_sorti') {
      if (sale.deliveryStatus === 'programmee' || sale.deliveryStatus === 'livre') {
        const isConfirmed = window.confirm(
          "Le véhicule est planifié pour une livraison ou déjà marqué comme sorti. Confirmez-vous que le véhicule n'est pas réellement sorti afin de le remettre en parc ?"
        );
        if (!isConfirmed) return;

        try {
          const logEntry = {
            user: userProfile?.name || 'Administrateur',
            action: "Sortie ANNULÉE",
            timestamp: new Date().toISOString()
          };
          const existingLog = sale.deliveryLog || [];
          await setDoc(doc(db, getUserPath('sales', databaseUid), sale.id), {
            releaseStatus: 'non_sorti',
            deliveryStatus: 'annule',
            deliveryLog: [...existingLog, logEntry]
          }, { merge: true });
          onShowToast("Véhicule remis en parc et livraison annulée.", "success");
        } catch (err) {
          onShowToast("Erreur lors de la remise en parc.", "error");
        }
        return;
      }
    }

    if (newStatus === 'sorti' || newStatus === 'sorti_tpd') {
      try {
        const logEntry = {
          user: userProfile?.name || 'Administrateur',
          action: newStatus === 'sorti_tpd' ? "Marqué comme SORTI (TPD) depuis le dossier" : "Marqué comme SORTI depuis le dossier",
          timestamp: new Date().toISOString()
        };
        const existingLog = sale.deliveryLog || [];
        await setDoc(doc(db, getUserPath('sales', databaseUid), sale.id), {
          releaseStatus: newStatus,
          deliveryStatus: 'livre',
          deliveryLog: [...existingLog, logEntry]
        }, { merge: true });
        onShowToast("Véhicule marqué comme sorti.", "success");
      } catch (err) {
        onShowToast("Erreur lors de la mise à jour.", "error");
      }
      return;
    }

    await handleUpdateField({ releaseStatus: newStatus });
  };

  const handleApplyRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleUpdateField({ 
        factureStatus: 'rembourse',
        refundAmount: Number(refundData.amount),
        refundDate: refundData.date,
        refundMethod: refundData.method,
        refundDetails: refundData.details
      });
      setShowRefundForm(false);
      onShowToast("Véhicule remboursé avec succès", "success");
    } catch (err) {
      onShowToast("Erreur lors du remboursement.", "error");
    }
  };

  const handleActionARembourser = async () => {
    await handleUpdateField({ factureStatus: 'a_rembourser' });
    setShowDeleteModal(false);
    onShowToast("Statut 'À rembourser' appliqué", "success");
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payId = Date.now().toString();
    try {
      await setDoc(doc(db, getUserPath('payments', databaseUid), payId), { 
        id: payId, 
        saleId: saleId, 
        type: fd.get('type'), 
        payer: fd.get('payer'), 
        date: fd.get('date'), 
        encaissementDate: fd.get('encaissementDate'),
        amount: parseFloat(fd.get('amount') as string),
        addedBy: userProfile?.name || userProfile?.email || userAuth?.email || 'Inconnu'
      });
      onShowToast("Paiement encaissé !");
      e.currentTarget.reset();
    } catch (error) { 
      onShowToast("Erreur de connexion.", "error"); 
    }
  };

  const handleDeleteSaleConfirm = async () => {
    try {
      for (const p of salePayments) {
        await deleteDoc(doc(db, getUserPath('payments', databaseUid), p.id));
      }
      await deleteDoc(doc(db, getUserPath('sales', databaseUid), saleId));
      onShowToast("Dossier supprimé avec succès.", "success");
      onBack();
    } catch (err) {
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const newNote = { id: Date.now().toString(), text: noteInput.trim(), date: new Date().toISOString() };
    const updatedNotes = [...(sale.notes || []), newNote];
    try {
      await handleUpdateField({ notes: updatedNotes });
      setNoteInput('');
    } catch (err) {}
  };

  const formatWhatsApp = (phone: string) => {
    if (!phone) return '#';
    let cleaned = String(phone).replace(/\D/g, ''); 
    if (cleaned.startsWith('0')) cleaned = '33' + cleaned.substring(1);
    return `https://wa.me/${cleaned}`;
  };

  const PrintablePaymentRow: React.FC<{ p: Payment }> = ({ p }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ ...p });

    const handleEdit = async () => {
      try {
        await setDoc(doc(db, getUserPath('payments', databaseUid), p.id), editData, { merge: true });
        setIsEditing(false);
        onShowToast("Paiement modifié", "success");
      } catch (err) { onShowToast("Erreur", "error"); }
    }

    const handleDelete = async () => {
      if (window.confirm("Supprimer ce paiement ?")) {
        try {
          await deleteDoc(doc(db, getUserPath('payments', databaseUid), p.id));
          onShowToast("Paiement supprimé", "success");
        } catch (err: any) {
          console.error("Delete payment error:", err);
          onShowToast(`Erreur de suppression: ${err.message || err}`, "error");
        }
      }
    }

    if (isEditing) {
      return (
        <tr className="bg-blue-50">
          <td colSpan={5} className="px-5 py-3 border-b border-slate-100">
            <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
              <select value={editData.type} onChange={(e) => setEditData({...editData, type: e.target.value})} className="p-2 border border-blue-300 rounded-md text-sm bg-white font-bold w-full sm:w-24 outline-none">
                <option value="VIR">VIR</option><option value="ESP">ESP</option><option value="CHQ">CHQ</option><option value="CB">CB</option><option value="AUTRES">AUTRES</option>
              </select>
              <input type="text" value={editData.payer} onChange={(e) => setEditData({...editData, payer: e.target.value})} className="p-2 border border-blue-300 rounded-md text-sm w-full sm:flex-1 outline-none" placeholder="Payeur" />
              <input type="date" value={editData.date} onChange={(e) => setEditData({...editData, date: e.target.value})} title="Date émission" className="p-2 border border-blue-300 rounded-md text-sm w-full sm:w-32 outline-none" />
              <input type="date" value={editData.encaissementDate || ''} onChange={(e) => setEditData({...editData, encaissementDate: e.target.value})} title="Date encaissement" className="p-2 border border-blue-300 rounded-md text-sm w-full sm:w-32 outline-none" />
              <input type="number" value={editData.amount} onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value) || 0})} className="p-2 border-2 border-blue-400 rounded-md text-base w-full sm:w-32 text-right font-black outline-none" step="0.01" />
              <div className="flex gap-1 w-full sm:w-auto justify-end">
                <button onClick={handleEdit} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"><CheckCircle2 size={18}/></button>
                <button onClick={() => setIsEditing(false)} className="bg-slate-200 text-slate-600 p-2 rounded-md hover:bg-slate-300"><X size={18}/></button>
              </div>
            </div>
          </td>
        </tr>
      );
    }
    return (
      <tr className="hover:bg-slate-50 border-b border-slate-100 group">
        <td className="px-5 py-4"><span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-xs font-black border border-slate-200">{p.type}</span></td>
        <td className="px-5 py-4 text-slate-800 font-medium text-base">
          <div>{p.payer}</div>
          {p.addedBy && <div className="text-[10px] text-slate-400 font-normal italic mt-0.5">Par {p.addedBy}</div>}
        </td>
        <td className="px-5 py-4 text-slate-500 font-medium text-sm">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
        <td className="px-5 py-4 text-slate-700 font-bold text-sm bg-green-50/50">{p.encaissementDate ? new Date(p.encaissementDate).toLocaleDateString('fr-FR') : <span className="text-slate-400 font-normal italic">En attente</span>}</td>
        <td className="px-5 py-4 text-right font-black text-slate-800 text-lg whitespace-nowrap">{Number(p.amount).toLocaleString()} €</td>
        <td className="px-5 py-4 text-center">
          <div className="flex justify-center gap-2">
            <button onClick={() => setIsEditing(true)} className="text-blue-500 hover:text-blue-700 p-1.5 bg-blue-50 rounded-md transition-all hover:scale-105"><Edit2 size={16} /></button>
            <button onClick={handleDelete} className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded-md transition-all hover:scale-105"><Trash2 size={16} /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors font-bold">
          <ChevronLeft size={20} /><span>Retour aux dossiers</span>
        </button>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Release and Invoice Controls */}
          {sale.factureStatus !== 'facture' ? (
             <button onClick={() => handleUpdateField({ factureStatus: 'facture' })} className="flex items-center gap-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-2 rounded-md font-bold text-sm">
               <CheckSquare size={16} /> Marquer Facturé
             </button>
          ) : (
            <>
              <button onClick={() => handleUpdateField({ factureStatus: 'non_facture' })} className="flex items-center gap-2 text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-md font-bold text-sm">
                Annuler Facture
              </button>
              {sale.deliveryStatus !== 'livre' && (
                <button onClick={() => window.location.hash = '#delivery_calendar?planSaleId=' + saleId} className="flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-md transition-colors font-bold text-sm shadow-sm">
                  <Calendar size={16} /> {sale.deliveryStatus === 'programmee' ? 'Reprogrammer' : 'Programmer Livraison'}
                </button>
              )}
            </>
          )}

          <select 
            className={`border rounded-md px-3 py-2 text-sm font-bold outline-none cursor-pointer ${
              !isPaid 
                ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-blue-200 text-blue-700 focus:ring-2 focus:ring-blue-500'
            }`}
            value={sale.releaseStatus || 'non_sorti'}
            onChange={(e) => handleReleaseStatusChange(e.target.value as any)}
            disabled={!isPaid}
            title={!isPaid ? "Le véhicule doit être soldé pour gérer la sortie" : "Gestion de la sortie"}
          >
             <option value="non_sorti">Parc (Non sorti)</option>
             <option value="programmee">Sortie Programmée</option>
             <option value="sorti">Véhicule Sorti</option>
             <option value="sorti_tpd">Véhicule Sorti (TPD)</option>
          </select>

          {sale.factureStatus === 'a_rembourser' && (
            <button onClick={() => setShowRefundForm(true)} className="flex items-center justify-center gap-2 text-white bg-amber-500 hover:bg-amber-600 px-3 py-2 rounded-md transition-colors font-bold text-sm shadow-sm">
              Rembourser le client
            </button>
          )}

          <button onClick={() => onEditSale(sale)} className="flex items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors font-bold text-sm border border-blue-200">
            <Edit2 size={16} /> Modifier
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-md transition-colors font-bold text-sm border border-red-200">
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up border-2 border-red-100">
            <h3 className="text-xl font-black text-slate-800 mb-4 pb-4 border-b border-slate-100 flex items-center gap-2">
              <Trash2 className="text-red-500" />
              Supprimer le dossier
            </h3>
            <p className="text-slate-600 font-medium text-sm mb-6">
              Que souhaitez-vous faire avec ce dossier véhicule ? Vous pouvez le supprimer complètement de la base de données, ou le marquer "À rembourser".
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleActionARembourser}
                className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Passer en "À rembourser"
              </button>
              <button 
                onClick={handleDeleteSaleConfirm}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                Supprimer complètement
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors mt-2"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}



      {sale.factureStatus === 'rembourse' && (
        <div className="bg-amber-100 border-l-4 border-amber-500 rounded-r-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 rounded-full p-1.5 text-white"><CheckSquare size={18} /></div>
            <div>
              <h4 className="text-amber-900 font-black text-sm">Dossier Remboursé</h4>
              <p className="text-amber-800 text-xs font-medium mt-0.5">
                Remboursement de <span className="font-bold">{sale.refundAmount}€</span> le {sale.refundDate ? new Date(sale.refundDate).toLocaleDateString('fr-FR') : '-'} via {sale.refundMethod}
                {sale.refundDetails && <span className="block italic opacity-80 mt-1">Motif : {sale.refundDetails}</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col">
                <h3 className="font-black text-slate-800 text-2xl flex items-center space-x-3">
                  <User size={24} className="text-blue-600"/>
                  <span>{sale.clientName}</span>
                  <span className="text-sm bg-slate-200 text-slate-600 px-2.5 py-1 rounded-md ml-3 font-mono">BDC #{sale.bdcNumber}</span>
                </h3>
                <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                  {sale.phone && <a href={formatWhatsApp(sale.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><MessageCircle size={14} className="mr-1.5" /> {sale.phone}</a>}
                  {sale.email && <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold"><Mail size={14} className="mr-1.5" /> {sale.email}</span>}
                  {sale.ref && <span className="inline-flex items-center text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold"><Hash size={14} className="mr-1" /> Réf: {sale.ref}</span>}
                </div>
                {((sale as any).address || (sale as any).zipCode || (sale as any).city) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-slate-600 text-xs font-bold">
                    <span className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      📍 {[(sale as any).address, (sale as any).zipCode, (sale as any).city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <span className={`px-4 py-1.5 rounded-lg text-sm font-black shadow-sm text-center ${sale.company === 'KDB AUTO' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{sale.company}</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Vendeur: {sale.commercial}</span>
                {sale.saleMode && (
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1.5 rounded-md shadow-sm border border-slate-200">
                    {sale.saleMode === 'export' && <Plane size={14} className="text-blue-500" />}
                    {sale.saleMode === 'locale' && <MapPin size={14} className="text-emerald-500" />}
                    {sale.saleMode === 'marchand' && <Store size={14} className="text-purple-500" />}
                    Vente {sale.saleMode}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                 <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2"><Car size={16}/> Véhicule</h4>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <span className="text-slate-500 font-medium text-sm">Modèle</span>
                     <span className="font-black text-slate-800">{sale.marque} {sale.modele}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <span className="text-slate-500 font-medium text-sm">Couleur</span>
                     <span className="font-bold text-slate-700">{sale.color}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <span className="text-slate-500 font-medium text-sm">Immatriculation</span>
                     <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">{sale.plaque || '-'}</span>
                   </div>
                 </div>
               </div>
               
               <div className="space-y-4">
                 <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider opacity-0 hidden md:block">Infos</h4>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <span className="text-slate-500 font-medium text-sm">Mise en Circ.</span>
                     <span className="font-bold text-slate-700">{(sale as any).mec || '-'}</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                     <span className="text-slate-500 font-medium text-sm">VIN</span>
                     <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{sale.vin || 'Non renseigné'}</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
              <h3 className="font-black text-amber-900 flex items-center space-x-2 text-sm uppercase tracking-wider">
                <FileText size={16} className="text-amber-600"/>
                <span>Notes & Suivi</span>
              </h3>
            </div>
            <div className="p-6">
               <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                 {(!sale.notes || sale.notes.length === 0) ? (
                   <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                     <p className="text-sm text-slate-400 font-medium">Aucune note enregistrée pour ce dossier.</p>
                   </div>
                 ) : (
                   sale.notes.map(note => (
                     <div key={note.id} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col hover:border-amber-200 transition-colors">
                       <span className="text-[10px] text-slate-400 font-black mb-1.5 uppercase tracking-wider">{new Date(note.date).toLocaleString('fr-FR')}</span>
                       <p className="text-sm text-slate-700 font-medium leading-relaxed">{note.text}</p>
                     </div>
                   ))
                 )}
               </div>
               <form onSubmit={handleAddNote} className="flex gap-2">
                 <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Écrire une note ou une information..." className="flex-1 p-3 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-shadow" />
                 <button type="submit" disabled={!noteInput.trim()} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-black transition-colors disabled:opacity-50 shadow-sm">Ajouter</button>
               </form>
            </div>
          </div>
        </div>

        {/* Right Column: Finance */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
             <div className="p-6 flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-transparent border-b border-slate-100 relative">
               {sale.discountAmount && sale.discountAmount > 0 ? (
                 <div className="absolute top-4 right-4 bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                   Remise : -{sale.discountAmount} €
                 </div>
               ) : null}
               {sale.saleMode === 'locale' ? (
                 <div className="absolute top-4 left-4 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                   HT : {(Number(sale.price) / (1 + (sale.tvaRate || 20) / 100)).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €
                 </div>
               ) : null}
               {sale.initialPrice && sale.initialPrice > 0 && sale.initialPrice !== sale.price ? (
                  <p className="text-xs font-bold text-slate-400 line-through mb-1">{sale.initialPrice.toLocaleString()} €</p>
               ) : null}
               <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-2">
                 Total Facturé {sale.saleMode === 'locale' ? 'TTC' : 'HT'}
               </p>
               <p className="text-5xl font-black text-blue-950 whitespace-nowrap tracking-tight">{(Number(sale.price) + Number(sale.transport || 0)).toLocaleString()} €</p>
             </div>
             
             <div className="p-6 grid grid-cols-2 gap-4 bg-slate-50/50">
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Encaissé</p>
                 <p className="text-xl font-black text-emerald-600">{totalPaid.toLocaleString()} €</p>
               </div>
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Reste à payer</p>
                 <p className={`text-xl font-black ${remaining <= 0 ? 'text-slate-300' : 'text-red-600'}`}>{remaining.toLocaleString()} €</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center space-x-2 text-lg">
            <CreditCard size={20} className="text-emerald-400"/>
            <span>Enregistrement des Paiements</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-3 w-24">Moyen</th>
                <th className="px-6 py-3">Payeur / Note</th>
                <th className="px-5 py-3 w-32">Date Emission/Virement</th>
                <th className="px-5 py-3 w-32">Date Encaissement</th>
                <th className="px-5 py-3 w-40 text-right">Montant</th>
                <th className="px-5 py-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salePayments.map((p) => <PrintablePaymentRow key={p.id} p={p} />)}
              
              {remaining > 0 && (
                <tr className="bg-emerald-50/30">
                  <td colSpan={6} className="px-4 py-5 border-t border-slate-200">
                    <form onSubmit={handleAddPayment} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                      <select name="type" className="p-2.5 border border-emerald-300 rounded-md text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto" required>
                        <option value="VIR">VIR</option>
                        <option value="ESP">ESP</option>
                        <option value="CHQ">CHQ</option>
                        <option value="CB">CB</option>
                        <option value="AUTRES">AUTRES</option>
                      </select>
                      <input type="text" name="payer" placeholder="Payeur ou info banque" className="p-2.5 border border-emerald-300 rounded-md text-sm flex-1 outline-none focus:ring-2 focus:ring-emerald-500 min-w-[150px]" defaultValue={sale.clientName} required />
                      
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Date Émission / VIR</label>
                        <input type="date" name="date" className="p-2.5 border border-emerald-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500" defaultValue={new Date().toISOString().split('T')[0]} required />
                      </div>
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Date Encaissement</label>
                        <input type="date" name="encaissementDate" className="p-2.5 border border-emerald-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>

                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] uppercase font-bold text-transparent select-none">-</label>
                        <input type="number" name="amount" placeholder="Montant" className="p-2.5 border-2 border-emerald-400 rounded-md text-lg w-32 text-right font-black outline-none focus:border-emerald-600 focus:ring-0" max={remaining} step="0.01" required />
                      </div>
                      
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] uppercase font-bold text-transparent select-none">-</label>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-md text-sm font-black transition-colors shadow-sm w-full sm:w-auto">Encaisser</button>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right font-black text-slate-900 uppercase text-xl">Reste à payer</td>
                <td className={`px-6 py-4 text-right font-black text-2xl whitespace-nowrap ${remaining === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{remaining.toLocaleString()} €</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
