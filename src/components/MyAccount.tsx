import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../lib/context';
import { ArrowLeft, User, Mail, Phone, Shield, Lock, Camera, Upload, Check, Loader2, KeyRound, FileText } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, getUserDocPath } from '../lib/firebase';

interface MyAccountProps {
  onBack: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

const PRESET_AVATARS = [
  { emoji: '🚗', label: 'Voiture', bg: 'bg-blue-100 border-blue-200 text-blue-800' },
  { emoji: '💼', label: 'Business', bg: 'bg-slate-100 border-slate-200 text-slate-800' },
  { emoji: '🚀', label: 'Fusée', bg: 'bg-indigo-100 border-indigo-200 text-indigo-800' },
  { emoji: '🎯', label: 'Cible', bg: 'bg-rose-100 border-rose-200 text-rose-800' },
  { emoji: '🌟', label: 'Étoile', bg: 'bg-amber-100 border-amber-200 text-amber-800' },
  { emoji: '🐼', label: 'Panda', bg: 'bg-emerald-100 border-emerald-200 text-emerald-800' },
  { emoji: '⚡', label: 'Éclair', bg: 'bg-purple-100 border-purple-200 text-purple-800' },
  { emoji: '👑', label: 'Couronne', bg: 'bg-yellow-100 border-yellow-200 text-yellow-800' },
];

export const MyAccount: React.FC<MyAccountProps> = ({ onBack, onShowToast }) => {
  const { userProfile, setUserProfile, userAuth, databaseUid } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [name, setName] = useState(userProfile?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  
  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // PDF templates states
  const [selectedTemplate, setSelectedTemplate] = useState<'bdc' | 'discharge'>('bdc');
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [templatesConfig, setTemplatesConfig] = useState({
    bdcTitle: 'BON DE COMMANDE',
    bdcClientSigMention: 'Lu et approuvé',
    bdcFooterNote: '',
    
    dischargeTitle: 'DÉCHARGE DE RESPONSABILITÉ & REMISE DES CLÉS',
    dischargeText: 'Je soussigné(e), [Client], certifie avoir pris livraison du véhicule [Marque] [Modèle] immatriculé [Plaque] (N° VIN : [VIN]) en parfait état et muni de tous ses documents administratifs. Par la présente, je donne décharge entière, définitive et sans réserve à la société [Entreprise] et renonce à tout recours ultérieur.',
    dischargeSigMention: 'Bon pour décharge de sortie',
    dischargeFooterNote: ''
  });

  // Statuses
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const fetchTemplatesConfig = async () => {
      if (!databaseUid) return;
      try {
        const docRef = doc(db, getUserDocPath(databaseUid) + '/settings/pdf_templates_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setTemplatesConfig(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        console.error("Error fetching pdf templates config:", error);
      }
    };
    fetchTemplatesConfig();
  }, [databaseUid]);

  if (!userProfile) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
        <p className="text-slate-500 font-bold">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    );
  }

  // Handle Photo upload and conversion to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Limit size to ~800kb for Firestore safety
      onShowToast("L'image est trop volumineuse. Veuillez choisir une image de moins de 800 ko.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        onShowToast("Photo chargée avec succès. Cliquez sur Sauvegarder pour l'enregistrer.", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle saving details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast("Le nom d'utilisateur ne peut pas être vide.", "error");
      return;
    }

    try {
      setIsSavingDetails(true);

      const updatedData = {
        name: name.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl
      };

      // Call API PUT endpoint on the server to update profile
      const response = await fetch(`/api/users/${userProfile.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        // Also update local context state
        setUserProfile(prev => prev ? { ...prev, ...updatedData } : null);
        onShowToast("Détails du compte mis à jour avec succès !", "success");
      } else {
        const err = await response.json();
        onShowToast(`Erreur : ${err.error || "Mise à jour échouée."}`, "error");
      }
    } catch (error) {
      console.error("Error saving profile details:", error);
      onShowToast("Une erreur est survenue lors de la sauvegarde.", "error");
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Handle saving password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      onShowToast("Veuillez saisir un mot de passe.", "error");
      return;
    }
    if (newPassword.length < 6) {
      onShowToast("Le mot de passe doit comporter au moins 6 caractères.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      onShowToast("Les mots de passe ne correspondent pas.", "error");
      return;
    }

    try {
      setIsSavingPassword(true);

      // Call API PUT endpoint with password update
      const response = await fetch(`/api/users/${userProfile.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });

      if (response.ok) {
        onShowToast("Votre mot de passe a été modifié avec succès.", "success");
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await response.json();
        onShowToast(`Erreur : ${err.error || "Mise à jour échouée."}`, "error");
      }
    } catch (error) {
      console.error("Error saving password:", error);
      onShowToast("Une erreur est survenue lors du changement de mot de passe.", "error");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const renderCurrentAvatar = () => {
    if (avatarUrl) {
      if (avatarUrl.startsWith('data:image')) {
        return (
          <img 
            src={avatarUrl} 
            alt="Profile Avatar" 
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl"
            referrerPolicy="no-referrer"
          />
        );
      }
      // If it's a preset emoji
      const selectedPreset = PRESET_AVATARS.find(p => p.emoji === avatarUrl);
      return (
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-xl ${selectedPreset?.bg || 'bg-gradient-to-br from-blue-500 to-indigo-700 text-white'}`}>
          {avatarUrl}
        </div>
      );
    }

    // Default letter avatar
    return (
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center font-black text-2xl text-white border-4 border-white shadow-xl">
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer shadow-xs"
          title="Retour"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Mon Compte</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Configurez et modifiez vos informations personnelles</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar customization */}
        <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm p-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-6 self-start">Photo de profil & Avatar</p>
          
          <div className="relative group">
            {renderCurrentAvatar()}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full border-2 border-white shadow-md transition-all cursor-pointer"
              title="Importer une image"
            >
              <Camera size={14} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <p className="text-slate-800 font-black text-base mt-4">{name}</p>
          <p className="text-slate-400 text-xs font-semibold">{userProfile.email}</p>
          
          <span className="mt-2 text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
            {userProfile.role === 'admin' ? 'Administrateur' : userProfile.role === 'park_manager' ? 'Park Manager' : 'Commercial'}
          </span>

          <div className="w-full h-px bg-slate-100 my-6"></div>

          <div className="w-full text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Sélectionner un avatar prédéfini</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar.emoji}
                  type="button"
                  onClick={() => setAvatarUrl(avatar.emoji)}
                  className={`h-11 rounded-xl flex items-center justify-center text-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    avatarUrl === avatar.emoji 
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md ' + avatar.bg
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                  title={avatar.label}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl('')}
                className="mt-4 text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
              >
                Réinitialiser par défaut
              </button>
            )}
          </div>
        </div>

        {/* Middle Column: Personal Details Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm p-6">
            <p className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-6">Informations personnelles</p>
            
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Nom d'utilisateur</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <User size={14} />
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700"
                      placeholder="Ex: Yanis Khelifi"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Numéro de téléphone</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Phone size={14} />
                    </span>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700"
                      placeholder="Ex: +33 6 12 34 56 78"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email (Read-Only) */}
                <div className="space-y-1.5 opacity-70">
                  <label className="text-xs font-bold text-slate-400">Adresse email (Non modifiable)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      value={userProfile.email}
                      disabled
                      className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl w-full text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Company ID (Read-Only) */}
                <div className="space-y-1.5 opacity-70">
                  <label className="text-xs font-bold text-slate-400">Entreprise affiliée</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Shield size={14} />
                    </span>
                    <input
                      type="text"
                      value={userProfile.companyId}
                      disabled
                      className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl w-full text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {isSavingDetails ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Sauvegarder les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Password Security Form */}
          <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <KeyRound size={16} className="text-slate-500" />
              <p className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Sécurité du mot de passe</p>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Nouveau mot de passe</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Lock size={14} />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700"
                      placeholder="Minimum 6 caractères"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Lock size={14} />
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700"
                      placeholder="Saisir à nouveau"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Mise à jour...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Mettre à jour le mot de passe</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
