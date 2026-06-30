import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../lib/context';
import { db, getUserPath, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Car, 
  FileText, 
  Upload, 
  Check, 
  Search, 
  Calendar, 
  Download, 
  Eye, 
  ShieldCheck, 
  X, 
  Truck, 
  Hash, 
  Clock,
  ArrowRight,
  Info,
  Loader2
} from 'lucide-react';
import { Vehicle, VehicleDocument } from '../types';

interface Props {
  onShowToast: (m: string, t: 'success' | 'error') => void;
}

interface LogisticsArchiveDoc {
  id: string;
  type: 'CMR' | 'bon_livraison';
  reference: string;
  carrierName: string;
  date: string;
  pdfName: string;
  pdfBase64: string;
  pdfSize: string;
  linkedVehicles: {
    vehicleId: string;
    vin: string;
    marque: string;
    modele: string;
    immatriculation: string;
  }[];
  createdAt: string;
  transportCost?: number;
  transportPaid?: boolean;
}

export const LogisticsView: React.FC<Props> = ({ onShowToast }) => {
  const { vehicles, databaseUid } = useApp();
  
  // Real-time archive state
  const [archiveDocs, setArchiveDocs] = useState<LogisticsArchiveDoc[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(true);

  // Form State
  const [docType, setDocType] = useState<'CMR' | 'bon_livraison'>('CMR');
  const [reference, setReference] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transportCost, setTransportCost] = useState('');
  const [transportPaid, setTransportPaid] = useState(false);
  
  // File state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; base64: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Selection state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedArchiveDoc, setSelectedArchiveDoc] = useState<LogisticsArchiveDoc | null>(null);

  const handleToggleTransportPaid = async (docId: string, currentStatus: boolean) => {
    if (!databaseUid) return;
    try {
      const archivePath = getUserPath('logistics_documents', databaseUid);
      const docRef = doc(db, archivePath, docId);
      await setDoc(docRef, { transportPaid: !currentStatus }, { merge: true });
      
      // Also update selectedArchiveDoc if open
      if (selectedArchiveDoc && selectedArchiveDoc.id === docId) {
        setSelectedArchiveDoc(prev => prev ? { ...prev, transportPaid: !currentStatus } : null);
      }
      
      onShowToast(
        !currentStatus 
          ? "Frais de transport marqués comme payés !" 
          : "Frais de transport marqués comme non payés !", 
        "success"
      );
    } catch (error) {
      console.error('Error toggling transport payment status:', error);
      onShowToast('Impossible de modifier le statut de paiement.', 'error');
    }
  };

  // Load logistics documents archive
  useEffect(() => {
    if (!databaseUid) return;
    const path = getUserPath('logistics_documents', databaseUid);
    
    setIsLoadingArchive(true);
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LogisticsArchiveDoc));
        // Sort by date or creation descending
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        setArchiveDocs(list);
        setIsLoadingArchive(false);
      },
      (error) => {
        console.error('Error fetching logistics archive:', error);
        setIsLoadingArchive(false);
      }
    );
    return () => unsubscribe();
  }, [databaseUid]);

  // Filter vehicles in "ARRIVAGE" status
  const arrivageVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'ARRIVAGE');
  }, [vehicles]);

  // Filter list of arrivage vehicles based on search query
  const filteredArrivageVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return arrivageVehicles;
    return arrivageVehicles.filter(v => 
      v.marque.toLowerCase().includes(q) ||
      v.modele.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      (v.immatriculation && v.immatriculation.toLowerCase().includes(q)) ||
      (v.refInterne && v.refInterne.toLowerCase().includes(q))
    );
  }, [arrivageVehicles, searchQuery]);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    processFile(e.target.files[0]);
  };

  const processFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onShowToast('Veuillez importer uniquement des documents au format PDF.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onShowToast('Le fichier dépasse la limite autorisée de 10 Mo.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedFile({
        name: file.name,
        base64: base64String,
        size: `${(file.size / 1024 / 1024).toFixed(2)} Mo`
      });
      onShowToast(`Document "${file.name}" chargé avec succès.`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle vehicle selection
  const handleToggleSelectVehicle = (id: string) => {
    setSelectedVehicleIds(prev => 
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedVehicleIds.length === filteredArrivageVehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filteredArrivageVehicles.map(v => v.id));
    }
  };

  // Submit / Save Reception handler
  const handleValidateReception = async () => {
    if (!uploadedFile) {
      onShowToast('Veuillez importer un document PDF.', 'error');
      return;
    }
    if (!reference.trim()) {
      onShowToast('Veuillez saisir la référence du document.', 'error');
      return;
    }
    if (selectedVehicleIds.length === 0) {
      onShowToast('Veuillez sélectionner au moins un véhicule en arrivage.', 'error');
      return;
    }
    if (!databaseUid) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const docLabel = docType === 'CMR' ? 'CMR' : 'Bon de livraison';
      
      // 1. Prepare information of linked vehicles
      const selectedVehicles = vehicles.filter(v => selectedVehicleIds.includes(v.id));
      const linkedVehiclesData = selectedVehicles.map(v => ({
        vehicleId: v.id,
        vin: v.vin || '',
        marque: v.marque || '',
        modele: v.modele || '',
        immatriculation: v.immatriculation || 'Non renseigné'
      }));

      // 2. Create the central Archive Document
      const archiveId = `LOG-${Date.now()}`;
      const newArchiveDoc: LogisticsArchiveDoc = {
        id: archiveId,
        type: docType,
        reference: reference.trim(),
        carrierName: carrierName.trim() || 'Non précisé',
        date: receptionDate,
        pdfName: uploadedFile.name,
        pdfBase64: uploadedFile.base64,
        pdfSize: uploadedFile.size,
        linkedVehicles: linkedVehiclesData,
        createdAt: now,
        transportCost: transportCost ? Number(transportCost) : 0,
        transportPaid: transportPaid
      };

      const archivePath = getUserPath('logistics_documents', databaseUid);
      await setDoc(doc(db, archivePath, archiveId), newArchiveDoc);

      // 3. Update each selected vehicle
      const vehicleDocPayload: VehicleDocument = {
        name: `${docLabel} - Réf: ${reference.trim()} - Recu le: ${receptionDate.split('-').reverse().join('/')}`,
        base64: uploadedFile.base64,
        uploadedAt: now,
        size: uploadedFile.size
      };

      for (const vehicle of selectedVehicles) {
        const vehicleRef = doc(db, getUserPath('vehicles', databaseUid), vehicle.id);
        const updatedDocs = [...(vehicle.documents || []), vehicleDocPayload];
        
        await setDoc(vehicleRef, {
          ...vehicle,
          status: 'PARC', // Transition Arrivage -> Parc
          documents: updatedDocs,
          updatedAt: now
        }, { merge: true });
      }

      // 4. Success feedback and reset form
      onShowToast(`Réception validée ! ${selectedVehicles.length} véhicule(s) passé(s) au statut Parc.`, 'success');
      
      // Reset form fields
      setReference('');
      setCarrierName('');
      setTransportCost('');
      setTransportPaid(false);
      setUploadedFile(null);
      setSelectedVehicleIds([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Error during logistique validation:', error);
      onShowToast('Une erreur est survenue lors de la validation.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadPdf = (name: string, base64: string) => {
    try {
      const link = document.createElement('a');
      link.href = base64;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onShowToast('Téléchargement du PDF démarré.', 'success');
    } catch (e) {
      onShowToast('Impossible de télécharger le fichier.', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none">
      
      {/* Upper Grid: Document Creation & Vehicles Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Import Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Upload className="text-indigo-600 w-4 h-4" />
              1. Importer un Document de Réception
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Importez un CMR ou un bon de livraison pour valider l'entrée en parc de vos arrivages.
            </p>
          </div>

          {/* Drag & Drop Area */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
              isDragging 
                ? 'border-indigo-600 bg-indigo-50/50' 
                : uploadedFile 
                  ? 'border-emerald-500/50 bg-emerald-50/10 hover:bg-emerald-50/20' 
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept=".pdf"
              className="hidden"
            />
            {uploadedFile ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Check size={20} className="stroke-[3]" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-800 truncate max-w-[240px]">{uploadedFile.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{uploadedFile.size}</p>
                </div>
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedFile(null);
                  }}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-black transition-colors"
                >
                  Supprimer
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Upload size={18} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700">Déposez votre document PDF ici ou cliquez</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Format PDF uniquement • Max 10 Mo</p>
                </div>
              </>
            )}
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Type de document</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDocType('CMR')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                    docType === 'CMR'
                      ? 'bg-slate-900 border-slate-950 text-white'
                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck size={14} />
                  CMR (Lettre de voiture)
                </button>
                <button
                  type="button"
                  onClick={() => setDocType('bon_livraison')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border ${
                    docType === 'bon_livraison'
                      ? 'bg-slate-900 border-slate-950 text-white'
                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText size={14} />
                  Bon de livraison (BL)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Référence du document *</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Ex: CMR-409384, BL-9201"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Transporteur / Chauffeur</label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Ex: Gefco, Dentressangle"
                    value={carrierName}
                    onChange={e => setCarrierName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Date de réception</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="date"
                    value={receptionDate}
                    onChange={e => setReceptionDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Transport Cost & Payment Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100/60 mt-1">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Coût de transport (€)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">€</span>
                  <input
                    type="number"
                    placeholder="Ex: 450"
                    value={transportCost}
                    onChange={e => setTransportCost(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Statut de paiement du transport</label>
                <div className="flex items-center gap-3 h-9">
                  <label className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl cursor-pointer select-none transition-all w-full">
                    <input
                      type="checkbox"
                      checked={transportPaid}
                      onChange={e => setTransportPaid(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-700">Marquer comme PAYÉ</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Arrivage Vehicles Picker */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Car className="text-indigo-600 w-4 h-4" />
                2. Sélectionner les Véhicules Concernés
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Associez le document aux véhicules en statut Arrivage. Ils passeront automatiquement au statut Parc.
              </p>
            </div>

            {/* Check/uncheck all option */}
            {filteredArrivageVehicles.length > 0 && (
              <button 
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-wider transition-colors"
              >
                {selectedVehicleIds.length === filteredArrivageVehicles.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            )}
          </div>

          {/* Search bar within picker */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="Filtrer par VIN, Modèle, Plaque..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-medium text-slate-800 outline-none transition-all"
            />
          </div>

          {/* Vehicles Scrollable List */}
          <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/30">
            {filteredArrivageVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                <Info className="text-slate-400 w-8 h-8" />
                <p className="text-xs font-bold text-slate-700">Aucun véhicule en "Arrivage"</p>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs">
                  {searchQuery 
                    ? `Aucun véhicule ne correspond à votre recherche "${searchQuery}".`
                    : "Il n'y a actuellement aucun véhicule enregistré avec le statut Arrivage."
                  }
                </p>
              </div>
            ) : (
              filteredArrivageVehicles.map(v => {
                const isSelected = selectedVehicleIds.includes(v.id);
                return (
                  <div 
                    key={v.id}
                    onClick={() => handleToggleSelectVehicle(v.id)}
                    className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/60' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check size={11} className="stroke-[3]" />}
                      </div>
                      
                      <div className="flex flex-col">
                        <div className="text-xs font-black text-slate-800">
                          {v.marque} {v.modele}
                          <span className="ml-2 font-mono text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-bold">
                            ARRIVAGE
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="font-mono text-slate-600">VIN: {v.vin || 'SANS VIN'}</span>
                          <span>Immat: {v.immatriculation || 'Non immatriculé'}</span>
                          <span>Site: {v.site || 'DJ CAR'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Validation Summary */}
          <div className="bg-slate-50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-slate-100">
            <div className="text-xs text-slate-600 font-semibold leading-relaxed">
              {selectedVehicleIds.length === 0 ? (
                <span className="text-slate-400">Aucun véhicule sélectionné.</span>
              ) : (
                <span>
                  <strong className="text-indigo-600">{selectedVehicleIds.length}</strong> véhicule(s) sélectionné(s). Ils passeront du statut <strong className="text-amber-600">Arrivage</strong> à <strong className="text-emerald-600">Parc</strong>.
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={isSubmitting || !uploadedFile || !reference.trim() || selectedVehicleIds.length === 0}
              onClick={handleValidateReception}
              className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm ${
                isSubmitting 
                  ? 'bg-indigo-400 text-white cursor-not-allowed'
                  : (!uploadedFile || !reference.trim() || selectedVehicleIds.length === 0)
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-md cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Validation en cours...
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  Valider la réception
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- Section Archive & Traçabilité --- */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Clock className="text-indigo-600 w-4 h-4" />
            Archive Logistique & Traçabilité (CMR / BL)
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Consultez les réceptions historiques archivées et identifiez instantanément quels véhicules ont été reçus sous quel document.
          </p>
        </div>

        {/* Archive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black tracking-wider border-b border-slate-100">
                <th className="py-3 px-5">Type / Réf</th>
                <th className="py-3 px-5">Transporteur</th>
                <th className="py-3 px-5 text-center">Date Réception</th>
                <th className="py-3 px-5 text-center">Véhicules Reçus</th>
                <th className="py-3 px-5 text-center">Coût Transport</th>
                <th className="py-3 px-5 text-center">Taille du PDF</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoadingArchive ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    <Loader2 className="animate-spin inline-block mr-2 w-4 h-4" />
                    Chargement de l'archive logistique...
                  </td>
                </tr>
              ) : archiveDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    Aucun document archivé pour le moment.
                  </td>
                </tr>
              ) : (
                archiveDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          doc.type === 'CMR' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {doc.type === 'CMR' ? 'CMR' : 'BL'}
                        </span>
                        <span className="font-extrabold text-slate-900">{doc.reference}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-600">
                      {doc.carrierName}
                    </td>
                    <td className="py-3.5 px-5 text-center font-bold text-slate-500">
                      {doc.date ? doc.date.split('-').reverse().join('/') : 'Inconnue'}
                    </td>
                    <td className="py-3.5 px-5 text-center font-black text-indigo-600">
                      {doc.linkedVehicles?.length || 0} véhicule(s)
                    </td>
                    <td className="py-3.5 px-5 text-center font-bold">
                      {doc.transportCost ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="font-extrabold text-slate-800">{doc.transportCost} €</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full mt-0.5 ${
                            doc.transportPaid 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {doc.transportPaid ? 'Payé' : 'Non payé'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono text-slate-400 font-bold">
                      {doc.pdfSize || 'N/A'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedArchiveDoc(doc)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg transition-colors cursor-pointer"
                          title="Voir les détails"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => downloadPdf(doc.pdfName, doc.pdfBase64)}
                          className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-lg transition-colors cursor-pointer"
                          title="Télécharger le PDF"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ARCHIVE DETAIL MODAL --- */}
      {selectedArchiveDoc && (
        <div 
          onClick={() => setSelectedArchiveDoc(null)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 cursor-default"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden cursor-default animate-fade-in-up"
          >
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Détail de la Réception Logistique
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Réf: {selectedArchiveDoc.reference}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedArchiveDoc(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              
              {/* Document Info Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Type de Document</span>
                  <div className="text-xs font-black text-slate-800 mt-0.5">
                    {selectedArchiveDoc.type === 'CMR' ? 'CMR (Lettre de voiture)' : 'Bon de livraison'}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Transporteur</span>
                  <div className="text-xs font-black text-slate-800 mt-0.5">
                    {selectedArchiveDoc.carrierName}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Date Réception</span>
                  <div className="text-xs font-black text-slate-800 mt-0.5">
                    {selectedArchiveDoc.date ? selectedArchiveDoc.date.split('-').reverse().join('/') : 'Inconnue'}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Nom du fichier PDF</span>
                  <div className="text-xs font-mono font-bold text-indigo-600 hover:underline mt-0.5 truncate cursor-pointer" onClick={() => downloadPdf(selectedArchiveDoc.pdfName, selectedArchiveDoc.pdfBase64)}>
                    {selectedArchiveDoc.pdfName}
                  </div>
                </div>

                {selectedArchiveDoc.transportCost !== undefined && selectedArchiveDoc.transportCost > 0 && (
                  <>
                    <div className="border-t border-slate-200/55 pt-2">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Coût Transport</span>
                      <div className="text-xs font-black text-slate-800 mt-0.5">
                        {selectedArchiveDoc.transportCost} €
                      </div>
                    </div>
                    <div className="border-t border-slate-200/55 pt-2">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Paiement Transport</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          selectedArchiveDoc.transportPaid 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {selectedArchiveDoc.transportPaid ? 'Payé' : 'Non payé'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleTransportPaid(selectedArchiveDoc.id, !!selectedArchiveDoc.transportPaid)}
                          className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                        >
                          Marquer comme {selectedArchiveDoc.transportPaid ? 'non payé' : 'payé'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Linked Vehicles Section */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2.5 flex items-center gap-1">
                  <Car size={12} className="text-indigo-600" />
                  Véhicules Associés ({selectedArchiveDoc.linkedVehicles?.length || 0})
                </h4>
                
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
                  {selectedArchiveDoc.linkedVehicles?.map(v => (
                    <div 
                      key={v.vehicleId}
                      className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex flex-col">
                        <div className="text-xs font-black text-slate-800">
                          {v.marque} {v.modele}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-0.5">
                          <span className="font-mono text-slate-600">VIN: {v.vin}</span>
                          <span>Immat: {v.immatriculation}</span>
                        </div>
                      </div>

                      {/* Link to vehicle file details */}
                      <button
                        onClick={() => {
                          window.location.hash = `vehicle/${v.vehicleId}`;
                          setSelectedArchiveDoc(null);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                      >
                        Voir Fiche
                        <ArrowRight size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400">
                Archivé le : {new Date(selectedArchiveDoc.createdAt).toLocaleString()}
              </span>
              <button
                onClick={() => downloadPdf(selectedArchiveDoc.pdfName, selectedArchiveDoc.pdfBase64)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                <Download size={13} />
                Télécharger le document PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
