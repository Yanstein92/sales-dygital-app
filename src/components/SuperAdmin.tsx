import React, { useState, useEffect } from 'react';
import { db, doc, setDoc, getUserDocPath, collectionGroup, getDocs } from '../lib/firebase';
import { useApp } from '../lib/context';
import { UserProfile, Sale } from '../types';
import { ShieldAlert, Users, Building, Activity, ShieldCheck, Search, Loader2, Trash, Settings, LogOut, ChevronRight, Edit2, Mail, CreditCard, LayoutDashboard, CheckSquare, Download, KeyRound } from 'lucide-react';

export const SuperAdmin: React.FC<{
  onClose: () => void;
  onShowToast: (m: string, t: 'success' | 'error') => void;
}> = ({ onClose, onShowToast }) => {
  const { userProfile } = useApp();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'clients' | 'accounts' | 'settings'>('accounts');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'commercial'>('commercial');
  const [isAddingUser, setIsAddingUser] = useState(false);

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

  const fetchAllSales = async () => {
    setIsLoadingSales(true);
    try {
      const salesQuery = collectionGroup(db, 'sales');
      const salesQuerySnapshot = await getDocs(salesQuery);
      const salesData = salesQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setAllSales(salesData);
    } catch (e) {
      console.error(e);
      onShowToast("Erreur lors de la récupération de tous les clients", "error");
    } finally {
      setIsLoadingSales(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAllSales();
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
        // Also update the canvas store so the app picks it up
        try {
          await setDoc(doc(db, getUserDocPath(uid)), data, { merge: true });
        } catch(e) {}

        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
        onShowToast("Profil mis à jour avec succès", "success");
      } else {
        const errorData = await res.json();
        onShowToast(errorData.error || "Erreur lors de la mise à jour", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau lors de la mise à jour", "error");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur définitivement ? (Si c'est un admin, l'entreprise risque de perdre l'accès)")) return;
    try {
      const response = await fetch(`/api/users/${uid}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.uid !== uid));
        onShowToast("Utilisateur supprimé", "success");
        if (selectedCompany) {
           const cUsers = users.filter(u => u.uid !== uid && (u.companyId || 'Sans Entreprise') === selectedCompany);
           if (cUsers.length === 0) setSelectedCompany(null);
        }
      } else {
        const errorData = await response.json();
        onShowToast(errorData.error || "Erreur de suppression", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau lors de la suppression", "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingUser(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          companyId: newUserCompany || 'Nouvelle Entreprise',
          adminUid: userProfile?.uid || '',
          role: newUserRole,
          testMode: false
        })
      });

      if (response.ok) {
        onShowToast("Utilisateur créé avec succès", "success");
        setShowAddUser(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
        setNewUserCompany('');
        fetchUsers();
      } else {
        const data = await response.json();
        onShowToast(data.error || "Erreur de création", "error");
      }
    } catch (err) {
      onShowToast("Erreur réseau", "error");
    } finally {
      setIsAddingUser(false);
    }
  };

  const exportAllSalesCSV = () => {
    if (allSales.length === 0) {
      onShowToast("Aucun client trouvé à exporter", "error");
      return;
    }
    
    const headers = [
      "Identifiant", "Date d'ajout", "Entreprise (Plateforme)", "Client (Nom)", "Téléphone", "Email", 
      "Marque", "Modèle", "Couleur", "Immatriculation", "VIN", "Numéro de BDC", 
      "Prix initial", "Statut Paiement", "Montant Payé", "Commercial Associé", "Notes"
    ];
    
    const csvContent = [
      headers.join(';'),
      ...allSales.map(sale => {
        const totalPaid = (sale.payments || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const notes = (sale.notes || []).map(n => n.text).join(' - ');
        const row = [
          sale.id,
          sale.date,
          sale.company || '',
          sale.clientName || '',
          sale.phone || '',
          sale.email || '',
          sale.marque || '',
          sale.modele || '',
          sale.color || '',
          sale.plaque || '',
          sale.vin || '',
          sale.bdcNumber || '',
          sale.price || '',
          sale.paymentStatus || 'ACOMPTE',
          totalPaid.toString(),
          sale.commercial || '',
          `"${notes.replace(/"/g, '""')}"`
        ];
        return row.join(';');
      })
    ].join('\n');

    const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tous_les_clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group users clearly
  const groupedCompanies = users.reduce((acc, user) => {
    const comp = user.companyId || 'Sans Entreprise';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(user);
    return acc;
  }, {} as Record<string, UserProfile[]>);

  const filteredCompanies = Object.keys(groupedCompanies).filter(comp => comp.toLowerCase().includes(search.toLowerCase()));

  const totalUsers = users.length;
  const totalCompanies = Object.keys(groupedCompanies).length;
  const premiumCompanies = (Object.values(groupedCompanies) as UserProfile[][]).filter(members => {
     const admin = members.find(m => m.role === 'admin') || members[0];
     return !admin?.testMode;
  }).length;

  return (
    <div className="fixed inset-0 bg-slate-100 flex z-50 overflow-hidden animate-fade-in-up font-sans">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
         <div className="p-6 border-b border-slate-800 flex items-center gap-3 shrink-0">
           <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg border border-indigo-400/30">
             <ShieldAlert size={20} className="text-white" />
           </div>
           <div>
             <h2 className="text-lg font-black text-white tracking-tight leading-tight">SuperAdmin</h2>
             <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">SaaS Control</p>
           </div>
         </div>
         
         <div className="p-4 flex flex-col gap-2 flex-1">
            <button 
              onClick={() => {setActiveTab('overview'); setSelectedCompany(null);}} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <LayoutDashboard size={18} /> Vue Globale
            </button>
            <button 
              onClick={() => {setActiveTab('companies'); setSelectedCompany(null);}} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'companies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Building size={18} /> Entreprises
            </button>
            <button 
              onClick={() => {setActiveTab('clients'); setSelectedCompany(null);}} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Users size={18} /> Clients Globaux
            </button>
            <button 
              onClick={() => {setActiveTab('accounts'); setSelectedCompany(null);}} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'accounts' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <ShieldCheck size={18} /> Accès & Comptes
            </button>
            <button 
              onClick={() => {setActiveTab('settings'); setSelectedCompany(null);}} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Settings size={18} /> Paramètres
            </button>
         </div>

         <div className="p-4 border-t border-slate-800">
           <button onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all w-full">
              <LogOut size={18} /> Quitter
            </button>
            <a 
              href="https://stats.uptimerobot.com/EjAcm5FoSR" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 font-bold mt-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Statut Système
            </a>
            <button className="hidden">
           </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">

        {/* Top bar */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
           <h3 className="text-xl font-black text-slate-800 tracking-tight">
             {activeTab === 'overview' && 'Tableau de bord SaaS'}
             {activeTab === 'companies' && 'Gestion des Instances'}
             {activeTab === 'clients' && 'Clients Globaux'}
             {activeTab === 'accounts' && 'Gestion globale des Accès'}
             {activeTab === 'settings' && 'Paramètres SaaS'}
           </h3>
           {(activeTab === 'companies' || activeTab === 'accounts') && (
             <div className="relative w-64 lg:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher une instance..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-800"
                />
             </div>
           )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
           {isLoading ? (
             <div className="flex justify-center items-center h-full">
                <Loader2 className="animate-spin text-indigo-500" size={40} />
             </div>
           ) : (
             <>
               {/* OVERVIEW TAB */}
               {activeTab === 'overview' && (
                 <div className="max-w-6xl mx-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3"><Building size={24}/></div>
                          <h4 className="text-3xl font-black text-slate-800 mb-1">{totalCompanies}</h4>
                          <p className="text-sm font-bold uppercase text-slate-500 tracking-wider">Instances Clients</p>
                       </div>
                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3"><Users size={24}/></div>
                          <h4 className="text-3xl font-black text-slate-800 mb-1">{totalUsers}</h4>
                          <p className="text-sm font-bold uppercase text-slate-500 tracking-wider">Utilisateurs Actifs</p>
                       </div>
                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3"><Activity size={24}/></div>
                          <h4 className="text-3xl font-black text-slate-800 mb-1">{premiumCompanies}</h4>
                          <p className="text-sm font-bold uppercase text-slate-500 tracking-wider">Abonnements Premium</p>
                       </div>
                    </div>
                    
                    <div className="mt-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                       <h4 className="text-lg font-black text-slate-800 mb-2">Bienvenue dans votre centre de contrôle</h4>
                       <p className="text-slate-500 max-w-lg mx-auto text-sm font-medium">Vous pouvez configurer les paramètres généraux, gérer vos clients, upgrader leurs forfaits et inspecter la base de données utilisateurs depuis l'onglet "Entreprises".</p>
                       <button onClick={() => setActiveTab('companies')} className="mt-6 bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                         Voir les entreprises
                       </button>
                    </div>
                 </div>
               )}

               {/* CLIENTS TAB */}
               {activeTab === 'clients' && (
                 <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-6">
                       <div>
                          <h3 className="text-xl font-black text-slate-800">Toutes les données Clients</h3>
                          <p className="text-sm text-slate-500 font-medium">Vue globale réservée au SuperAdmin. Contient les données client de toutes les instances confondues.</p>
                       </div>
                       <button
                         onClick={exportAllSalesCSV}
                         disabled={allSales.length === 0}
                         className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm"
                       >
                         <Download size={18} />
                         Exporter en CSV
                       </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                       {isLoadingSales ? (
                         <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
                            <p>Chargement des données...</p>
                         </div>
                       ) : allSales.length === 0 ? (
                         <div className="p-12 text-center text-slate-500 font-medium">Aucun client trouvé dans la base.</div>
                       ) : (
                         <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                               <thead className="bg-slate-50 border-b border-slate-200">
                                 <tr>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Entreprise (Plateforme)</th>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Date</th>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Client</th>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Véhicule</th>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Prix Total</th>
                                   <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Notes</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                  {allSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                       <td className="px-6 py-4 font-bold text-indigo-700">{sale.company || '-'}</td>
                                       <td className="px-6 py-4 text-slate-600">{sale.date}</td>
                                       <td className="px-6 py-4 font-bold text-slate-800">{sale.clientName}</td>
                                       <td className="px-6 py-4 text-slate-600">
                                          {sale.marque} {sale.modele} <span className="text-xs text-slate-400">({sale.plaque})</span>
                                       </td>
                                       <td className="px-6 py-4 font-bold">{sale.price ? `${sale.price} €` : '-'}</td>
                                       <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate">
                                          {(sale.notes || []).map(n => n.text).join(', ') || '-'}
                                       </td>
                                    </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                       )}
                    </div>
                 </div>
               )}

               {/* ACCOUNTS TAB */}
               {activeTab === 'accounts' && (
                 <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-6">
                       <div>
                          <h3 className="text-xl font-black text-slate-800">Gestion des Accès et Utilisateurs</h3>
                          <p className="text-sm text-slate-500 font-medium">Vue globale sur {users.length} comptes. Modifiez l'entreprise, le rôle ou supprimez les comptes problématiques.</p>
                       </div>
                       <button
                         onClick={() => setShowAddUser(!showAddUser)}
                         className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm"
                       >
                         Ajouter un Compte
                       </button>
                    </div>

                    {showAddUser && (
                       <form onSubmit={handleCreateUser} className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 bg-indigo-50/50 mb-6 flex flex-wrap gap-4 items-end">
                         <div className="flex-1 min-w-[200px]">
                           <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                           <input required type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="contact@email.com" />
                         </div>
                         <div className="flex-1 min-w-[150px]">
                           <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe</label>
                           <input required type="text" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Mot de passe" />
                         </div>
                         <div className="flex-1 min-w-[150px]">
                           <label className="block text-xs font-bold text-slate-700 mb-1">Nom (Commercial)</label>
                           <input required type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Jean Dupont" />
                         </div>
                         <div className="flex-1 min-w-[150px]">
                           <label className="block text-xs font-bold text-slate-700 mb-1">ID Entreprise (Optionnel)</label>
                           <input type="text" value={newUserCompany} onChange={e => setNewUserCompany(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nom de l'entreprise" />
                         </div>
                         <div className="flex-1 min-w-[150px]">
                           <label className="block text-xs font-bold text-slate-700 mb-1">Rôle</label>
                           <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                             <option value="commercial">Commercial</option>
                             <option value="admin">Admin</option>
                           </select>
                         </div>
                         <button type="submit" disabled={isAddingUser} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors h-[38px] flex items-center disabled:opacity-50">
                           {isAddingUser ? <Loader2 className="animate-spin" size={18} /> : 'Créer'}
                         </button>
                       </form>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                       <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                             <thead className="bg-slate-50 border-b border-slate-200">
                               <tr>
                                 <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Email Utilisateur</th>
                                 <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Nom</th>
                                 <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Entreprise & Rôle</th>
                                 <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Actions</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                {users.filter(u => `${u.name} ${u.email} ${u.companyId}`.toLowerCase().includes(search.toLowerCase())).map(user => (
                                  <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                     <td className="px-6 py-4 font-bold text-slate-800">
                                       <div className="flex items-center gap-2">
                                          <Mail size={14} className="text-slate-400" />
                                          {user.email || 'N/A'}
                                       </div>
                                     </td>
                                     <td className="px-6 py-4 text-slate-600 font-medium">{user.name}</td>
                                     <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                          <input 
                                            type="text" 
                                            value={user.companyId || ''} 
                                            onChange={(e) => handleUpdateUser(user.uid, { companyId: e.target.value })}
                                            className="bg-transparent border border-slate-200 rounded px-2 py-1 outline-none text-xs w-32 focus:border-indigo-500 font-bold text-indigo-700" 
                                            placeholder="Entreprise"
                                          />
                                          <select 
                                            value={user.role || 'commercial'} 
                                            onChange={(e) => handleUpdateUser(user.uid, { role: e.target.value as 'admin' | 'commercial' })}
                                            className="bg-slate-100 border-none rounded text-xs px-2 py-1 outline-none focus:ring-0 font-bold"
                                          >
                                            <option value="admin">Admin</option>
                                            <option value="commercial">Commercial</option>
                                          </select>
                                        </div>
                                     </td>
                                     <td className="px-6 py-4">
                                        <button 
                                          onClick={() => {}} className="hidden" /> <button onClick={async () => { const newPass = window.prompt(`Saisir le nouveau mot de passe pour ${user.name || user.email} (Min 6 caractères) :`); if (newPass) { if (newPass.length < 6) { alert("Le mot de passe doit comporter au moins 6 caractères."); return; } try { const response = await fetch(`/api/users/${user.uid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPass }) }); if (response.ok) { onShowToast("Mot de passe modifié avec succès.", "success"); } else { const err = await response.json(); alert(`Erreur : ${err.error || "Mise à jour échouée."}`); } } catch (e) { alert("Erreur réseau"); } } }} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors cursor-pointer mr-2 inline-flex items-center gap-1 text-xs font-bold"><KeyRound size={14} /> Password</button><button onClick={() => handleDeleteUser(user.uid)} 
                                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
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
                 </div>
               )}

               {/* SETTINGS TAB */}
               {activeTab === 'settings' && (
                 <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center py-20">
                       <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                       <h3 className="text-xl font-black text-slate-700 mb-2">Paramètres de la plateforme (À venir)</h3>
                       <p className="text-slate-500 text-sm max-w-md mx-auto">Ces paramètres de facturation SaaS et de configuration SMTP seront disponibles dans une version ultérieure de cette vue d'administration.</p>
                    </div>
                 </div>
               )}

               {/* COMPANIES TAB */}
               {activeTab === 'companies' && !selectedCompany && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
                    {filteredCompanies.map(companyName => {
                      const members = groupedCompanies[companyName];
                      const admin = members.find(m => m.role === 'admin') || members[0];
                      const isPremium = !admin?.testMode;

                      return (
                        <div 
                           key={companyName} 
                           onClick={() => setSelectedCompany(companyName)}
                           className="bg-white border text-sm border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col overflow-hidden group"
                        >
                           <div className="p-6 flex-1">
                              <div className="flex justify-between items-start mb-4">
                                 <div className={`p-3 rounded-2xl shadow-sm ${isPremium ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <Building size={24} />
                                 </div>
                                 {isPremium ? (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black px-2 py-1 rounded-md border border-emerald-200 shadow-sm">PREMIUM</span>
                                  ) : (
                                    <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-black px-2 py-1 rounded-md border border-amber-200 shadow-sm">TEST MODE</span>
                                  )}
                              </div>
                              <h3 className="font-black text-slate-800 text-xl tracking-tight mb-1 truncate" title={companyName}>{companyName}</h3>
                              <p className="text-slate-500 font-medium text-xs mb-4 flex items-center gap-1"><Users size={14}/> {members.length} utilisateur(s) liés</p>
                           </div>
                           <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between text-indigo-600 font-bold text-xs uppercase tracking-wider group-hover:bg-indigo-50 transition-colors">
                              <span>Gérer l'instance</span>
                              <ChevronRight size={16} />
                           </div>
                        </div>
                      );
                    })}
                 </div>
               )}

               {/* COMPANY DETAIL VIEW */}
               {activeTab === 'companies' && selectedCompany && (
                 <CompanyDetail 
                    companyName={selectedCompany} 
                    members={groupedCompanies[selectedCompany]} 
                    onBack={() => setSelectedCompany(null)}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser}
                 />
               )}
             </>
           )}
        </div>
      </div>
    </div>
  );
};

// --- Sub-component for detail view ---

const CompanyDetail: React.FC<{
  companyName: string;
  members: UserProfile[];
  onBack: () => void;
  onUpdateUser: (uid: string, data: Partial<UserProfile>) => void;
  onDeleteUser: (uid: string) => void;
}> = ({ companyName, members, onBack, onUpdateUser, onDeleteUser }) => {
  const admin = members.find(m => m.role === 'admin') || members[0];
  const [isEditingName, setIsEditingName] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState(companyName);

  const handleSaveCompanyName = () => {
    if (newCompanyName.trim() === '' || newCompanyName === companyName) {
       setIsEditingName(false);
       return;
    }
    // Update companyId for all members of this company
    members.forEach(m => {
       onUpdateUser(m.uid, { companyId: newCompanyName.trim() });
    });
    setIsEditingName(false);
  };

  const handleUpdateSubscription = (level: 'test' | 'pro' | 'premium') => {
     let data = {};
     if (level === 'test') data = { testMode: true, maxClients: 4 };
     else if (level === 'pro') data = { testMode: false, maxClients: 20 };
     else if (level === 'premium') data = { testMode: false, maxClients: 9999 };
     
     // Appliquer l'abonnement à l'admin
     if (admin) onUpdateUser(admin.uid, data);
  };

  const currentLevel = admin?.testMode ? 'test' : (admin?.maxClients === 20 ? 'pro' : 'premium');

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
       <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-6 transition-colors">
         <ChevronRight size={18} className="rotate-180" /> Retour aux instances
       </button>
       
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="bg-slate-900 p-8 border-b border-slate-800 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mt-10 -mr-10 pointer-events-none"></div>
             
             <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                   <div className="flex items-center gap-3 mb-2">
                      {isEditingName ? (
                         <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl ring-1 ring-white/20">
                            <input 
                               type="text" 
                               value={newCompanyName} 
                               onChange={e => setNewCompanyName(e.target.value)}
                               className="bg-transparent border-none text-white text-3xl font-black w-64 focus:ring-0 px-2 py-1 outline-none"
                               autoFocus
                            />
                            <button onClick={handleSaveCompanyName} className="bg-indigo-500 hover:bg-indigo-400 text-white p-2 rounded-lg"><CheckSquare size={20}/></button>
                         </div>
                      ) : (
                         <>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">{companyName}</h2>
                            <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                         </>
                      )}
                   </div>
                   <p className="text-slate-400 font-medium flex items-center gap-2">
                     <Mail size={16} /> Contact principal : {admin?.email || 'N/A'}
                   </p>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-center">
                     <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Membres</span>
                     <span className="block text-2xl font-black text-white">{members.length}</span>
                   </div>
                   <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-center">
                     <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Statut</span>
                     <span className={`block text-lg font-black ${currentLevel === 'test' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {currentLevel === 'test' ? 'Test Mode' : 'Premium'}
                     </span>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Left column: Subscription management */}
             <div className="lg:col-span-1 space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-4 flex items-center gap-2">
                    <CreditCard size={16} /> Gérer l'abonnement
                  </h3>
                  <div className="space-y-3">
                     <button 
                       onClick={() => handleUpdateSubscription('test')}
                       className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all text-left ${currentLevel === 'test' ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                        <div>
                           <span className="block font-black text-slate-800">Mode Test / Essai</span>
                           <span className="block text-xs font-medium text-slate-500">Limité à 4 véhicules</span>
                        </div>
                        {currentLevel === 'test' && <CheckSquare className="text-amber-500" size={20}/>}
                     </button>

                     <button 
                       onClick={() => handleUpdateSubscription('pro')}
                       className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all text-left ${currentLevel === 'pro' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                        <div>
                           <span className="block font-black text-slate-800">Forfait Pro</span>
                           <span className="block text-xs font-medium text-slate-500">Jusqu'à 20 véhicules</span>
                        </div>
                        {currentLevel === 'pro' && <CheckSquare className="text-indigo-500" size={20}/>}
                     </button>

                     <button 
                       onClick={() => handleUpdateSubscription('premium')}
                       className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all text-left ${currentLevel === 'premium' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-300'}`}
                     >
                        <div>
                           <span className="block font-black text-slate-800 text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">Premium Illimité</span>
                           <span className="block text-xs font-medium text-slate-500">Sans restriction</span>
                        </div>
                        {currentLevel === 'premium' && <CheckSquare className="text-emerald-500" size={20}/>}
                     </button>
                  </div>
                </div>
             </div>
             
             {/* Right column: Users list */}
             <div className="lg:col-span-2">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-4 flex items-center gap-2">
                  <Users size={16} /> Tableaux des Membres ({members.length})
                </h3>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs">Identité</th>
                          <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs w-24">Rôle</th>
                          <th className="px-6 py-4 font-bold text-slate-800 uppercase text-xs w-24 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                         {members.map(m => (
                           <tr key={m.uid} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                 <span className="block font-black text-slate-800 text-base">{m.name}</span>
                                 <span className="block text-slate-500 font-medium">{m.email}</span>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${m.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                    {m.role === 'admin' ? 'Propriétaire' : 'Employé'}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button 
                                   onClick={() => onDeleteUser(m.uid)}
                                   className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                   title="Supprimer ce compte"
                                 >
                                   <Trash size={18} />
                                 </button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};