import React, { useState, useEffect } from 'react';
import { User, Shield, ShieldAlert, CheckCircle2, ShieldCheck, X, Plus, Loader2, Mail, Lock, UserPlus, KeyRound, Building, Trash2, Edit2, Check } from 'lucide-react';
import { db, doc, setDoc, getUserDocPath } from '../lib/firebase';
import { useApp } from '../lib/context';
import { UserProfile } from '../types';

export const TeamManagement: React.FC<{ onShowToast: (m: string, t: 'success'|'error') => void }> = ({ onShowToast }) => {
  const { userProfile, teamMembers, refreshTeam } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New/Edit User Form State
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'commercial', companyId: '' });

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'Administrateur';
    if (role === 'park_manager') return 'Gestionnaire Parc';
    return 'Commercial';
  };
  const getRoleColor = (role: string) => {
    if (role === 'admin') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (role === 'park_manager') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsAdding(true);

    try {
      if (editingId) {
        // Update existing user
        const updatePayload: any = { role: formData.role, name: formData.name, email: formData.email, companyId: formData.companyId };
        if (formData.password) updatePayload.password = formData.password;
        
        const response = await fetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de la mise à jour');
        }

        try { 
          await setDoc(doc(db, getUserDocPath(editingId)), { 
            role: formData.role, name: formData.name, email: formData.email, companyId: formData.companyId 
          }, { merge: true }); 
        } catch (e) {}
        
        onShowToast("Membre mis à jour avec succès !", "success");
      } else {
        // Create new user
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            adminUid: userProfile.uid,
            testMode: userProfile.testMode || false,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erreur lors de la création du compte');

        try {
          await setDoc(doc(db, getUserDocPath(data.uid)), {
            uid: data.uid,
            email: formData.email,
            name: formData.name,
            companyId: formData.companyId,
            adminUid: userProfile.uid,
            role: formData.role,
            testMode: userProfile.testMode || false,
          }, { merge: true });
        } catch (e) {}
        
        onShowToast("Membre ajouté avec succès !", "success");
      }

      setEditingId(null);
      setShowAddForm(false);
      setFormData({ name: '', email: '', password: '', role: 'commercial', companyId: '' });
      refreshTeam();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Erreur.", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (m: UserProfile) => {
    if (m.uid === userProfile?.uid) {
      onShowToast("Vous ne pouvez pas supprimer votre propre compte.", "error");
      return;
    }
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${m.name} ? Cette action est irréversible.`)) {
      try {
        const res = await fetch(`/api/users/${m.uid}`, { method: 'DELETE' });
        if (res.ok) {
          onShowToast("Membre supprimé avec succès", "success");
          refreshTeam();
        } else {
          const data = await res.json();
          onShowToast(data.error || "Erreur lors de la suppression.", "error");
        }
      } catch (err) {
        onShowToast("Erreur réseau.", "error");
      }
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center p-4 h-full">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center text-slate-500 py-10 font-bold border border-slate-200">
          <ShieldAlert size={48} className="mx-auto mb-4 text-slate-300" />
          Accès réservé aux administrateurs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Administration
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Shield className="text-indigo-400" size={28} /> Gestion de l'équipe
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
              Gérez vos commerciaux, gestionnaires de parc et leurs accès.
            </p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', email: '', password: '', role: 'commercial', companyId: userProfile.companyId || '' });
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border border-indigo-500 shrink-0"
          >
            {showAddForm && !editingId ? <X size={16} /> : <Plus size={16} />} 
            <span>{showAddForm && !editingId ? "Annuler" : "Ajouter un membre"}</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-lg animate-fade-in-up">
          <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-lg">
            {editingId ? <Edit2 size={20} className="text-indigo-600"/> : <UserPlus size={20} className="text-indigo-600"/>} 
            {editingId ? "Modifier le membre" : "Nouveau Membre d'Équipe"}
          </h3>
          <form onSubmit={handleCreateOrUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom / Prénom</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="Paul Dupont"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-slate-400" />
                  </div>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="paul@exemple.fr"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rôle d'accès</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})} 
                  className="block w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                >
                  <option value="commercial">👤 Commercial</option>
                  <option value="park_manager">⚙️ Gestionnaire de parc</option>
                  <option value="admin">🛡️ Administrateur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entreprise assignée</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building size={16} className="text-slate-400" />
                  </div>
                  <select 
                    required 
                    value={formData.companyId} 
                    onChange={e => setFormData({...formData, companyId: e.target.value})} 
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-white"
                  >
                    <option value="" disabled>Sélectionner une entreprise</option>
                    {[userProfile?.companyId, ...(userProfile?.companiesList || [])].filter(Boolean).map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mot de passe {editingId && "(Optionnel)"}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={16} className="text-slate-400" />
                  </div>
                  <input type="text" required={!editingId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} minLength={6} className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder={editingId ? "Laisser vide pour ne pas changer" : "Mot de passe (min 6)"}/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button type="button" onClick={() => {setShowAddForm(false); setEditingId(null);}} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                {editingId ? "Enregistrer" : "Créer le compte"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {teamMembers.map(m => (
          <div key={m.uid} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-inner ${
                    m.role === 'admin' ? 'bg-blue-600' : m.role === 'park_manager' ? 'bg-purple-600' : 'bg-emerald-600'
                  }`}>
                    {m.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-800 text-lg truncate">{m.name}</h4>
                    <div className="text-slate-500 text-sm truncate">{m.email}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Rôle</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border flex items-center gap-1 ${getRoleColor(m.role)}`}>
                    {m.role === 'admin' ? <ShieldCheck size={12} /> : <User size={12} />} 
                    {getRoleLabel(m.role)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Entreprise</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1"><Building size={14} className="text-slate-400"/> {m.companyId || 'Aucune'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  setFormData({ name: m.name, email: m.email, password: '', role: m.role || 'commercial', companyId: m.companyId || '' });
                  setEditingId(m.uid);
                  setShowAddForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                <Edit2 size={14} /> Modifier
              </button>

              <button 
                onClick={() => handleDelete(m)}
                disabled={m.uid === userProfile.uid}
                className="flex-none text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

