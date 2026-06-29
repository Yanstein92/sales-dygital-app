import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Search, Plus, Phone, Mail, MapPin, Car, FileText, 
  Trash2, Edit3, X, Check, ArrowUpDown, ChevronRight, 
  Calendar, Briefcase, ChevronDown, MessageSquare, Grid, List, Shield, HelpCircle, Star,
  Upload, Download, Eye, Loader2
} from 'lucide-react';
import { useApp } from '../lib/context';
import { db, doc, setDoc, deleteDoc, getUserPath } from '../lib/firebase';
import { Client, Sale, ClientDocument } from '../types';

interface ClientsViewProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onShowToast }) => {
  const { sales, clients, databaseUid, userProfile, selectedClientId, setSelectedClientId } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [uploadDocType, setUploadDocType] = useState<'carte_identite' | 'passeport' | 'permis_conduire'>('carte_identite');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeClientDetails) return;

    if (file.size > 800000) {
      onShowToast("Le fichier est trop volumineux. La taille maximale est de 800 ko.", "error");
      return;
    }

    try {
      setIsUploadingDoc(true);

      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result !== 'string') return;

        // Determine extension
        const originalName = file.name;
        const extMatch = originalName.match(/\.[^.]+$/);
        const extension = extMatch ? extMatch[0] : '.pdf';

        // Choose renamed label
        let typeLabel = "Carte d'identité";
        if (uploadDocType === 'passeport') typeLabel = "Passeport";
        if (uploadDocType === 'permis_conduire') typeLabel = "Permis de conduire";

        const renamedFileName = `${activeClientDetails.name} - ${typeLabel}${extension}`;

        const newDoc = {
          id: 'doc_' + Date.now(),
          name: renamedFileName,
          type: uploadDocType,
          fileSize: (file.size / 1024).toFixed(0) + ' ko',
          dataUrl: reader.result,
          uploadedAt: new Date().toISOString()
        };

        // Determine client ID
        let clientId = activeClientDetails.isManual ? activeClientDetails.id : 'cli_override_' + String(activeClientDetails.name).trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + activeClientDetails.type;

        const clientPath = doc(db, getUserPath('clients', databaseUid), clientId);
        const existingDocs = activeClientDetails.documents || [];
        const newDocs = [...existingDocs, newDoc];

        const updatedClientData = {
          id: clientId,
          name: activeClientDetails.name,
          phone: activeClientDetails.phone || '',
          email: activeClientDetails.email || '',
          address: activeClientDetails.address || '',
          zipCode: activeClientDetails.zipCode || '',
          city: activeClientDetails.city || '',
          notes: activeClientDetails.notes || '',
          type: activeClientDetails.type || 'client',
          documents: newDocs,
          createdAt: activeClientDetails.createdAt || new Date().toISOString()
        };

        await setDoc(clientPath, updatedClientData, { merge: true });
        onShowToast("Document ajouté et renommé avec succès !", "success");
        setIsUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading client document:", err);
      onShowToast("Erreur lors de l'ajout du document.", "error");
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!activeClientDetails) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;

    try {
      let clientId = activeClientDetails.isManual ? activeClientDetails.id : 'cli_override_' + String(activeClientDetails.name).trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + activeClientDetails.type;
      const clientPath = doc(db, getUserPath('clients', databaseUid), clientId);
      const updatedDocs = (activeClientDetails.documents || []).filter((d: any) => d.id !== docId);

      const updatedClientData = {
        id: clientId,
        name: activeClientDetails.name,
        phone: activeClientDetails.phone || '',
        email: activeClientDetails.email || '',
        address: activeClientDetails.address || '',
        zipCode: activeClientDetails.zipCode || '',
        city: activeClientDetails.city || '',
        notes: activeClientDetails.notes || '',
        type: activeClientDetails.type || 'client',
        documents: updatedDocs,
        createdAt: activeClientDetails.createdAt || new Date().toISOString()
      };

      await setDoc(clientPath, updatedClientData, { merge: true });
      onShowToast("Document supprimé avec succès.", "success");
    } catch (err) {
      console.error("Error deleting client document:", err);
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };
  
  // View options state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [filterType, setFilterType] = useState<'all' | 'client' | 'intermediaire'>('all');

  // Client Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formZipCode, setFormZipCode] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formType, setFormType] = useState<'client' | 'intermediaire'>('client');

  // Merge Firestore clients and clients/intermediaries auto-extracted from Sales
  const mergedClients = useMemo(() => {
    const clientMap = new Map<string, any>();

    // 1. Process explicit clients from Firestore
    clients.forEach(c => {
      const key = 'manual::' + String(c.id || '').trim().toLowerCase();
      clientMap.set(key, {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        zipCode: c.zipCode || '',
        city: c.city || '',
        notes: c.notes || '',
        isManual: true,
        type: (c as any).type || 'client',
        documents: (c as any).documents || [],
        purchases: [] as Sale[],
        totalSpent: 0,
      });
    });

    // 2. Process clients from Sales
    sales.forEach(s => {
      // End buyer / Owner
      const name = String(s.clientName || '').trim();
      if (name) {
        const clientKey = 'sale_client::' + name.toLowerCase();
        if (clientMap.has(clientKey)) {
          const existing = clientMap.get(clientKey);
          if (!existing.phone && s.phone) existing.phone = s.phone;
          if (!existing.email && s.email) existing.email = s.email;
          if (!existing.address && s.address) existing.address = s.address;
          if (!existing.zipCode && s.zipCode) existing.zipCode = s.zipCode;
          if (!existing.city && s.city) existing.city = s.city;
          existing.purchases.push(s);
          existing.totalSpent += s.price || 0;
        } else {
          clientMap.set(clientKey, {
            id: `sale-client-${s.id}`,
            name: name,
            phone: s.phone || '',
            email: s.email || '',
            address: s.address || '',
            zipCode: s.zipCode || '',
            city: s.city || '',
            notes: '',
            isManual: false,
            type: 'client',
            purchases: [s],
            totalSpent: s.price || 0,
          });
        }
      }

      // Intermediary / Reference contact
      const refName = String(s.ref || '').trim();
      if (refName && refName !== '-' && refName.toLowerCase() !== 'aucun' && refName.toLowerCase() !== 'none') {
        const refKey = 'sale_ref::' + refName.toLowerCase();
        if (clientMap.has(refKey)) {
          const existing = clientMap.get(refKey);
          existing.purchases.push(s);
          existing.totalSpent += s.price || 0;
          if (!existing.phone && s.refPhone) existing.phone = s.refPhone;
          if (!existing.email && s.refEmail) existing.email = s.refEmail;
        } else {
          clientMap.set(refKey, {
            id: `sale-ref-${s.id}`,
            name: refName,
            phone: s.refPhone || '',
            email: s.refEmail || '',
            address: '',
            zipCode: '',
            city: '',
            notes: '',
            isManual: false,
            type: 'intermediaire',
            purchases: [s],
            totalSpent: s.price || 0,
          });
        }
      }
    });

    // De-duplicate manual with sale-extracted contacts
    const finalMap = new Map<string, any>();
    clientMap.forEach((c) => {
      const matchKey = `${c.type}::${c.name.trim().toLowerCase()}`;
      if (finalMap.has(matchKey)) {
        const existing = finalMap.get(matchKey);
        if (c.isManual) {
          // Keep manual one but merge purchases and totalSpent
          const purchases = [...existing.purchases, ...c.purchases];
          const totalSpent = existing.totalSpent + c.totalSpent;
          finalMap.set(matchKey, {
            ...c,
            purchases,
            totalSpent
          });
        } else {
          // Merge sales into the existing one
          existing.purchases = [...existing.purchases, ...c.purchases];
          existing.totalSpent += c.totalSpent;
          if (!existing.phone && c.phone) existing.phone = c.phone;
          if (!existing.email && c.email) existing.email = c.email;
          if (!existing.address && c.address) existing.address = c.address;
          if (!existing.zipCode && c.zipCode) existing.zipCode = c.zipCode;
          if (!existing.city && c.city) existing.city = c.city;
        }
      } else {
        finalMap.set(matchKey, c);
      }
    });

    return Array.from(finalMap.values());
  }, [sales, clients]);

  // Monitor selectedClientId from global search
  useEffect(() => {
    if (selectedClientId && mergedClients.length > 0) {
      const found = mergedClients.find(c => c.id === selectedClientId);
      if (found) {
        setSelectedClient(found);
        setSelectedClientId(null);
      }
    }
  }, [selectedClientId, mergedClients, setSelectedClientId]);

  // Derive up-to-date client details including real-time updated documents list
  const activeClientDetails = useMemo(() => {
    if (!selectedClient) return null;
    return mergedClients.find(c => c.name.trim().toLowerCase() === selectedClient.name.trim().toLowerCase() && c.type === selectedClient.type) || selectedClient;
  }, [selectedClient, mergedClients]);

  // Sort by purchase frequency (number of purchases) descending by default, then alphabetically
  const sortedClients = useMemo(() => {
    return [...mergedClients].sort((a, b) => {
      const diff = b.purchases.length - a.purchases.length;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [mergedClients]);

  // Compute precise rankings for end-clients based on purchase frequency
  const clientRanks = useMemo(() => {
    const clientsOnly = sortedClients
      .filter(c => c.type === 'client' && c.purchases.length > 0);
    
    const rankMap = new Map<string, number>();
    clientsOnly.forEach((c, idx) => {
      rankMap.set(c.id, idx + 1);
    });
    return rankMap;
  }, [sortedClients]);

  // Filter sorted clients based on type tab and search query
  const filteredClients = useMemo(() => {
    let list = sortedClients;
    
    if (filterType !== 'all') {
      list = list.filter(c => c.type === filterType);
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const emailMatch = c.email.toLowerCase().includes(q);
      const phoneMatch = c.phone.toLowerCase().includes(q);
      const cityMatch = c.city.toLowerCase().includes(q);
      const carMatch = c.purchases.some((p: Sale) => 
        `${p.marque} ${p.modele} ${p.plaque} ${p.vin}`.toLowerCase().includes(q)
      );
      return nameMatch || emailMatch || phoneMatch || cityMatch || carMatch;
    });
  }, [sortedClients, searchQuery, filterType]);

  // Stats
  const stats = useMemo(() => {
    const totalClients = mergedClients.filter(c => c.type === 'client').length;
    const totalIntermediaries = mergedClients.filter(c => c.type === 'intermediaire').length;
    const totalPurchases = sales.length;
    return { totalClients, totalIntermediaries, totalPurchases };
  }, [mergedClients, sales]);

  const handleOpenAddModal = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormZipCode('');
    setFormCity('');
    setFormNotes('');
    setFormType('client');
    setShowAddModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onShowToast("Le nom du client est obligatoire.", "error");
      return;
    }

    try {
      const clientId = isEditing 
        ? (selectedClient?.isManual 
            ? selectedClient.id 
            : 'cli_override_' + String(formName.trim().toLowerCase()).replace(/[^a-z0-9]/g, '_') + '_' + formType)
        : 'cli_' + Date.now();
      const clientPath = doc(db, getUserPath('clients', databaseUid), clientId);
      
      const newClientData: any = {
        id: clientId,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        zipCode: formZipCode.trim(),
        city: formCity.trim(),
        notes: formNotes.trim(),
        type: formType,
        createdAt: isEditing ? (selectedClient?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      };

      await setDoc(clientPath, newClientData);
      onShowToast(isEditing ? "Contact mis à jour !" : "Contact enregistré avec succès !", "success");
      
      setShowAddModal(false);
      setIsEditing(false);
      setSelectedClient(null);
    } catch (err) {
      console.error("Error saving client", err);
      onShowToast("Erreur lors de la sauvegarde du contact.", "error");
    }
  };

  const handleEditClient = (client: any) => {
    setFormName(client.name);
    setFormPhone(client.phone);
    setFormEmail(client.email);
    setFormAddress(client.address);
    setFormZipCode(client.zipCode);
    setFormCity(client.city);
    setFormNotes(client.notes);
    setFormType(client.type || 'client');
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce contact de votre annuaire ? Cela ne supprimera pas ses dossiers d'achat.")) return;
    
    try {
      const clientPath = doc(db, getUserPath('clients', databaseUid), clientId);
      await deleteDoc(clientPath);
      onShowToast("Contact supprimé de l'annuaire.", "success");
      setSelectedClient(null);
    } catch (err) {
      console.error("Error deleting client", err);
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };

  // Helper to render ranking badges elegantly with tooltips
  const renderRankBadge = (c: any) => {
    const purchaseCount = c.purchases ? c.purchases.length : 0;
    
    if (c.type === 'intermediaire') {
      return (
        <div className="group/badge relative cursor-pointer inline-block">
          <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200/50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 select-none">
            🤝 Réf <span className="opacity-60">• achats: {purchaseCount}</span>
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
            <span className="block text-sky-400 mb-0.5 font-black text-[10px] uppercase">Intermédiaire</span>
            Partenaire, revendeur ou apporteur d'affaires pour ce dossier.
          </div>
        </div>
      );
    }

    if (purchaseCount === 0) {
      return (
        <div className="group/badge relative cursor-pointer inline-block">
          <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 select-none">
            📋 Prospect
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
            <span className="block text-slate-400 mb-0.5 font-black text-[10px] uppercase">Prospect</span>
            Client potentiel sans commande finalisée pour le moment.
          </div>
        </div>
      );
    }

    const rank = clientRanks.get(c.id);
    if (rank === 1) {
      return (
        <div className="group/badge relative cursor-pointer inline-block">
          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 select-none shadow-xs">
            🏆 #1 <span className="opacity-90">• achats: {purchaseCount}</span>
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
            <span className="block text-amber-400 mb-0.5 font-black text-[10px] uppercase">🏆 Premier Acheteur</span>
            Le client n°1 de votre réseau avec le plus d'achats.
          </div>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="group/badge relative cursor-pointer inline-block">
          <span className="text-[10px] bg-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 select-none">
            🥈 #2 <span className="opacity-80">• achats: {purchaseCount}</span>
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
            <span className="block text-slate-300 mb-0.5 font-black text-[10px] uppercase">🥈 Deuxième</span>
            Le deuxième client le plus actif du réseau.
          </div>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="group/badge relative cursor-pointer inline-block">
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 select-none">
            🥉 #3 <span className="opacity-80">• achats: {purchaseCount}</span>
          </span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover:badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
            <span className="block text-amber-600 mb-0.5 font-black text-[10px] uppercase">🥉 Troisième</span>
            Le troisième client le plus actif du réseau.
          </div>
        </div>
      );
    }

    return (
      <div className="group/badge relative cursor-pointer inline-block">
        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 select-none">
          ⭐ <span className="opacity-90">achats: {purchaseCount}</span>
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-white text-[9px] rounded-lg shadow-xl opacity-0 scale-95 group-hover/badge:opacity-100 group-hover/badge:scale-100 transition-all pointer-events-none z-50 leading-normal font-bold">
          <span className="block text-indigo-400 mb-0.5 font-black text-[10px] uppercase">Client Actif</span>
          Client régulier avec plusieurs commandes de véhicules.
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden select-none">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Annuaire Client & Intermédiaires
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Users className="text-indigo-400 w-7 h-7" />
              Gestion des Contacts
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-2xl leading-relaxed">
              Consultez les fiches de vos clients acquéreurs, prospects et intermédiaires (références, revendeurs, apporteurs d'affaires) classés par fréquence d'achat.
            </p>
          </div>

          <button 
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-xs font-black shadow-lg shadow-indigo-500/25 transition-all self-start md:self-center cursor-pointer"
          >
            <Plus size={16} />
            Ajouter un Contact
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex items-center gap-5">
          <div className="p-3.5 rounded-xl bg-blue-50 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.totalClients}</div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Clients</span>
              <div className="group relative cursor-pointer text-slate-400 hover:text-indigo-600">
                <HelpCircle size={12} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none z-50 font-medium normal-case leading-normal">
                  <strong className="text-indigo-400">Clients acquéreurs</strong> finalisant les achats à leur nom.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex items-center gap-5">
          <div className="p-3.5 rounded-xl bg-sky-50 text-sky-600">
            <Briefcase size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.totalIntermediaries}</div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Intermédiaires</span>
              <div className="group relative cursor-pointer text-slate-400 hover:text-sky-600">
                <HelpCircle size={12} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none z-50 font-medium normal-case leading-normal">
                  <strong className="text-sky-400">Intermédiaires / Réf</strong> (revendeurs, apporteurs d'affaires).
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex items-center gap-5">
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Car size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.totalPurchases}</div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Dossiers commandés</div>
          </div>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Type Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-50 border border-slate-150 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👥 Tout ({mergedClients.length})
          </button>
          <button
            onClick={() => setFilterType('client')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'client'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👤 Clients ({mergedClients.filter(c => c.type === 'client').length})
          </button>
          <button
            onClick={() => setFilterType('intermediaire')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'intermediaire'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🤝 Intermédiaires ({mergedClients.filter(c => c.type === 'intermediaire').length})
          </button>
        </div>

        {/* Search Input & View Toggles */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-400 rounded-xl text-xs outline-none transition-all font-bold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Grid/List toggles */}
          <div className="flex border border-slate-200 rounded-xl p-0.5 bg-slate-50 shrink-0 select-none">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/40' : 'text-slate-400 hover:text-slate-600'}`}
              title="Affichage en Grille"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/40' : 'text-slate-400 hover:text-slate-600'}`}
              title="Affichage en Liste"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Clients Display */}
      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-xs select-none">
          <Users className="mx-auto text-slate-300 mb-4 animate-pulse" size={48} />
          <h3 className="text-lg font-black text-slate-700">Aucun contact trouvé</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto font-bold uppercase tracking-wider">
            Ajustez votre recherche ou vos filtres.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedClient(c)}
              className="bg-white rounded-2xl border border-slate-100 hover:border-indigo-150 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-1 bg-transparent group-hover:bg-indigo-500 h-full transition-all" />
              
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-base group-hover:text-indigo-600 transition-colors leading-tight">
                      {c.name}
                    </h3>
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mt-1.5 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.isManual ? 'bg-amber-400' : 'bg-indigo-500'}`} />
                      {c.isManual ? 'Enregistré Manuellement' : 'Extrait du Dossier'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                </div>

                {/* Contact items */}
                <div className="space-y-2 mb-4">
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold break-all">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {(c.city || c.zipCode) && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>{c.city} {c.zipCode ? `(${c.zipCode})` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Purchase history pill & rank badge */}
              <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg">
                  <Car size={13} className="text-slate-500" />
                  <span>{c.purchases.length} {c.purchases.length > 1 ? 'dossiers' : 'dossier'}</span>
                </div>
                {renderRankBadge(c)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST ROW VIEW */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-black text-[10px] uppercase tracking-wider select-none">
                  <th className="py-3.5 px-5">Nom / Classement</th>
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5">Téléphone</th>
                  <th className="py-3.5 px-5">Email</th>
                  <th className="py-3.5 px-5">Localisation</th>
                  <th className="py-3.5 px-5 text-center">Activité</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => setSelectedClient(c)}
                    className="hover:bg-indigo-50/10 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="font-extrabold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {c.name}
                        </div>
                        {renderRankBadge(c)}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.type === 'intermediaire' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {c.type === 'intermediaire' ? 'Intermédiaire' : 'Acheteur'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600 font-bold">
                      {c.phone || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600 font-bold truncate max-w-[180px]">
                      {c.email || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-600 font-bold">
                      {c.city ? `${c.city} (${c.zipCode || ''})` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="text-xs bg-slate-100 text-slate-700 font-extrabold px-2 py-1 rounded-md">
                        {c.purchases.length} dossiers
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right select-none" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedClient(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Consulter"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {selectedClient && activeClientDetails && (
        <div 
          onClick={() => setSelectedClient(null)} // Click on the backdrop closes!
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in-up border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white relative">
              <button 
                onClick={() => setSelectedClient(null)}
                className="absolute right-4 top-4 text-white/70 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
                <Users size={14} /> Fiche Contact Détaillée
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-black tracking-tight">{activeClientDetails.name}</h2>
                {renderRankBadge(activeClientDetails)}
              </div>
              <p className="text-slate-300 text-xs font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${activeClientDetails.isManual ? 'bg-amber-400' : 'bg-indigo-500'}`} />
                {activeClientDetails.isManual ? 'Fiche Renseignée Manuellement' : 'Client Dossier Actif'}
              </p>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Client Info Grid */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Briefcase size={14} /> Coordonnées & Adresse
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-50 text-slate-500">
                      <Phone size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Téléphone</div>
                      <div className="text-sm font-bold text-slate-800">{activeClientDetails.phone || 'Non renseigné'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-50 text-slate-500">
                      <Mail size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Email</div>
                      <div className="text-sm font-bold text-slate-800 truncate">{activeClientDetails.email || 'Non renseigné'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:col-span-2 mt-2 pt-4 border-t border-slate-100">
                    <div className="p-2.5 rounded-lg bg-slate-50 text-slate-500">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Adresse postale</div>
                      <div className="text-sm font-bold text-slate-800">
                        {activeClientDetails.address ? (
                          <>
                            {activeClientDetails.address}
                            <br />
                            {activeClientDetails.zipCode} {activeClientDetails.city}
                          </>
                        ) : 'Aucune adresse renseignée'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchases list */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Car size={14} /> Historique des Dossiers & Commandes Associées
                </h3>

                {activeClientDetails.purchases.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Aucun dossier d'achat associé pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeClientDetails.purchases.map((p: Sale) => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setSelectedClient(null);
                          window.location.hash = `detail/${p.id}`;
                        }}
                        className="p-4 rounded-xl border border-slate-100 hover:border-indigo-200 bg-slate-50/50 hover:bg-white cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <Car size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center gap-2 flex-wrap">
                              <span>{p.marque} {p.modele}</span>
                              <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">BDC #{p.bdcNumber}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              Plaque : {p.plaque || 'N/A'} | VIN : {p.vin || 'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-auto">
                          <div className="text-right">
                            <div className="text-sm font-black text-slate-900">
                              {(p.price || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
                              <Calendar size={10} /> {p.date}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Documents Justificatifs section */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <FileText size={14} /> Documents justificatifs du Client
                </h3>
                <p className="text-slate-500 text-[11px] mb-4 leading-relaxed font-medium">
                  Déposez des justificatifs officiels. Ils seront renommés automatiquement au format : <code className="font-mono text-indigo-600 font-bold">[Nom] - [Type]</code>.
                </p>

                {/* Upload Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Type de document</label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="carte_identite">Carte d'identité</option>
                      <option value="passeport">Passeport</option>
                      <option value="permis_conduire">Permis de conduire</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Fichier justificatif</label>
                    <label className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm">
                      {isUploadingDoc ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Traitement...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          <span>Sélectionner et renommer</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleUploadDocument}
                        disabled={isUploadingDoc}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Documents List */}
                {(!activeClientDetails.documents || activeClientDetails.documents.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    Aucun document justificatif pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {activeClientDetails.documents.map((doc: ClientDocument) => {
                      const handleDownload = () => {
                        const link = document.createElement('a');
                        link.href = doc.dataUrl || '';
                        link.download = doc.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      };

                      return (
                        <div 
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate" title={doc.name}>
                                {doc.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>{doc.fileSize || 'N/A'}</span>
                                <span>•</span>
                                <span>Ajouté le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            <button
                              type="button"
                              onClick={handleDownload}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Télécharger"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom notes */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <MessageSquare size={14} /> Notes de suivi & Commentaire
                </h3>
                <p className="text-slate-500 text-[11px] mb-3 leading-relaxed font-medium">
                  Ajoutez des remarques spécifiques à propos de ce client (véhicule recherché, historique relationnel, etc.).
                </p>
                
                <div className="bg-amber-50/50 rounded-xl p-3 text-sm text-slate-700 font-medium border border-amber-100/50">
                  {activeClientDetails.notes || <span className="text-slate-400 italic">Aucune note. Cliquez sur Modifier pour en rédiger une.</span>}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 select-none shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEditClient(activeClientDetails)}
                  className="flex items-center gap-1 text-xs font-black text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all"
                >
                  <Edit3 size={14} /> Modifier la fiche
                </button>
                {activeClientDetails.isManual && (
                  <button 
                    onClick={() => handleDeleteClient(activeClientDetails.id)}
                    className="flex items-center gap-1 text-xs font-black text-red-600 hover:bg-red-50 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>
              <button 
                onClick={() => setSelectedClient(null)}
                className="text-xs font-black bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {showAddModal && (
        <div 
          onClick={() => { setShowAddModal(false); setIsEditing(false); }} // Close on backdrop click
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <form 
            onSubmit={handleSaveClient} 
            onClick={(e) => e.stopPropagation()} // Prevent close on clicking inside form
            className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white relative select-none">
              <button 
                type="button"
                onClick={() => { setShowAddModal(false); setIsEditing(false); }}
                className="absolute right-4 top-4 text-white/70 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
                <Users size={14} /> {isEditing ? 'Éditer un Contact' : 'Nouveau Contact'}
              </div>
              <h2 className="text-2xl font-black tracking-tight">
                {isEditing ? 'Modifier la fiche contact' : 'Ajouter un contact'}
              </h2>
            </div>

            {/* Form Fields */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Contact Type selector */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Type de contact <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('client')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        formType === 'client'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      👤 Client
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('intermediaire')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        formType === 'intermediaire'
                          ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      🤝 Intermédiaire (Réf)
                    </button>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom Complet ou Raison Sociale <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="ex: Jean Dupont"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro de Téléphone
                  </label>
                  <input 
                    type="tel" 
                    placeholder="ex: 06 12 34 56 78"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse Email
                  </label>
                  <input 
                    type="email" 
                    placeholder="ex: jean.dupont@email.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse Postale (Rue, Voie)
                </label>
                <input 
                  type="text" 
                  placeholder="ex: 12 Rue de la Paix"
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Code Postal
                  </label>
                  <input 
                    type="text" 
                    placeholder="ex: 75001"
                    value={formZipCode}
                    onChange={e => setFormZipCode(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ville
                  </label>
                  <input 
                    type="text" 
                    placeholder="ex: Paris"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarques / Notes de Suivi
                </label>
                <textarea 
                  rows={3}
                  placeholder="Remarques spécifiques concernant ce contact..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold resize-none text-slate-800"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 select-none shrink-0">
              <button 
                type="button"
                onClick={() => { setShowAddModal(false); setIsEditing(false); }}
                className="text-xs font-black text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-indigo-950/10 flex items-center gap-1.5"
              >
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
