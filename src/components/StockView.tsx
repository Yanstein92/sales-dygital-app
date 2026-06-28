import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, FileDown, Edit3, Trash2, Check, X, FileText, 
  Car, Eye, Sparkles, Key, AlertTriangle, UploadCloud, Info, ArrowUpDown, Building, File
} from 'lucide-react';
import { db, doc, setDoc, deleteDoc, getUserPath } from '../lib/firebase';
import { useApp } from '../lib/context';
import { Vehicle, VehicleDocument } from '../types';

interface Props {
  onShowToast: (m: string, t: 'success' | 'error') => void;
  onCreateBdc: (vehicle: Vehicle) => void;
}

const CAR_PARTS = [
  { id: 'optiques', label: 'Optiques / Phares', gridArea: 'lights' },
  { id: 'parechocs_av', label: 'Pare-chocs Avant', gridArea: 'front_bumper' },
  { id: 'capot', label: 'Capot', gridArea: 'hood' },
  { id: 'pare_brise', label: 'Pare-brise', gridArea: 'windshield' },
  { id: 'aile_av_g', label: 'Aile Avant Gauche', gridArea: 'wing_fl' },
  { id: 'toit', label: 'Toit', gridArea: 'roof' },
  { id: 'aile_av_d', label: 'Aile Avant Droite', gridArea: 'wing_fr' },
  { id: 'porte_av_g', label: 'Porte Avant Gauche', gridArea: 'door_fl' },
  { id: 'porte_av_d', label: 'Porte Avant Droite', gridArea: 'door_fr' },
  { id: 'porte_ar_g', label: 'Porte Arrière Gauche', gridArea: 'door_rl' },
  { id: 'porte_ar_d', label: 'Porte Arrière Droite', gridArea: 'door_rr' },
  { id: 'aile_ar_g', label: 'Aile Arrière Gauche', gridArea: 'wing_rl' },
  { id: 'coffre', label: 'Coffre / Hayon', gridArea: 'trunk' },
  { id: 'aile_ar_d', label: 'Aile Arrière Droite', gridArea: 'wing_rr' },
  { id: 'parechocs_ar', label: 'Pare-chocs Arrière', gridArea: 'rear_bumper' },
];

