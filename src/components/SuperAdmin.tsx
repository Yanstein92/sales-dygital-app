import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, updateDoc, doc } from '../lib/firebase';
import { useApp } from '../lib/context';
import { UserProfile } from '../types';
import { ShieldAlert, Users, Building, Activity, ShieldCheck, Search, Loader2, Trash } from 'lucide-react';

export const SuperAdmin: React.FC<{
  onClose: () => void;
  onShowToast: (m: string, t: 'success' | 'error') => void;
}> = ({ onClose, onShowToast }) => {
  const { userProfile } = useApp();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
         const list = await res.json();
         setUsers(list);
      } else {
         const errorData = await res.json();
         onShowToast(errorData.error || "Erreur de requete", "error");
      }
    } catch (err) {
      console.error(err);
      onShowToast("Erreur lors de la récupération des données", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (uid: string, data: Partial<UserProfile>) => {
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
        onShowToast("Utilisateur mis à jour avec succès", "success");
      } else {
        const errorData = await res.json();
        onShowToast(errorData.error || "Erreur lors de la mise à jour", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau lors de la mise à jour", "error");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur définitivement ?")) return;
    try {
      const response = await fetch(`/api/users/${uid}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.uid !== uid));
        onShowToast("Utilisateur supprimé", "success");
      } else {
        const errorData = await response.json();
        onShowToast(errorData.error || "Erreur de suppression", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau lors de la suppression", "error");
    }
  };

  const toggleTestMode = (u: UserProfile) => {
    const isNowPremium = u.testMode; // If testMode was true, it becomes false (premium)
    const newMaxClients = isNowPremium ? 9999 : 4;
    handleUpdateUser(u.uid, { testMode: !u.testMode, maxClients: newMaxClients });
  };

  // Group users clearly
  const groupedCompanies = users.reduce((acc, user) => {
    const comp = user.companyId || 'Sans Entreprise';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(user);
    return acc;
  }, {} as Record<string, UserProfile[]>);

  const filteredCompanies = Object.keys(groupedCompanies).filter(comp => comp.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-10 pb-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-full flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header Super Admin */}
        <div className="bg-[#0f172a] p-6 text-white shrink-0 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 p-2 rounded-lg">
              <ShieldAlert size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black">SaaS Center - Super Admin</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">Gérez vos instances et clients premium</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400" />
              </div>
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une entreprise..." 
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-sm transition-colors text-white whitespace-nowrap">
              Fermer
            </button>
          </div>
        </div>

        {/* Liste des entreprises */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="animate-spin text-red-500" size={40} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredCompanies.map(companyName => {
                const members = groupedCompanies[companyName];
                const admins = members.filter(m => m.role === 'admin');
                const adminForLimits = admins[0] || members[0]; // On se base sur le premier admin pour le statut de l'entreprise
                
                return (
                  <div key={companyName} className="bg-white border text-sm border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                          <Building size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-lg uppercase">{companyName}</h3>
                          <p className="text-slate-500 text-xs font-semibold">{members.length} membre(s)</p>
                        </div>
                      </div>
                      <div>
                        {adminForLimits?.testMode ? (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black uppercase rounded-full border border-amber-200">
                            Mode Test (Limité)
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-black uppercase rounded-full shadow-sm flex items-center gap-1">
                            <ShieldCheck size={14} /> SaaS Premium
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-0 flex-1 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-4 py-2">Utilisateur</th>
                            <th className="px-4 py-2 w-24">Rôle</th>
                            <th className="px-4 py-2 w-24 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {members.map(member => (
                            <tr key={member.uid} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{member.name}</div>
                                <div className="text-slate-500 text-xs truncate max-w-[150px]" title={member.email}>{member.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                                  {member.role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                {member.role === 'admin' && (
                                  <button 
                                    onClick={() => toggleTestMode(member)}
                                    className={`text-[10px] font-bold px-2 py-1 object-contain rounded-lg transition-colors border ${
                                      member.testMode 
                                      ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' 
                                      : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                                    }`}
                                  >
                                    {member.testMode ? 'Passer Premium' : 'Rétrograder'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(member.uid)}
                                  className="text-red-500 hover:text-red-600 p-1"
                                  title="Supprimer l'utilisateur"
                                >
                                  <Trash size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
