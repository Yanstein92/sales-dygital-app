import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, Building, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { db, doc, setDoc, getUserDocPath } from '../lib/firebase';
import { useApp } from '../lib/context';

interface Props {
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CompanyManagement: React.FC<Props> = ({ onClose, onShowToast }) => {
  const { userProfile, setUserProfile, userAuth } = useApp();
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  if (!userProfile || !userAuth) return null;

  const mainCompany = userProfile.companyId || 'Entreprise Principale';
  const subCompanies = userProfile.companiesList || [];
  const totalCompaniesCount = 1 + subCompanies.length;

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCompanyName.trim().toUpperCase();
    if (!trimmed) return;

    if (trimmed === mainCompany.toUpperCase() || subCompanies.map(c => c.toUpperCase()).includes(trimmed)) {
      onShowToast("Cette entreprise existe déjà.", "error");
      return;
    }

    if (totalCompaniesCount >= 2) {
      onShowToast("Limite de 2 entreprises atteinte (Forfait Gratuit).", "error");
      return;
    }

    try {
      const updatedSubCompanies = [...subCompanies, trimmed];
      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      setNewCompanyName('');
      onShowToast(`Entreprise "${trimmed}" créée avec succès.`, "success");
    } catch (err) {
      onShowToast("Erreur lors de la création de l'entreprise.", "error");
    }
  };

  const handleRenameCompany = async (index: number) => {
    const trimmed = editingValue.trim().toUpperCase();
    if (!trimmed) return;

    if (trimmed === mainCompany.toUpperCase() || subCompanies.map((c, i) => i !== index ? c.toUpperCase() : '').includes(trimmed)) {
      onShowToast("Cette entreprise existe déjà.", "error");
      return;
    }

    try {
      const updatedSubCompanies = [...subCompanies];
      updatedSubCompanies[index] = trimmed;

      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      setEditingIndex(null);
      onShowToast("Entreprise renommée avec succès.", "success");
    } catch (err) {
      onShowToast("Erreur lors de la mise à jour.", "error");
    }
  };

  const handleDeleteCompany = async (index: number) => {
    const targetName = subCompanies[index];
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'entreprise "${targetName}" de votre compte ?`)) return;

    try {
      const updatedSubCompanies = subCompanies.filter((_, i) => i !== index);
      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      onShowToast(`Entreprise "${targetName}" supprimée.`, "success");
    } catch (err) {
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2.5 rounded-lg">
              <Building size={24} className="text-blue-100" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight leading-none mb-1">Gestion des Entreprises</h3>
              <p className="text-xs text-blue-100/80 font-medium">Configurez vos filiales et marques commerciales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Main parent company */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Entreprise Principale (Parent)</p>
              <h4 className="text-base font-black text-slate-800">{mainCompany}</h4>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black uppercase tracking-wide">
              Principal
            </span>
          </div>

          {/* Sub Companies List */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Vos Entreprises & Filiales ({totalCompaniesCount}/2)</p>
            
            {subCompanies.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl font-medium">
                Aucune filiale supplémentaire configurée.
              </div>
            ) : (
              <div className="space-y-2">
                {subCompanies.map((company, index) => (
                  <div key={index} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                    {editingIndex === index ? (
                      <div className="flex items-center gap-2 w-full mr-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-black text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameCompany(index)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="text-slate-400 hover:text-slate-600 font-bold text-xs px-2 py-1"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Building size={16} className="text-slate-400" />
                          <span className="text-sm font-black text-slate-800">{company}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingIndex(index);
                              setEditingValue(company);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Renommer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(index)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Company Action or Premium warning */}
          {totalCompaniesCount >= 2 ? (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h5 className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-0.5">Offre Multi-SaaS Premium</h5>
                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                  Vous avez atteint la limite de <strong>2 entreprises</strong> pour votre compte gratuit. Débloquez les filiales illimitées, l'OCR dédié et les statistiques de groupe !
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="text-[10px] bg-indigo-200 text-indigo-800 font-black px-2 py-0.5 rounded uppercase">
                    19.99€ / mois
                  </span>
                  <button 
                    onClick={() => onShowToast("Redirection vers la passerelle de paiement (Mode démo)", "success")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-1.5 rounded-lg transition-all shadow-sm transform hover:scale-105"
                  >
                    Mettre à niveau mon forfait
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddCompany} className="flex gap-2.5">
              <div className="relative flex-1">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="text"
                  placeholder="Ex: DJ CAR SUD, KDB PRESTIGE..."
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
              >
                <Plus size={16} />
                <span>Créer</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