export const CarOutlineSVG: React.FC = () => (
  <svg viewBox="0 0 200 400" className="w-full h-full text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Left Mirror */}
    <path d="M 40,150 Q 23,150 28,160 Q 33,165 40,160" fill="#f8fafc" stroke="currentColor" strokeWidth="2" />
    {/* Right Mirror */}
    <path d="M 160,150 Q 177,150 172,160 Q 167,165 160,160" fill="#f8fafc" stroke="currentColor" strokeWidth="2" />
    
    {/* Main Body Outline */}
    <rect x="40" y="40" width="120" height="320" rx="40" fill="#f8fafc" stroke="currentColor" strokeWidth="2.5" />
    
    {/* Wheels (hidden under outline but visible in layout) */}
    {/* Front Left Wheel */}
    <rect x="33" y="75" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
    {/* Front Right Wheel */}
    <rect x="159" y="75" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
    {/* Rear Left Wheel */}
    <rect x="33" y="280" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
    {/* Rear Right Wheel */}
    <rect x="159" y="280" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />

    {/* Front bumper accent line */}
    <path d="M 55,44 Q 100,38 145,44" stroke="currentColor" strokeWidth="1.5" />
    {/* Rear bumper accent line */}
    <path d="M 55,356 Q 100,362 145,356" stroke="currentColor" strokeWidth="1.5" />

    {/* Windshield */}
    <path d="M 50,135 Q 100,120 150,135 L 145,170 Q 100,160 55,170 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />

    {/* Rear Window */}
    <path d="M 55,290 Q 100,298 145,290 L 140,315 Q 100,320 60,315 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />

    {/* Left Side Windows */}
    <path d="M 48,180 L 48,225 L 51,225 L 51,180 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />
    <path d="M 48,235 L 48,275 L 51,275 L 51,235 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />

    {/* Right Side Windows */}
    <path d="M 152,180 L 152,225 L 149,225 L 149,180 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />
    <path d="M 152,235 L 152,275 L 149,275 L 149,235 Z" fill="#e2e8f0" stroke="currentColor" strokeWidth="1.5" />

    {/* Inner Roof / Cab lines */}
    <path d="M 55,170 L 60,288" stroke="currentColor" strokeWidth="1.5" />
    <path d="M 145,170 L 140,288" stroke="currentColor" strokeWidth="1.5" />
    <path d="M 55,230 L 145,230" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />

    {/* Headlights */}
    <rect x="52" y="44" width="18" height="6" rx="2" fill="#fef08a" stroke="currentColor" strokeWidth="1" />
    <rect x="130" y="44" width="18" height="6" rx="2" fill="#fef08a" stroke="currentColor" strokeWidth="1" />

    {/* Taillights */}
    <rect x="50" y="348" width="18" height="6" rx="1.5" fill="#fca5a5" stroke="currentColor" strokeWidth="1" />
    <rect x="132" y="348" width="18" height="6" rx="1.5" fill="#fca5a5" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const StockView: React.FC<Props> = ({ onShowToast, onCreateBdc }) => {
  const { vehicles, userProfile, databaseUid } = useApp();
  
  // View states
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Filters
  const [filterSite, setFilterSite] = useState('Toutes');
  const [filterStatus, setFilterStatus] = useState('Tous');
  const [filterType, setFilterType] = useState('Tous');
  const [filterEnergy, setFilterEnergy] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<keyof Vehicle>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Form: Selected document type state for renaming on upload
  const [selectedDocType, setSelectedDocType] = useState('Carte grise');

  // Interactive Defect States
  const [damagedParts, setDamagedParts] = useState<Record<string, string>>({});

  // Companies present on user profile
  const userCompanies = useMemo(() => {
    const list = [userProfile?.companyId, ...(userProfile?.companiesList || [])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [userProfile]);

  // Generate unique Ref Interne
  const generateRefInterne = (): string => {
    const year = new Date().getFullYear().toString().slice(-2);
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RI-${year}-${rand}`;
  };

  // Generate sequential N° VO
  const generateNextNumVO = (): string => {
    const numbers = (vehicles || [])
      .map(v => parseInt(v.numVO || '0'))
      .filter(n => !isNaN(n) && n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    return (maxNum + 1).toString();
  };

  // New/Edit Vehicle initial form state
  const initialFormState = (): Partial<Vehicle> => ({
    site: userCompanies[0] || 'DJ CAR', // site corresponds to "Entreprise"
    type: 'VO',
    type2: 'VP',
    refInterne: '',
    numDossier: '', // Keep for schema, but we hide and auto-populate
    numVO: '',
    immatriculation: '',
    vin: '',
    marque: '',
    modele: '',
    version: '',
    mec: '',
    annee: new Date().getFullYear().toString(),
    energie: 'Diesel',
    couleur: '',
    precisionCouleur: '',
    genre: 'VP',
    carrosserie: '',
    boite: 'Manuelle',
    sellerie: '',
    couleurInterieure: '',
    segment: '',
    puissanceDin: undefined,
    puissanceFiscale: undefined,
    cylindree: undefined,
    nbPortes: 5,
    nbPlaces: 5,
    nbRapports: undefined,
    pays: 'France',
    kms: 0,
    kmGaranti: true,
    premiereMain: false,
    
    prixAchat: undefined,
    prixParticulierHT: undefined,
    prixParticulierTTC: undefined,
    prixProfessionnelHT: undefined,
    prixProfessionnelTTC: undefined,
    prixPromoHT: undefined,
    prixPromoTTC: undefined,
    prixSpecialHT: undefined,
    prixSpecialTTC: undefined,
    fraisEstimesHT: undefined,
    fraisEstimesTTC: undefined,
    tvaRecuperable: false,
    
    typeGarantie: 'Garantie constructeur',
    kmCompris: undefined,
    dateDebut: '',
    dateFin: '',
    dureeMois: 12,
    
    doubleCles: false,
    defauts: '',
    documents: [],
    status: 'PARC'
  });

  const [form, setForm] = useState<Partial<Vehicle>>(initialFormState());

  // Pinpoints State Management
  const [defautPoints, setDefautPoints] = useState<{ x: number; y: number; comment: string }[]>([]);
  const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null);
  const [newPinComment, setNewPinComment] = useState('');
  const [editingPinIndex, setEditingPinIndex] = useState<number | null>(null);
  const [editingPinComment, setEditingPinComment] = useState('');

  const syncPinsToDefauts = (pins: { x: number; y: number; comment: string }[]) => {
    const text = pins.map((p, i) => `${i + 1}. ${p.comment}`).join(', ');
    setForm(prev => ({ 
      ...prev, 
      defauts: text,
      defautPoints: pins
    }));
  };

  const handleAddPin = () => {
    if (!newPin) return;
    const comment = newPinComment.trim() || 'Défaut';
    const updated = [...defautPoints, { x: newPin.x, y: newPin.y, comment }];
    setDefautPoints(updated);
    syncPinsToDefauts(updated);
    setNewPin(null);
    setNewPinComment('');
  };

  const handleSavePinComment = () => {
    if (editingPinIndex === null) return;
    const comment = editingPinComment.trim() || 'Défaut';
    const updated = defautPoints.map((p, i) => i === editingPinIndex ? { ...p, comment } : p);
    setDefautPoints(updated);
    syncPinsToDefauts(updated);
    setEditingPinIndex(null);
    setEditingPinComment('');
  };

  const handleDeletePin = (index: number) => {
    const updated = defautPoints.filter((_, i) => i !== index);
    setDefautPoints(updated);
    syncPinsToDefauts(updated);
    setEditingPinIndex(null);
  };

  const handleCarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    setNewPin({ x, y });
    setNewPinComment('');
    setEditingPinIndex(null);
  };

  // Parse defauts string to damagedParts record
  const parseDefautsToRecord = (defStr: string): Record<string, string> => {
    const parts: Record<string, string> = {};
    if (!defStr) return parts;
    defStr.split(',').forEach(item => {
      const match = item.trim().match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        const label = match[1].trim();
        const desc = match[2].trim();
        const found = CAR_PARTS.find(p => p.label.toLowerCase() === label.toLowerCase());
        if (found) {
          parts[found.id] = desc;
        }
      } else {
        const trimmed = item.trim();
        if (trimmed) {
          const found = CAR_PARTS.find(p => trimmed.toLowerCase().includes(p.label.toLowerCase()));
          if (found) {
            parts[found.id] = trimmed;
          }
        }
      }
    });
    return parts;
  };

  // Sync defects record back to plain text field
  const syncDamagedPartsToString = (parts: Record<string, string>) => {
    const defStr = Object.entries(parts)
      .map(([id, desc]) => {
        const part = CAR_PARTS.find(p => p.id === id);
        return part ? `${part.label} (${desc || 'Défaut'})` : '';
      })
      .filter(Boolean)
      .join(', ');
    setForm(prev => ({ ...prev, defauts: defStr }));
  };

  // Auto-populate Ref Interne and N° VO on create
  useEffect(() => {
    if (isAdding && !form.refInterne) {
      setForm(prev => ({
        ...prev,
        refInterne: generateRefInterne(),
        numVO: generateNextNumVO(),
        numDossier: Math.random().toString(36).substring(2, 8).toUpperCase() // Keep auto populated background field
      }));
      setDamagedParts({});
    }
  }, [isAdding]);

  // Initialize defects parsing when editing
  useEffect(() => {
    if (isEditing && form.defauts) {
      setDamagedParts(parseDefautsToRecord(form.defauts));
    } else if (isEditing && !form.defauts) {
      setDamagedParts({});
    }
  }, [isEditing, form.id]);

  // Suggestions list
  const suggestions = useMemo(() => {
    const list = vehicles || [];
    const fields = {
      marque: new Set<string>(),
      modele: new Set<string>(),
      couleur: new Set<string>(),
      energie: new Set<string>(),
      carrosserie: new Set<string>(),
      boite: new Set<string>(),
      sellerie: new Set<string>(),
      segment: new Set<string>(),
      typeGarantie: new Set<string>()
    };

    list.forEach(v => {
      if (v.marque) fields.marque.add(v.marque);
      if (v.modele) fields.modele.add(v.modele);
      if (v.couleur) fields.couleur.add(v.couleur);
      if (v.energie) fields.energie.add(v.energie);
      if (v.carrosserie) fields.carrosserie.add(v.carrosserie);
      if (v.boite) fields.boite.add(v.boite);
      if (v.sellerie) fields.sellerie.add(v.sellerie);
      if (v.segment) fields.segment.add(v.segment);
      if (v.typeGarantie) fields.typeGarantie.add(v.typeGarantie);
    });

    if (fields.marque.size === 0) ['PEUGEOT', 'RENAULT', 'CITROEN', 'DACIA', 'VOLKSWAGEN', 'AUDI', 'BMW', 'MERCEDES', 'FIAT', 'TOYOTA'].forEach(m => fields.marque.add(m));
    if (fields.energie.size === 0) ['Diesel', 'Essence', 'Électrique', 'Hybride', 'GPL'].forEach(e => fields.energie.add(e));
    if (fields.boite.size === 0) ['Manuelle', 'Automatique'].forEach(b => fields.boite.add(b));
    if (fields.typeGarantie.size === 0) ['Garantie constructeur', 'Garantie 3 mois', 'Garantie 6 mois', 'Garantie 12 mois', 'Aucune'].forEach(g => fields.typeGarantie.add(g));

    return {
      marque: Array.from(fields.marque).sort(),
      modele: Array.from(fields.modele).sort(),
      couleur: Array.from(fields.couleur).sort(),
      energie: Array.from(fields.energie).sort(),
      carrosserie: Array.from(fields.carrosserie).sort(),
      boite: Array.from(fields.boite).sort(),
      sellerie: Array.from(fields.sellerie).sort(),
      segment: Array.from(fields.segment).sort(),
      typeGarantie: Array.from(fields.typeGarantie).sort()
    };
  }, [vehicles]);

  const handleInputChange = (field: keyof Vehicle, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate TTC if HT is edited and TVA is Recup
      if (field === 'prixParticulierHT' && value !== undefined) {
        updated.prixParticulierTTC = parseFloat((Number(value) * 1.2).toFixed(2));
      } else if (field === 'prixParticulierTTC' && value !== undefined) {
        updated.prixParticulierHT = parseFloat((Number(value) / 1.2).toFixed(2));
      }

      if (field === 'prixProfessionnelHT' && value !== undefined) {
        updated.prixProfessionnelTTC = parseFloat((Number(value) * 1.2).toFixed(2));
      } else if (field === 'prixProfessionnelTTC' && value !== undefined) {
        updated.prixProfessionnelHT = parseFloat((Number(value) / 1.2).toFixed(2));
      }

      if (field === 'prixPromoHT' && value !== undefined) {
        updated.prixPromoTTC = parseFloat((Number(value) * 1.2).toFixed(2));
      } else if (field === 'prixPromoTTC' && value !== undefined) {
        updated.prixPromoHT = parseFloat((Number(value) / 1.2).toFixed(2));
      }

      return updated;
    });
  };

  // Uploader helper for base64 documents with renaming rules
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    
    filesArray.forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        onShowToast(`Le fichier "${file.name}" dépasse la limite de 5 Mo.`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;

        // Smart rename using context
        const marque = (form.marque || 'MARQUE').trim().toUpperCase();
        const modele = (form.modele || 'MODELE').trim().toUpperCase();
        const typeV = form.type || 'VO';
        const vinCode = (form.vin || 'SANS_VIN').trim().toUpperCase();
        const plaque = (form.immatriculation || 'SANS_PLAQUE').trim().toUpperCase();
        
        // Find extension of uploaded file
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
        
        // Final standard formatted name
        const finalName = `${selectedDocType} - ${marque} ${modele} - ${typeV} - ${vinCode} - ${plaque}.${ext}`;

        const newDoc: VehicleDocument = {
          name: finalName,
          base64: base64String,
          uploadedAt: new Date().toISOString(),
          size: `${(file.size / 1024 / 1024).toFixed(2)} Mo`
        };

        setForm(prev => ({
          ...prev,
          documents: [...(prev.documents || []), newDoc]
        }));
        onShowToast(`Document "${finalName}" enregistré avec succès.`, 'success');
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDocument = (index: number) => {
    setForm(prev => ({
      ...prev,
      documents: (prev.documents || []).filter((_, i) => i !== index)
    }));
  };

  // Interactive defect click toggler
  const handleToggleDefect = (partId: string) => {
    setDamagedParts(prev => {
      const copy = { ...prev };
      if (copy[partId]) {
        delete copy[partId];
      } else {
        copy[partId] = 'Cabossé';
      }
      syncDamagedPartsToString(copy);
      return copy;
    });
  };

  const handleDefectDescriptionChange = (partId: string, desc: string) => {
    setDamagedParts(prev => {
      const copy = { ...prev, [partId]: desc };
      syncDamagedPartsToString(copy);
      return copy;
    });
  };

  // Save or Update Vehicle
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site) {
      onShowToast("L'Entreprise est obligatoire.", "error");
      return;
    }
    if (!form.marque || !form.modele) {
      onShowToast("La Marque et le Modèle sont obligatoires.", "error");
      return;
    }

    try {
      const vId = form.id || `v-${Date.now()}`;
      const finalVehicle: Vehicle = {
        ...(initialFormState() as Vehicle),
        ...form,
        id: vId,
        marque: form.marque.toUpperCase(),
        modele: form.modele.toUpperCase(),
        immatriculation: form.immatriculation ? form.immatriculation.toUpperCase() : '',
        vin: form.vin ? form.vin.toUpperCase() : '',
        createdAt: form.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, getUserPath('vehicles', databaseUid), vId), finalVehicle, { merge: true });
      onShowToast(form.id ? "Fiche véhicule mise à jour !" : "Véhicule enregistré avec succès !", "success");
      
      setIsAdding(false);
      setIsEditing(false);
      setSelectedVehicle(finalVehicle);
    } catch (err) {
      console.error(err);
      onShowToast("Erreur lors de l'enregistrement.", "error");
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = async (id: string) => {
    try {
      await deleteDoc(doc(db, getUserPath('vehicles', databaseUid), id));
      onShowToast("Véhicule supprimé du stock.", "success");
      setShowDeleteModal(null);
      setSelectedVehicle(null);
    } catch (err) {
      onShowToast("Erreur lors de la suppression.", "error");
    }
  };

  // Sort and Filter Logic
  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];

    // Filter by site/entreprise
    if (filterSite !== 'Toutes') {
      list = list.filter(v => v.site?.toUpperCase() === filterSite.toUpperCase());
    }

    // Filter by status
    if (filterStatus !== 'Tous') {
      list = list.filter(v => v.status === filterStatus);
    }

    // Filter by type
    if (filterType !== 'Tous') {
      list = list.filter(v => v.type === filterType);
    }

    // Filter by energy
    if (filterEnergy !== 'Tous') {
      list = list.filter(v => v.energie === filterEnergy);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(v => 
        v.marque?.toLowerCase().includes(query) ||
        v.modele?.toLowerCase().includes(query) ||
        v.immatriculation?.toLowerCase().includes(query) ||
        v.vin?.toLowerCase().includes(query) ||
        v.refInterne?.toLowerCase().includes(query) ||
        v.numVO?.toLowerCase().includes(query)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (valB === undefined) return sortDirection === 'asc' ? -1 : 1;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB as string)
          : (valB as string).localeCompare(valA);
      } else {
        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });

    return list;
  }, [vehicles, filterSite, filterStatus, filterType, filterEnergy, searchQuery, sortField, sortDirection]);

  // Bulk Export to CSV
  const handleExportCSV = () => {
    if (filteredVehicles.length === 0) {
      onShowToast("Aucun véhicule à exporter.", "error");
      return;
    }

    const headers = [
      'Entreprise / Depot Vente', 'Type', 'Type 2', 'Ref Interne', 'N VO', 'Immatriculation', 'VIN',
      'Marque', 'Modele', 'Version', 'MEC', 'Annee', 'Energie', 'Couleur', 'Kms', 'Prix d achat',
      'Prix Particulier TTC', 'Prix Pro TTC', 'Double de cles', 'Defauts', 'Garantie', 'Statut'
    ];

    const rows = filteredVehicles.map(v => [
      v.site || '',
      v.type || '',
      v.type2 || '',
      v.refInterne || '',
      v.numVO || '',
      v.immatriculation || '',
      v.vin || '',
      v.marque || '',
      v.modele || '',
      v.version || '',
      v.mec || '',
      v.annee || '',
      v.energie || '',
      v.couleur || '',
      v.kms || 0,
      v.prixAchat || '',
      v.prixParticulierTTC || '',
      v.prixProfessionnelTTC || '',
      v.doubleCles ? 'Oui' : 'Non',
      v.defauts?.replace(/"/g, '""') || '',
      v.typeGarantie || '',
      v.status || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_vehicules_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Export CSV réussi !", "success");
  };

  const handleSort = (field: keyof Vehicle) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Top Banner & Title */}
      <div className="bg-white border-b border-slate-100 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="text-blue-600 w-7 h-7" />
            Gestion de Stock
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            Visualisez et gérez le parc automobile de vos entreprises. Suivez l'administratif, l'état de carrosserie, les prix d'achat/vente et créez des bons de commande.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <FileDown size={15} />
            Exporter CSV ({filteredVehicles.length})
          </button>

          <button 
            onClick={() => {
              setForm(initialFormState());
              setDefautPoints([]);
              setIsAdding(true);
              setIsEditing(false);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus size={16} />
            Ajouter un Véhicule
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-auto p-8 flex flex-col gap-6">
        
        {/* Filters Panel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Rechercher Marque, Modèle, Immat, Réf, N° VO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-medium text-slate-800 transition-all outline-none"
              />
            </div>

            {/* Site / Entreprise Filter */}
            <div>
              <select
                value={filterSite}
                onChange={e => setFilterSite(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-700 transition-all outline-none"
              >
                <option value="Toutes">Toutes les Entreprises</option>
                {userCompanies.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Dépôt-vente">Dépôt-vente</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-700 transition-all outline-none"
              >
                <option value="Tous">Tous les États</option>
                <option value="PARC">Parc</option>
                <option value="ARRIVAGE">Arrivage</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_REPARATION">En réparation</option>
                <option value="VENDU">Vendu / Clôturé</option>
              </select>
            </div>

            {/* Type VN/VO */}
            <div>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-700 transition-all outline-none"
              >
                <option value="Tous">Type : Tous</option>
                <option value="VN">VN (Neuf)</option>
                <option value="VO">VO (Occasion)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vehicles Grid and Detail View Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* List Section */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider select-none">
                    <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('marque')}>
                      Véhicule <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('site')}>
                      Entreprise <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('refInterne')}>
                      Réf Interne <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('numVO')}>
                      N° VO <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all text-right" onClick={() => handleSort('prixParticulierTTC')}>
                      Prix TTC <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all text-center" onClick={() => handleSort('status')}>
                      Statut <ArrowUpDown size={10} className="inline ml-1" />
                    </th>
                    <th className="py-4 px-4 text-center">Clés</th>
                    <th className="py-4 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        <Car className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                        Aucun véhicule trouvé dans le stock
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map(v => {
                      const isSelected = selectedVehicle?.id === v.id;
                      return (
                        <tr 
                          key={v.id}
                          className={`hover:bg-slate-50/70 transition-all cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                          onClick={() => setSelectedVehicle(v)}
                        >
                          <td className="py-4 px-6">
                            <div className="font-extrabold text-slate-900">{v.marque} {v.modele}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold text-[9px]">{v.type}</span>
                              {v.type2 && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold text-[9px]">{v.type2}</span>}
                              <span>• {v.kms?.toLocaleString()} km</span>
                              <span>• {v.energie}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-800">{v.site || 'N/A'}</td>
                          <td className="py-4 px-4">
                            <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">
                              {v.refInterne || 'Générée'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-bold text-slate-600">
                              #{v.numVO || 'VO'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-black text-slate-950">
                            {v.prixParticulierTTC ? `${v.prixParticulierTTC.toLocaleString()} €` : '--'}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black inline-block tracking-wider ${
                              v.status === 'PARC' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              v.status === 'ARRIVAGE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              v.status === 'EN_COURS' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              v.status === 'EN_REPARATION' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {v.status === 'PARC' ? 'Parc' :
                               v.status === 'ARRIVAGE' ? 'Arrivage' :
                               v.status === 'EN_COURS' ? 'En cours' :
                               v.status === 'EN_REPARATION' ? 'En rép.' :
                               'Vendu'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center justify-center p-1 rounded-full ${v.doubleCles ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              <Key size={12} />
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => setSelectedVehicle(v)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all"
                                title="Voir la fiche"
                              >
                                <Eye size={15} />
                              </button>
                              
                              <button 
                                onClick={() => {
                                  setForm(v);
                                  setDefautPoints(v.defautPoints || []);
                                  setIsEditing(true);
                                  setIsAdding(false);
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-all"
                                title="Modifier"
                              >
                                <Edit3 size={15} />
                              </button>

                              <button 
                                onClick={() => setShowDeleteModal(v.id)}
                                className="p-1.5 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-all"
                                title="Supprimer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Side Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden p-6 select-none min-h-[400px]">
            {selectedVehicle ? (
              <div className="flex flex-col h-full gap-5">
                
                {/* Header detail */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded tracking-wider uppercase">
                      {selectedVehicle.site || 'Entreprise'}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2 uppercase">
                      {selectedVehicle.marque} {selectedVehicle.modele}
                    </h2>
                    <p className="text-slate-500 text-xs mt-0.5 font-medium">
                      {selectedVehicle.version || 'Version non précisée'}
                    </p>
                  </div>

                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider ${
                    selectedVehicle.status === 'PARC' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    selectedVehicle.status === 'ARRIVAGE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    selectedVehicle.status === 'EN_COURS' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    selectedVehicle.status === 'EN_REPARATION' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {selectedVehicle.status === 'PARC' ? 'Parc' : selectedVehicle.status}
                  </span>
                </div>

                <div className="border-t border-slate-100 my-1"></div>

                {/* Info List */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Immatriculation</span>
                    <span className="font-mono text-slate-900 font-extrabold">{selectedVehicle.immatriculation || 'Non renseignée'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Réf. Interne</span>
                    <span className="font-mono text-slate-900 font-extrabold">{selectedVehicle.refInterne || 'Générée'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">N° VO</span>
                    <span className="text-slate-900 font-extrabold">#{selectedVehicle.numVO || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">VIN (Châssis)</span>
                    <span className="font-mono text-slate-900 font-extrabold break-all text-[10px]">{selectedVehicle.vin || 'Non renseigné'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Kilométrage</span>
                    <span className="text-slate-900 font-extrabold">{selectedVehicle.kms?.toLocaleString()} Km</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Carburant</span>
                    <span className="text-slate-900 font-extrabold">{selectedVehicle.energie}</span>
                  </div>
                </div>

                {/* Specific features (Double Clés & Defects) */}
                <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Key size={14} className={selectedVehicle.doubleCles ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-xs font-semibold text-slate-700">Double de clés :</span>
                    <span className={`text-xs font-black ${selectedVehicle.doubleCles ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {selectedVehicle.doubleCles ? 'CONFIRMÉ / OUI' : 'NON DISPONIBLE'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-slate-200/50 pt-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={12} className="text-amber-500" />
                      État du véhicule / Défauts
                    </span>
                    <p className="text-xs text-slate-600 font-medium italic mt-0.5">
                      {selectedVehicle.defauts || 'Aucun défaut ou carrosserie impeccable.'}
                    </p>
                  </div>
                </div>

                {/* Documents section */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <FileText size={14} className="text-indigo-600" />
                    Administratif ({selectedVehicle.documents?.length || 0})
                  </span>
                  {selectedVehicle.documents && selectedVehicle.documents.length > 0 ? (
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                      {selectedVehicle.documents.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <span className="font-bold text-slate-700 truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                          <a 
                            href={doc.base64} 
                            download={doc.name}
                            className="text-[10px] text-blue-600 font-extrabold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-all cursor-pointer"
                          >
                            Télécharger
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Aucun document administratif uploadé.</span>
                  )}
                </div>

                {/* Price tags */}
                <div className="mt-auto bg-slate-900 text-white rounded-xl p-4 flex flex-col gap-2 shadow-sm">
                  {selectedVehicle.prixAchat && (
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>Prix d'achat</span>
                      <span className="font-bold text-slate-200">{selectedVehicle.prixAchat.toLocaleString()} € HT</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-400 font-semibold">Prix Particulier TTC</span>
                    <span className="text-base font-black text-emerald-400">
                      {selectedVehicle.prixParticulierTTC ? `${selectedVehicle.prixParticulierTTC.toLocaleString()} € TTC` : 'Non fixé'}
                    </span>
                  </div>
                  {selectedVehicle.prixProfessionnelTTC && (
                    <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                      <span className="text-slate-400">Prix Pro TTC</span>
                      <span className="font-extrabold text-slate-200">
                        {selectedVehicle.prixProfessionnelTTC.toLocaleString()} € TTC
                      </span>
                    </div>
                  )}
                </div>

                {/* BDC & Modification Actions */}
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    onClick={() => {
                      setForm(selectedVehicle);
                      setDefautPoints(selectedVehicle.defautPoints || []);
                      setIsEditing(true);
                      setIsAdding(false);
                    }}
                    className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Modifier la fiche
                  </button>

                  <button 
                    onClick={() => onCreateBdc(selectedVehicle)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl text-xs font-black shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    Créer un BDC
                  </button>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center font-medium">
                <Info className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                Sélectionnez un véhicule dans la liste pour voir sa fiche complète.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* --- ADD / EDIT VEHICLE MODAL --- */}
      {(isAdding || isEditing) && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {isEditing ? `Modifier : ${form.marque} ${form.modele}` : "Ajouter un véhicule au stock"}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Renseignez les détails pour l'inventaire de l'entreprise. Tous les champs sont modifiables après l'ajout.</p>
              </div>

              <button 
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setIsEditing(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Container */}
            <form onSubmit={handleSaveVehicle} className="flex-1 overflow-y-auto p-6">
              
              <div className="flex flex-col gap-6">
                
                {/* 1. Caractéristiques Générales */}
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-50 pb-1.5">
                    1. Caractéristiques Générales
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Entreprise (ex site) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Entreprise *</label>
                      <select
                        value={form.site || ''}
                        onChange={e => handleInputChange('site', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold outline-none text-slate-700"
                        required
                      >
                        {userCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Dépôt-vente">Dépôt-vente</option>
                      </select>
                    </div>

                    {/* Type VN/VO */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Type *</label>
                        <span className="group relative inline-block text-[10px] text-slate-400 cursor-help font-bold bg-slate-100 px-1 rounded">
                          [?]
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-950 text-white text-[9px] p-2 rounded-lg shadow-xl text-center z-50 normal-case font-medium leading-tight border border-slate-800">
                            VO = Véhicule d'Occasion<br/>VN = Véhicule Neuf
                          </span>
                        </span>
                      </div>
                      <select
                        value={form.type || 'VO'}
                        onChange={e => handleInputChange('type', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none"
                        required
                      >
                        <option value="VO">VO</option>
                        <option value="VN">VN</option>
                      </select>
                    </div>

                    {/* Type 2 : VU or VP */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Type 2 *</label>
                        <span className="group relative inline-block text-[10px] text-slate-400 cursor-help font-bold bg-slate-100 px-1 rounded">
                          [?]
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-40 bg-slate-950 text-white text-[9px] p-2 rounded-lg shadow-xl text-center z-50 normal-case font-medium leading-tight border border-slate-800">
                            VP = Véhicule Particulier<br/>VU = Véhicule Utilitaire
                          </span>
                        </span>
                      </div>
                      <select
                        value={form.type2 || 'VP'}
                        onChange={e => handleInputChange('type2', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none"
                        required
                      >
                        <option value="VP">VP</option>
                        <option value="VU">VU</option>
                      </select>
                    </div>

                    {/* Réf. Interne - Auto generated */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Réf. Interne
                      </label>
                      <input 
                        type="text"
                        value={form.refInterne || ''}
                        disabled
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 outline-none cursor-not-allowed"
                      />
                    </div>

                    {/* N° VO - Sequence Generated */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        N° VO
                      </label>
                      <input 
                        type="text"
                        value={form.numVO ? `#${form.numVO}` : ''}
                        disabled
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 outline-none cursor-not-allowed"
                      />
                    </div>

                    {/* Immat */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Immatriculation</label>
                      <input 
                        type="text"
                        value={form.immatriculation || ''}
                        onChange={e => handleInputChange('immatriculation', e.target.value)}
                        placeholder="AA-123-BB"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    {/* VIN code de chassis */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">VIN (Numéro de châssis)</label>
                      <input 
                        type="text"
                        value={form.vin || ''}
                        onChange={e => handleInputChange('vin', e.target.value)}
                        placeholder="UU1DJF012VA155286"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    {/* Marque */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Marque *</label>
                      <input 
                        type="text"
                        list="marque-list"
                        value={form.marque || ''}
                        onChange={e => handleInputChange('marque', e.target.value)}
                        placeholder="e.g. DACIA"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold outline-none"
                        required
                      />
                      <datalist id="marque-list">
                        {suggestions.marque.map(m => <option key={m} value={m} />)}
                      </datalist>
                    </div>

                    {/* Modèle */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Modèle *</label>
                      <input 
                        type="text"
                        list="modele-list"
                        value={form.modele || ''}
                        onChange={e => handleInputChange('modele', e.target.value)}
                        placeholder="e.g. DUSTER"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold outline-none"
                        required
                      />
                      <datalist id="modele-list">
                        {suggestions.modele.map(m => <option key={m} value={m} />)}
                      </datalist>
                    </div>

                    {/* Version */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Version</label>
                      <input 
                        type="text"
                        value={form.version || ''}
                        onChange={e => handleInputChange('version', e.target.value)}
                        placeholder="New Extreme 1.3 Tce 150 Ch BVA..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* MEC */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Date M.E.C.</label>
                      <input 
                        type="date"
                        value={form.mec || ''}
                        onChange={e => handleInputChange('mec', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none text-slate-700"
                      />
                    </div>

                    {/* Année */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Année</label>
                      <input 
                        type="number"
                        value={form.annee || ''}
                        onChange={e => handleInputChange('annee', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none text-slate-700"
                      />
                    </div>

                    {/* Kms */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Kilométrage (Kms)</label>
                      <input 
                        type="number"
                        value={form.kms === undefined ? '' : form.kms}
                        onChange={e => handleInputChange('kms', e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    {/* Energie */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Énergie</label>
                      <input 
                        type="text"
                        list="energie-list"
                        value={form.energie || ''}
                        onChange={e => handleInputChange('energie', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                      <datalist id="energie-list">
                        {suggestions.energie.map(e => <option key={e} value={e} />)}
                      </datalist>
                    </div>

                    {/* Couleur */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Couleur</label>
                      <input 
                        type="text"
                        list="couleur-list"
                        value={form.couleur || ''}
                        onChange={e => handleInputChange('couleur', e.target.value)}
                        placeholder="Gris Schiste..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                      <datalist id="couleur-list">
                        {suggestions.couleur.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>

                    {/* Précision Couleur */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Précision Couleur</label>
                      <input 
                        type="text"
                        value={form.precisionCouleur || ''}
                        onChange={e => handleInputChange('precisionCouleur', e.target.value)}
                        placeholder="Gris foncé métallisé"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* Carrosserie */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Carrosserie</label>
                      <input 
                        type="text"
                        list="carrosserie-list"
                        value={form.carrosserie || ''}
                        onChange={e => handleInputChange('carrosserie', e.target.value)}
                        placeholder="Suv, Berline..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                      <datalist id="carrosserie-list">
                        {suggestions.carrosserie.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>

                    {/* Boite de vitesse */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Boîte</label>
                      <select
                        value={form.boite || 'Manuelle'}
                        onChange={e => handleInputChange('boite', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold outline-none text-slate-700"
                      >
                        <option value="Manuelle">Manuelle</option>
                        <option value="Automatique">Automatique</option>
                      </select>
                    </div>

                    {/* Segment */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Segment</label>
                      <input 
                        type="text"
                        list="segment-list"
                        value={form.segment || ''}
                        onChange={e => handleInputChange('segment', e.target.value)}
                        placeholder="M1, SUV..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* Puissance DIN */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Puiss. DIN (Ch)</label>
                      <input 
                        type="number"
                        value={form.puissanceDin === undefined ? '' : form.puissanceDin}
                        onChange={e => handleInputChange('puissanceDin', e.target.value === '' ? undefined : parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* Puissance Fiscale */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Puiss. Fiscale (CV)</label>
                      <input 
                        type="number"
                        value={form.puissanceFiscale === undefined ? '' : form.puissanceFiscale}
                        onChange={e => handleInputChange('puissanceFiscale', e.target.value === '' ? undefined : parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* Cylindrée */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Cylindrée (cm³)</label>
                      <input 
                        type="number"
                        value={form.cylindree === undefined ? '' : form.cylindree}
                        onChange={e => handleInputChange('cylindree', e.target.value === '' ? undefined : parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold outline-none"
                      />
                    </div>

                    {/* Stock Status */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Statut Stock</label>
                      <select
                        value={form.status || 'PARC'}
                        onChange={e => handleInputChange('status', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="PARC">Parc (Disponible)</option>
                        <option value="ARRIVAGE">Arrivage</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="EN_REPARATION">En réparation</option>
                        <option value="VENDU">Vendu / Clôturé</option>
                      </select>
                    </div>

                    {/* Première Main */}
                    <div className="md:col-span-2 py-3 px-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={form.premiereMain || false}
                          onChange={e => handleInputChange('premiereMain', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Véhicule 1ère main</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. Prix d'Achat et de Vente */}
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-50 pb-1.5">
                    2. Tarification (EUR)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    {/* Prix d'achat */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Prix d'Achat (HT) *</span>
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={form.prixAchat === undefined ? '' : form.prixAchat}
                          onChange={e => handleInputChange('prixAchat', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="e.g. 11000"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-black outline-none"
                        />
                        <span className="ml-2 font-bold text-slate-500">€</span>
                      </div>
                    </div>

                    {/* Prix Particulier */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Prix Particulier (TTC) *</span>
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={form.prixParticulierTTC === undefined ? '' : form.prixParticulierTTC}
                          onChange={e => handleInputChange('prixParticulierTTC', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="e.g. 17900"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-black outline-none"
                        />
                        <span className="ml-2 font-bold text-slate-500">€</span>
                      </div>
                    </div>

                    {/* Prix Professionnel */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Prix Professionnel (TTC)</span>
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={form.prixProfessionnelTTC === undefined ? '' : form.prixProfessionnelTTC}
                          onChange={e => handleInputChange('prixProfessionnelTTC', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="e.g. 15400"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-black outline-none"
                        />
                        <span className="ml-2 font-bold text-slate-500">€</span>
                      </div>
                    </div>

                    {/* Prix Promo */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Prix Promo (TTC)</span>
                      <div className="flex items-center">
                        <input 
                          type="number"
                          value={form.prixPromoTTC === undefined ? '' : form.prixPromoTTC}
                          onChange={e => handleInputChange('prixPromoTTC', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          placeholder="e.g. 14900"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-black outline-none"
                        />
                        <span className="ml-2 font-bold text-slate-500">€</span>
                      </div>
                    </div>

                    {/* TVA Récupérable */}
                    <div className="md:col-span-4 py-3 px-1 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={form.tvaRecuperable || false}
                          onChange={e => handleInputChange('tvaRecuperable', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">TVA Récupérable (20%)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. État du Véhicule (Double de clés & Interactive Car Schema with Pins) */}
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-50 pb-1.5">
                    3. État du Véhicule
                  </h4>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left: Key status & List of defect points */}
                    <div className="flex flex-col gap-4">
                      {/* Double de clés */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Clés</span>
                        <label className="flex items-center gap-2.5 cursor-pointer mt-1 select-none">
                          <input 
                            type="checkbox"
                            checked={form.doubleCles || false}
                            onChange={e => handleInputChange('doubleCles', e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                              <Key size={13} className="text-emerald-600" />
                              Double de clés présent
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">Cocher pour confirmer le double de clés.</span>
                          </div>
                        </label>
                      </div>

                      {/* List of defect points */}
                      <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col gap-3 flex-1 min-h-[300px]">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                          Liste des défauts signalés ({defautPoints.length})
                        </span>

                        {defautPoints.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                            <span className="text-[20px]">📍</span>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Aucun défaut</span>
                            <span className="text-[9px] text-slate-400 mt-0.5">Cliquez sur l'illustration du véhicule à droite pour ajouter un point.</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                            {defautPoints.map((pin, i) => (
                              <div 
                                key={i} 
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                                  editingPinIndex === i 
                                    ? 'bg-blue-50/50 border-blue-200' 
                                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100/70'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">
                                    {i + 1}
                                  </span>
                                  {editingPinIndex === i ? (
                                    <input
                                      type="text"
                                      value={editingPinComment}
                                      onChange={e => setEditingPinComment(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSavePinComment();
                                      }}
                                      className="bg-white border border-blue-300 focus:border-blue-500 rounded px-1.5 py-0.5 text-[11px] outline-none text-slate-800 font-medium w-full"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="font-extrabold text-slate-700 truncate" title={pin.comment}>
                                      {pin.comment}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {editingPinIndex === i ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={handleSavePinComment}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                        title="Enregistrer"
                                      >
                                        <Check size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingPinIndex(null)}
                                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                        title="Annuler"
                                      >
                                        <X size={13} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPinIndex(i);
                                          setEditingPinComment(pin.comment);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                                        title="Modifier"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePin(i)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: The Interactive Diagram */}
                    <div className="lg:col-span-2 bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row gap-6">
                      
                      {/* Interactive Canvas */}
                      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-100 p-4 shadow-xs relative min-h-[440px]">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider absolute top-4 left-4 select-none">
                          Schéma du Véhicule
                        </span>

                        <div 
                          className="relative cursor-crosshair w-[210px] h-[410px] select-none flex items-center justify-center p-2 rounded-lg hover:ring-1 hover:ring-blue-100 transition-all"
                          onClick={handleCarClick}
                        >
                          <CarOutlineSVG />

                          {/* Render Placed Pinpoints */}
                          {defautPoints.map((pin, i) => (
                            <div
                              key={i}
                              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 group z-30"
                              onClick={e => {
                                e.stopPropagation();
                                setEditingPinIndex(i);
                                setEditingPinComment(pin.comment);
                              }}
                            >
                              <div className="w-6 h-6 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md animate-pulse cursor-pointer hover:scale-110 hover:bg-red-600 transition-all relative">
                                {i + 1}

                                {/* Mini Popover comment on hover */}
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-950 text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 font-semibold border border-slate-800">
                                  {pin.comment}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Render Temporary newPin Placement indicator */}
                          {newPin && (
                            <div
                              style={{ left: `${newPin.x}%`, top: `${newPin.y}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 z-40"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md animate-ping absolute" />
                              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md relative z-10">
                                +
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Side instructions / Point comment editor inside diagram */}
                      <div className="w-full md:w-56 shrink-0 flex flex-col justify-center gap-4">
                        <div>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Mode d'emploi</span>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                            1. Cliquez n'importe où sur l'illustration de la voiture pour déposer un point.<br/>
                            2. Saisissez la nature du défaut (rayure, bosse, phare cassé).<br/>
                            3. Validez pour l'ajouter à la fiche.
                          </p>
                        </div>

                        {newPin ? (
                          <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl flex flex-col gap-2.5">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">
                              Nouveau Défaut
                            </span>
                            <div className="text-[9px] text-slate-500 font-semibold bg-blue-100/50 px-1.5 py-0.5 rounded self-start">
                              Pos: X: {newPin.x}%, Y: {newPin.y}%
                            </div>
                            <input 
                              type="text"
                              placeholder="ex: Rayure profonde"
                              value={newPinComment}
                              onChange={e => setNewPinComment(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleAddPin();
                              }}
                              className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none"
                              autoFocus
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleAddPin}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer text-center"
                              >
                                Ajouter
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewPin(null)}
                                className="border border-slate-200 hover:bg-slate-50 text-slate-500 py-1.5 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer text-center"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-200 p-4 rounded-xl text-center bg-white">
                            <span className="text-[16px] block">💡</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase leading-snug">
                              Cliquez sur le schéma pour placer un repère
                            </span>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                </div>

                {/* 4. Administratif */}
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-50 pb-1.5">
                    4. Administratif
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Select Document Type AND upload */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Type de document à ajouter</label>
                        <select
                          value={selectedDocType}
                          onChange={e => setSelectedDocType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="Carte grise">Carte grise</option>
                          <option value="COC (Certificat d'origine)">COC (Certificat d'origine)</option>
                          <option value="CPI (Certificat provisoire d'immatriculation)">CPI (Certificat provisoire d'immatriculation)</option>
                          <option value="Déclaration de cession">Déclaration de cession</option>
                          <option value="Autres">Autres</option>
                        </select>
                      </div>

                      {/* Drag and Drop Box */}
                      <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl bg-white p-6 flex flex-col items-center justify-center transition-all cursor-pointer">
                        <input 
                          type="file" 
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleDocumentUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <UploadCloud className="w-8 h-8 text-blue-600 stroke-[1.5] mb-2" />
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Sélectionner ou Glisser le fichier</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-medium text-center">
                          Il sera renommé : <br/>
                          <span className="font-mono text-[8px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded inline-block mt-0.5">
                            {selectedDocType} - {form.marque || 'MARQUE'} {form.modele || 'MODELE'} - {form.type || 'VO'} ...
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Attached list */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fichiers attachés ({form.documents?.length || 0})</span>
                      {form.documents && form.documents.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                          {form.documents.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-xs">
                              <span className="font-bold text-slate-700 truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                              <button 
                                type="button"
                                onClick={() => removeDocument(idx)}
                                className="text-[10px] text-red-600 font-extrabold hover:bg-red-50 px-2 py-1 rounded cursor-pointer"
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic py-6 text-center">Aucun fichier joint pour le moment.</div>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Form Buttons */}
              <div className="border-t border-slate-100 mt-8 pt-6 flex items-center justify-end gap-3 select-none">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                  className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>

                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {isEditing ? "Mettre à jour le véhicule" : "Enregistrer dans le Stock"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm select-none">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Supprimer le véhicule ?</h3>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Êtes-vous sûr de vouloir retirer ce véhicule du stock ? Cette action est irréversible et supprimera également les documents attachés.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Annuler
              </button>

              <button 
                onClick={() => handleDeleteVehicle(showDeleteModal)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
