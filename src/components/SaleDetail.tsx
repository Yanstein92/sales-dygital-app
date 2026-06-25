import React, { useState } from 'react';
import { 
  ChevronLeft, Calendar, Edit2, Trash2, User, FileText, Send, 
  CreditCard, CheckCircle2, X, MessageCircle, Mail, Hash, Car,
  CheckSquare
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
            <button onClick={() => handleUpdateField({ factureStatus: 'non_facture' })} className="flex items-center gap-2 text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-md font-bold text-sm">
               Annuler Facture
             </button>
          )}

          <select 
            className={`border rounded-md px-3 py-2 text-sm font-bold outline-none cursor-pointer ${
              !isPaid 
                ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-white border-blue-200 text-blue-700 focus:ring-2 focus:ring-blue-500'
            }`}
            value={sale.releaseStatus || 'non_sorti'}
            onChange={(e) => handleUpdateField({ releaseStatus: e.target.value as any })}
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

      {showRefundForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up border-2 border-amber-100">
            <h3 className="text-xl font-black text-slate-800 mb-4 pb-4 border-b border-slate-100">Détails du Remboursement</h3>
            <form onSubmit={handleApplyRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Montant Remboursé (€)</label>
                <input type="number" step="0.01" required value={refundData.amount} onChange={e => setRefundData({...refundData, amount: e.target.value})} className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" required value={refundData.date} onChange={e => setRefundData({...refundData, date: e.target.value})} className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Moyen</label>
                  <select required value={refundData.method} onChange={e => setRefundData({...refundData, method: e.target.value})} className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="VIR">Virement</option>
                    <option value="CB">Carte Bancaire</option>
                    <option value="CHQ">Chèque</option>
                    <option value="ESP">Espèces</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Détails / Motif</label>
                <textarea required value={refundData.details} onChange={e => setRefundData({...refundData, details: e.target.value})} className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none min-h-[80px]" placeholder="Motif du remboursement..."></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowRefundForm(false)} className="text-slate-600 font-bold hover:text-slate-800 px-4 py-2">Annuler</button>
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2 rounded-lg shadow-sm">Valider</button>
              </div>
            </form>
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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col">
            <h3 className="font-black text-slate-800 text-2xl flex items-center space-x-3">
              <User size={24} className="text-blue-600"/>
              <span>{sale.clientName}</span>
              <span className="text-sm bg-slate-200 text-slate-600 px-2 py-1 rounded ml-3 font-mono">BDC #{sale.bdcNumber}</span>
            </h3>
            <div className="mt-2 pl-9 flex items-center gap-3 flex-wrap">
              {sale.phone && <a href={formatWhatsApp(sale.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-xs font-bold"><MessageCircle size={14} className="mr-1.5" /> {sale.phone}</a>}
              {sale.email && <span className="inline-flex items-center text-amber-700 bg-amber-100 px-3 py-1 rounded-full text-xs font-bold"><Mail size={14} className="mr-1.5" /> {sale.email}</span>}
              {sale.ref && <span className="inline-flex items-center text-blue-700 bg-blue-100 px-3 py-1 rounded-full text-xs font-bold"><Hash size={14} className="mr-1" /> Réf: {sale.ref}</span>}
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <span className={`px-4 py-1.5 rounded-full text-sm font-black shadow-sm text-center ${sale.company === 'KDB AUTO' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{sale.company}</span>
            <span className="text-xs font-bold text-slate-500">Commercial: {sale.commercial}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
           <div className="p-0 border-r border-slate-100">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100"><td className="py-4 px-6 font-bold text-slate-500 bg-slate-50 w-1/3">Véhicule</td><td className="py-4 px-6 font-black text-blue-900 text-base">{sale.marque} {sale.modele} <span className="text-xs text-slate-500 font-bold ml-1">({sale.color})</span></td></tr>
                <tr className="border-b border-slate-100"><td className="py-4 px-6 font-bold text-slate-500 bg-slate-50">M.E.C / Année</td><td className="py-4 px-6 text-slate-800 font-bold text-sm">{(sale as any).mec || '-'}</td></tr>
                <tr>
                  <td className="py-4 px-6 font-bold text-slate-500 bg-slate-50">Immat / VIN</td>
                  <td className="py-4 px-6 text-slate-800 font-mono text-sm font-bold flex flex-col gap-1">
                    <span>{sale.plaque || '-'}</span>
                    <span className="text-slate-500 font-normal text-xs break-all bg-slate-100 px-2 py-1 rounded">{sale.vin || 'Non renseigné'}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-0 flex flex-col items-center justify-center bg-blue-50/30">
             <div className="text-center group">
               <p className="text-sm font-bold text-slate-500 mb-1">TOTAL FACTURÉ HT</p>
               <p className="text-4xl font-black text-blue-900 whitespace-nowrap">{(Number(sale.price) + Number(sale.transport || 0)).toLocaleString()} €</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="bg-amber-50 px-6 py-3 border-b border-amber-200 flex justify-between items-center">
          <h3 className="font-bold text-amber-900 flex items-center space-x-2 text-sm">
            <FileText size={16} className="text-amber-600"/>
            <span>Notes et Suivi de dossier</span>
          </h3>
        </div>
        <div className="p-5 bg-amber-50/30">
           <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2">
             {(!sale.notes || sale.notes.length === 0) ? (
               <p className="text-sm text-slate-500 italic">Aucune note enregistrée pour ce dossier.</p>
             ) : (
               sale.notes.map(note => (
                 <div key={note.id} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm flex flex-col">
                   <span className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">{new Date(note.date).toLocaleString('fr-FR')}</span>
                   <p className="text-sm text-slate-800 font-medium">{note.text}</p>
                 </div>
               ))
             )}
           </div>
           <form onSubmit={handleAddNote} className="flex gap-2">
             <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Écrire une note ou une information..." className="flex-1 p-2.5 text-sm font-medium border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none" />
             <button type="submit" disabled={!noteInput.trim()} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-md text-sm font-bold transition-colors disabled:opacity-50">Ajouter</button>
           </form>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6">
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
