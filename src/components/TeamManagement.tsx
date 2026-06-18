import React, { useState, useEffect } from 'react';
import { User, Shield, ShieldAlert, CheckCircle2, ShieldCheck, X, Plus, Loader2, Mail, Lock, UserPlus } from 'lucide-react';
import { db, collection, query, where, getDocs, updateDoc, doc } from '../lib/firebase';
import { useApp } from '../lib/context';
import { UserProfile } from '../types';

export const TeamManagement: React.FC<{ onClose: () => void, onShowToast: (m: string, t: 'success'|'error') => void }> = ({ onClose, onShowToast }) => {
  const { userProfile, teamMembers, refreshTeam } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const toggleRole = async (member: UserProfile) => {
    if (member.uid === userProfile?.uid) {
      onShowToast("Vous ne pouvez pas modifier votre propre rôle.", "error");
      return;
    }
    const newRole = member.role === 'admin' ? 'commercial' : 'admin';
    try {
      const res = await fetch(`/api/users/${member.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        onShowToast(`Rôle mis à jour: ${newRole}`, "success");
        refreshTeam();
      } else {
        onShowToast("Erreur lors de la mise à jour", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau", "error");
    }
  };

  const handleCreateCommercial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsAdding(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          companyId: userProfile.companyId,
          adminUid: userProfile.uid,
          testMode: userProfile.testMode || false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du compte');
      }
      
      onShowToast("Commercial ajouté avec succès !", "success");
      setShowAddForm(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      refreshTeam();
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Erreur lors de la création du compte.", "error");
    } finally {
      setIsAdding(false);
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          <div className="text-center text-slate-500 py-10 font-bold">
            <ShieldAlert size={48} className="mx-auto mb-4 text-slate-300" />
            Accès réservé aux administrateurs.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2"><Shield className="text-blue-400" /> Gestion de l'équipe</h2>
            <p className="text-sm text-slate-400">Entreprise: <span className="text-white font-bold">{userProfile.companyId}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Membres actuels ({teamMembers.length})</h3>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm"
                >
                  {showAddForm ? <X size={16} /> : <Plus size={16} />} 
                  <span className="hidden sm:inline">{showAddForm ? "Annuler" : "Ajouter un membre"}</span>
                </button>
              </div>

              {showAddForm && (
                <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-md mb-6 animate-fade-in-up">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><UserPlus size={18} className="text-emerald-600"/> Nouveau Commercial</h4>
                  <form onSubmit={handleCreateCommercial} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nom / Prénom</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User size={16} className="text-slate-400" />
                          </div>
                          <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Paul Commercial"/>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail size={16} className="text-slate-400" />
                          </div>
                          <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="paul@exemple.fr"/>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Mot de passe temporaire</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock size={16} className="text-slate-400" />
                          </div>
                          <input type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Générez un mot de passe (min 6 car.)"/>
                        </div>
                      </div>
                    </div>
                    <button type="submit" disabled={isAdding} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                      {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Créer le compte
                    </button>
                  </form>
                </div>
              )}

              {teamMembers.map(m => (
                <div key={m.uid} className="bg-white border text-sm border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${m.role === 'admin' ? 'bg-blue-600' : 'bg-slate-400'}`}>
                      {m.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{m.name}</h4>
                      <div className="text-slate-500 text-xs">{m.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 ${m.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                      {m.role === 'admin' ? <ShieldCheck size={12} /> : <User size={12} />} 
                      {m.role}
                    </span>
                    <button 
                      onClick={() => toggleRole(m)}
                      disabled={m.uid === userProfile.uid}
                      className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {m.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
};
