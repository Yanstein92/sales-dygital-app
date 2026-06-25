import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Edit3, Building, Sparkles, CheckCircle2, ShieldAlert, Upload, Image as ImageIcon } from 'lucide-react';
import { db, doc, setDoc, getUserDocPath } from '../lib/firebase';
import { useApp } from '../lib/context';
import { CompanyDetails } from '../types';

interface Props {
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CompanyManagement: React.FC<Props> = ({ onClose, onShowToast }) => {
  const { userProfile, setUserProfile, userAuth } = useApp();
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newSiret, setNewSiret] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');

  // Editing state
  const [editingCompany, setEditingCompany] = useState<string | null>(null); // name of company being edited
  const [editSiret, setEditSiret] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editName, setEditName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  if (!userProfile || !userAuth) return null;

  const mainCompany = userProfile.companyId || 'Entreprise Principale';
  const subCompanies = userProfile.companiesList || [];
  const companiesDetails = userProfile.companiesDetails || [];
  const totalCompaniesCount = 1 + subCompanies.length;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      onShowToast("Le logo est trop lourd (max 1.5Mo)", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (isEdit) {
          setEditLogoUrl(reader.result);
        } else {
          setNewLogoUrl(reader.result);
        }
        onShowToast("Logo importé avec succès !", "success");
      }
    };
    reader.readAsDataURL(file);
  };

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
      
      // Create company details
      const newDetail: CompanyDetails = {
        name: trimmed,
        siret: newSiret.trim(),
        address: newAddress.trim(),
        logoUrl: newLogoUrl
      };

      const updatedDetails = [...companiesDetails.filter(c => c.name.toUpperCase() !== trimmed), newDetail];

      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies,
        companiesDetails: updatedDetails
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      
      // Reset form
      setNewCompanyName('');
      setNewSiret('');
      setNewAddress('');
      setNewLogoUrl('');
      onShowToast(`Entreprise "${trimmed}" créée avec succès.`, "success");
    } catch (err) {
      onShowToast("Erreur lors de la création de l'entreprise.", "error");
    }
  };

  const startEdit = (companyName: string) => {
    const detail = companiesDetails.find(c => c.name.toUpperCase() === companyName.toUpperCase()) || { name: companyName };
    setEditingCompany(companyName);
    setEditName(companyName);
    setEditSiret(detail.siret || '');
    setEditAddress(detail.address || '');
    setEditLogoUrl(detail.logoUrl || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCompany) return;
    const trimmedName = editName.trim().toUpperCase();
    if (!trimmedName) return;

    try {
      let updatedSubCompanies = [...subCompanies];
      let updatedMainCompany = mainCompany;

      // If name changed
      if (editingCompany.toUpperCase() !== trimmedName) {
        if (editingCompany.toUpperCase() === mainCompany.toUpperCase()) {
          onShowToast("Pour renommer l'entreprise principale, veuillez utiliser le raccourci dans l'en-tête.", "error");
          return;
        } else {
          // It's a sub company
          if (subCompanies.map(c => c.toUpperCase()).includes(trimmedName)) {
            onShowToast("Ce nom d'entreprise est déjà utilisé.", "error");
            return;
          }
          const idx = subCompanies.findIndex(c => c.toUpperCase() === editingCompany.toUpperCase());
          if (idx !== -1) {
            updatedSubCompanies[idx] = trimmedName;
          }
        }
      }

      // Build updated details list
      const updatedDetail: CompanyDetails = {
        name: trimmedName,
        siret: editSiret.trim(),
        address: editAddress.trim(),
        logoUrl: editLogoUrl
      };

      // Filter out both the old and new names to avoid duplicates, then add the new details
      const filteredDetails = companiesDetails.filter(
        c => c.name.toUpperCase() !== editingCompany.toUpperCase() && c.name.toUpperCase() !== trimmedName
      );
      const updatedDetails = [...filteredDetails, updatedDetail];

      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies,
        companiesDetails: updatedDetails
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      setEditingCompany(null);
      onShowToast("Informations de l'entreprise mises à jour.", "success");
    } catch (err) {
      onShowToast("Erreur lors de la sauvegarde.", "error");
    }
  };

  const handleDeleteCompany = async (companyName: string) => {
    if (companyName.toUpperCase() === mainCompany.toUpperCase()) {
      onShowToast("Impossible de supprimer l'entreprise principale.", "error");
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'entreprise "${companyName}" de votre compte ?`)) return;

    try {
      const updatedSubCompanies = subCompanies.filter(c => c.toUpperCase() !== companyName.toUpperCase());
      const updatedDetails = companiesDetails.filter(c => c.name.toUpperCase() !== companyName.toUpperCase());

      const updatedProfile = {
        ...userProfile,
        companiesList: updatedSubCompanies,
        companiesDetails: updatedDetails
      };

      await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      onShowToast(`Entreprise "${companyName}" supprimée.`, "success");
    } catch (err) {
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-fade-in-up my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2.5 rounded-lg">
              <Building size={24} className="text-blue-100" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight leading-none mb-1 font-sans">Gestion des Entreprises</h3>
              <p className="text-xs text-blue-100/80 font-medium">Configurez l'identité, SIRET, adresses et logos de vos filiales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* List of Companies */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vos Entreprises ({totalCompaniesCount}/2)</p>
            
            {[mainCompany, ...subCompanies].map((companyName, idx) => {
              const isMain = idx === 0;
              const detail = companiesDetails.find(c => c.name.toUpperCase() === companyName.toUpperCase()) || { name: companyName };
              
              return (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Logo Section */}
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      {detail.logoUrl ? (
                        <img src={detail.logoUrl} alt={companyName} className="w-full h-full object-contain" />
                      ) : (
                        <Building size={24} className="text-slate-400" />
                      )}
                    </div>
                    {/* Details Section */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-base font-black text-slate-800 tracking-tight truncate">{companyName}</h4>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          isMain ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isMain ? 'Principal' : 'Filiale'}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-500 font-medium">
                          <span className="font-bold text-slate-600">SIRET : </span>
                          {detail.siret ? <span className="font-mono text-slate-700">{detail.siret}</span> : <span className="italic text-slate-400">Non renseigné</span>}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate max-w-sm">
                          <span className="font-bold text-slate-600">Adresse : </span>
                          {detail.address ? <span className="text-slate-700">{detail.address}</span> : <span className="italic text-slate-400">Non renseignée</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => startEdit(companyName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={14} />
                      Modifier
                    </button>
                    {!isMain && (
                      <button
                        onClick={() => handleDeleteCompany(companyName)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        title="Supprimer la filiale"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit Company Drawer / Block */}
          {editingCompany && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Modifier les détails de : <span className="text-blue-600 font-black">{editingCompany}</span>
                </h4>
                <button onClick={() => setEditingCompany(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Logo Upload Edit */}
                <div className="md:col-span-2 flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-xl">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {editLogoUrl ? (
                      <img src={editLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon size={28} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">Logo de l'entreprise</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Upload size={12} />
                        Télécharger
                      </button>
                      {editLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditLogoUrl('')}
                          className="text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, true)}
                      className="hidden"
                    />
                  </div>
                </div>

                {editingCompany.toUpperCase() !== mainCompany.toUpperCase() && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nom commercial</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Numéro SIRET</label>
                  <input
                    type="text"
                    placeholder="Ex: 123 456 789 00012"
                    value={editSiret}
                    onChange={(e) => setEditSiret(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Adresse complète</label>
                  <input
                    type="text"
                    placeholder="Ex: 12 rue de Paris, 75001"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition-all shadow cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          )}

          {/* Add Company Action or Premium warning */}
          {!editingCompany && (
            totalCompaniesCount >= 2 ? (
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
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-1.5 rounded-lg transition-all shadow-sm transform hover:scale-105 cursor-pointer"
                    >
                      Mettre à niveau mon forfait
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddCompany} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Ajouter une filiale</h4>
                
                {/* Logo input */}
                <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-xl">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {newLogoUrl ? (
                      <img src={newLogoUrl} alt="Nouveau logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon size={28} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-bold text-slate-700">Logo de l'entreprise</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Upload size={12} />
                        Sélectionner logo
                      </button>
                      {newLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setNewLogoUrl('')}
                          className="text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, false)}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nom commercial</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: DJ CAR SUD"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SIRET</label>
                    <input
                      type="text"
                      placeholder="Ex: 123 456 789 00012"
                      value={newSiret}
                      onChange={(e) => setNewSiret(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Adresse</label>
                    <input
                      type="text"
                      placeholder="Ex: 12 rue de Paris, 75001"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Créer la filiale</span>
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
};
