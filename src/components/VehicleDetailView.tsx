import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../lib/context';
import { db, getUserPath } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Vehicle, VehicleDocument } from '../types';
import { 
  ArrowLeft, Car, Calendar, Key, AlertTriangle, FileText, Sparkles, Info, Trash2, 
  Plus, Check, Euro, Activity, FileCheck, Shield, Clipboard, MapPin, Phone, 
  Mail, Users, RefreshCw, Layers, Sliders, CheckSquare, Settings, ChevronRight, X, Coins
} from 'lucide-react';
import { motion } from 'motion/react';

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

interface VehicleDetailViewProps {
  vehicleId: string;
  onBack: () => void;
  onShowToast: (message: string, type: 'success' | 'error') => void;
  onCreateBdc?: (vehicle: Vehicle) => void;
}

export const VehicleDetailView: React.FC<VehicleDetailViewProps> = ({ vehicleId, onBack, onShowToast, onCreateBdc }) => {
  const { vehicles, databaseUid, sales } = useApp();
  
  // Find vehicle
  const dbVehicle = useMemo(() => {
    return vehicles.find(v => v.id === vehicleId);
  }, [vehicles, vehicleId]);

  // Handle fallback or loading
  const [vehicle, setVehicle] = useState<Partial<Vehicle>>({});

  useEffect(() => {
    if (dbVehicle) {
      setVehicle(dbVehicle);
    }
  }, [dbVehicle]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'synthese' | 'vehicule' | 'expertise' | 'suivi' | 'achat' | 'reservation' | 'documents'>('synthese');
  
  // Price display mode (TTC or HT big)
  const [priceDisplayMode, setPriceDisplayMode] = useState<'ttc' | 'ht'>('ttc');

  // Local Equipments & Missing Elements State
  const [newOption, setNewOption] = useState('');
  const [newSerie, setNewSerie] = useState('');
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [missingItems, setMissingItems] = useState<{ id: string; name: string; status: string; date?: string }[]>([]);
  const [newMissingItem, setNewMissingItem] = useState('');

  // Expertise & carrosserie pin states
  const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null);
  const [newPinComment, setNewPinComment] = useState('');
  const [editingPinIndex, setEditingPinIndex] = useState<number | null>(null);
  const [editingPinComment, setEditingPinComment] = useState('');

  // Local Frais Réels HT state
  const [feesList, setFeesList] = useState<{ id: string; label: string; amount: number; date: string; vendor: string; isPaid: boolean }[]>([]);
  const [newFee, setNewFee] = useState({ label: '', amount: 0, date: new Date().toISOString().split('T')[0], vendor: '', isPaid: false });

  // Initialize Lists from vehicle if available
  useEffect(() => {
    if (dbVehicle) {
      // @ts-ignore
      setOptionsList(dbVehicle.optionsList || []);
      // @ts-ignore
      setSeriesList(dbVehicle.seriesList || []);
      // @ts-ignore
      setMissingItems(dbVehicle.missingItems || []);
      // @ts-ignore
      setFeesList(dbVehicle.feesList || []);
    }
  }, [dbVehicle]);

  if (!dbVehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center font-medium">
        <Info className="w-12 h-12 text-slate-300 stroke-[1.5] mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Véhicule introuvable</h2>
        <p className="text-slate-500 mt-2">Le véhicule demandé n'existe pas ou a été supprimé.</p>
        <button onClick={onBack} className="mt-6 flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black">
          <ArrowLeft size={14} /> Retour au stock
        </button>
      </div>
    );
  }

  // HT <-> TTC Auto conversions with standard VAT 20%
  const handlePriceChange = (field: keyof Vehicle, value: string) => {
    const num = parseFloat(value) || 0;
    setVehicle(prev => {
      const updated = { ...prev, [field]: num };

      // Conversions
      if (field === 'prixParticulierHT') {
        updated.prixParticulierTTC = parseFloat((num * 1.2).toFixed(2));
      } else if (field === 'prixParticulierTTC') {
        updated.prixParticulierHT = parseFloat((num / 1.2).toFixed(2));
      } else if (field === 'prixProfessionnelHT') {
        updated.prixProfessionnelTTC = parseFloat((num * 1.2).toFixed(2));
      } else if (field === 'prixProfessionnelTTC') {
        updated.prixProfessionnelHT = parseFloat((num / 1.2).toFixed(2));
      } else if (field === 'prixPromoHT') {
        updated.prixPromoTTC = parseFloat((num * 1.2).toFixed(2));
      } else if (field === 'prixPromoTTC') {
        updated.prixPromoHT = parseFloat((num / 1.2).toFixed(2));
      } else if (field === 'prixSpecialHT') {
        updated.prixSpecialTTC = parseFloat((num * 1.2).toFixed(2));
      } else if (field === 'prixSpecialTTC') {
        updated.prixSpecialHT = parseFloat((num / 1.2).toFixed(2));
      } else if (field === 'prixAchat') {
        // Auto margins if price purchase is set
      }

      return updated;
    });
  };

  const handleFieldChange = (field: keyof Vehicle, value: any) => {
    setVehicle(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save changes
  const handleSave = async () => {
    try {
      const finalVehicle: Vehicle = {
        ...dbVehicle,
        ...vehicle,
        // Ensure strings are standardized
        marque: String(vehicle.marque || '').toUpperCase(),
        modele: String(vehicle.modele || '').toUpperCase(),
        immatriculation: String(vehicle.immatriculation || '').toUpperCase(),
        vin: String(vehicle.vin || '').toUpperCase(),
        // @ts-ignore
        optionsList,
        // @ts-ignore
        seriesList,
        // @ts-ignore
        missingItems,
        // @ts-ignore
        feesList,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, getUserPath('vehicles', databaseUid), dbVehicle.id), finalVehicle, { merge: true });
      onShowToast("Fiche véhicule mise à jour avec succès !", "success");
    } catch (err) {
      console.error(err);
      onShowToast("Erreur lors de la mise à jour.", "error");
    }
  };

  const handleGenerateTechSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onShowToast("Veuillez autoriser les fenêtres pop-up pour générer la fiche.", "error");
      return;
    }

    const pinListHtml = (vehicle.defautPoints || []).map((pin, idx) => `
      <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 6px; font-size: 11px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background-color: #ef4444; color: white; font-weight: 800; font-size: 9px; line-height: 16px;">${idx + 1}</span>
        <span style="color: #334155; font-weight: 600; line-height: 16px;">${pin.comment}</span>
      </div>
    `).join('') || '<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin: 0;">Aucun défaut relevé sur le schéma.</p>';

    const optionsHtml = optionsList.map(o => `<li>${o}</li>`).join('') || '<li>Aucune option supplémentaire</li>';
    const seriesHtml = seriesList.map(s => `<li>${s}</li>`).join('') || '<li>Aucun équipement de série renseigné</li>';

    const missingHtml = missingItems.map(m => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 11px; color: #334155; font-weight: 600;">${m.name}</td>
        <td style="padding: 6px 0; font-size: 11px; text-align: right;"><span style="background-color: ${m.status === 'OK' ? '#d1fae5;' : '#fee2e2;'} color: ${m.status === 'OK' ? '#065f46;' : '#991b1b;'} padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 9px;">${m.status}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="2" style="padding: 10px 0; text-align: center; color: #94a3b8; font-style: italic; font-size: 11px;">Aucun élément manquant.</td></tr>';

    const svgContent = `
      <svg viewBox="0 0 200 400" style="width: 200px; height: 400px; color: #64748b;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 40,150 Q 23,150 28,160 Q 33,165 40,160" fill="#f8fafc" stroke="currentColor" stroke-width="2" />
        <path d="M 160,150 Q 177,150 172,160 Q 167,165 160,160" fill="#f8fafc" stroke="currentColor" stroke-width="2" />
        <rect x="40" y="40" width="120" height="320" rx="40" fill="#f8fafc" stroke="currentColor" stroke-width="2.5" />
        <rect x="33" y="75" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
        <rect x="159" y="75" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
        <rect x="33" y="280" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
        <rect x="159" y="280" width="8" height="24" rx="3" fill="#334155" stroke="#334155" />
        <path d="M 55,44 Q 100,38 145,44" stroke="currentColor" stroke-width="1.5" />
        <path d="M 55,356 Q 100,362 145,356" stroke="currentColor" stroke-width="1.5" />
        <path d="M 50,135 Q 100,120 150,135 L 145,170 Q 100,160 55,170 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 55,290 Q 100,298 145,290 L 140,315 Q 100,320 60,315 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 48,180 L 48,225 L 51,225 L 51,180 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 48,235 L 48,275 L 51,275 L 51,235 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 152,180 L 152,225 L 149,225 L 149,180 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 152,235 L 152,275 L 149,275 L 149,235 Z" fill="#e2e8f0" stroke="currentColor" stroke-width="1.5" />
        <path d="M 55,170 L 60,288" stroke="currentColor" stroke-width="1.5" />
        <path d="M 145,170 L 140,288" stroke="currentColor" stroke-width="1.5" />
        <path d="M 55,230 L 145,230" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" />
        <rect x="52" y="44" width="18" height="6" rx="2" fill="#fef08a" stroke="currentColor" stroke-width="1" />
        <rect x="130" y="44" width="18" height="6" rx="2" fill="#fef08a" stroke="currentColor" stroke-width="1" />
      </svg>
    `;

    const printPinsHtml = (vehicle.defautPoints || []).map((pin, i) => `
      <div style="position: absolute; left: ${pin.x}%; top: ${pin.y}%; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 50%; background-color: #ef4444; color: white; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; z-index: 10;">
        ${i + 1}
      </div>
    `).join('');

    const rawHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fiche Technique - ${vehicle.marque || ''} ${vehicle.modele || ''} ${vehicle.version || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
          }
          .header {
            border-bottom: 3px solid #0f172a;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .company-name {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #0f172a;
          }
          .doc-title {
            font-size: 14px;
            font-weight: 800;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .vehicle-title {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -1px;
            color: #0f172a;
            margin: 0;
          }
          .vehicle-version {
            font-size: 12px;
            font-weight: 500;
            color: #64748b;
            margin-top: 4px;
            margin-bottom: 0;
          }
          .grid {
            display: grid;
            grid-template-cols: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #4f46e5;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 0;
            margin-bottom: 12px;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-table tr {
            border-bottom: 1px solid #f1f5f9;
          }
          .info-table td {
            padding: 8px 0;
            font-size: 11.5px;
          }
          .info-label {
            font-weight: 500;
            color: #64748b;
            width: 45%;
          }
          .info-value {
            font-weight: 700;
            color: #0f172a;
            text-align: right;
          }
          .list-container {
            font-size: 11px;
            color: #334155;
            padding-left: 20px;
            margin: 0;
          }
          .list-container li {
            margin-bottom: 6px;
            font-weight: 600;
          }
          .badge {
            background-color: #f1f5f9;
            color: #334155;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 9px;
            display: inline-block;
          }
          .footer {
            margin-top: 50px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="doc-title">Fiche Technique Véhicule</div>
            <h1 class="vehicle-title">${vehicle.marque || ''} ${vehicle.modele || ''} ${vehicle.version || ''}</h1>
            <p class="vehicle-version">${vehicle.version || ''}</p>
          </div>
          <div style="text-align: right;">
            <div class="company-name">${vehicle.site || 'DJ CAR'}</div>
            <div style="font-size: 10px; color: #94a3b8; font-weight: 700; margin-top: 4px;">Fiche imprimée le : ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div class="grid">
          <div>
            <h2 class="section-title">Caractéristiques Principales</h2>
            <table class="info-table">
              <tr>
                <td class="info-label">Numéro VO</td>
                <td class="info-value">${vehicle.numVO || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Numéro Dossier</td>
                <td class="info-value">${vehicle.numDossier || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Référence Interne</td>
                <td class="info-value">${vehicle.refInterne || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Immatriculation</td>
                <td class="info-value">${vehicle.immatriculation || 'Non immatriculé'}</td>
              </tr>
              <tr>
                <td class="info-label">Numéro de Châssis (VIN)</td>
                <td class="info-value" style="font-family: monospace; font-size: 11px;">${vehicle.vin || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Date MEC</td>
                <td class="info-value">${vehicle.mec || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Année</td>
                <td class="info-value">${vehicle.annee || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Kilométrage</td>
                <td class="info-value">${vehicle.kms ? vehicle.kms.toLocaleString('fr-FR') : '0'} km ${vehicle.kmGaranti ? '(Garanti)' : ''}</td>
              </tr>
              ${vehicle.paysProvenance ? `
              <tr>
                <td class="info-label">Pays de provenance</td>
                <td class="info-value">${vehicle.paysProvenance}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div>
            <h2 class="section-title">Spécifications Moteur & Esthétique</h2>
            <table class="info-table">
              <tr>
                <td class="info-label">Énergie / Carburant</td>
                <td class="info-value">${vehicle.energie || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Boîte de vitesses</td>
                <td class="info-value">${vehicle.boite || 'N/A'}</td>
              </tr>
              <tr>
                <td class="info-label">Teinte Extérieure</td>
                <td class="info-value">${vehicle.couleur || 'N/A'} ${vehicle.precisionCouleur ? `(${vehicle.precisionCouleur})` : ''}</td>
              </tr>
              <tr>
                <td class="info-label">Sellerie & Couleur Int.</td>
                <td class="info-value">${vehicle.sellerie || 'N/A'} ${vehicle.couleurInterieure ? `/ ${vehicle.couleurInterieure}` : ''}</td>
              </tr>
              <tr>
                <td class="info-label">Puissance Fiscale</td>
                <td class="info-value">${vehicle.puissanceFiscale || 'N/A'} CV</td>
              </tr>
              <tr>
                <td class="info-label">Puissance DIN</td>
                <td class="info-value">${vehicle.puissanceDin || 'N/A'} ch</td>
              </tr>
              <tr>
                <td class="info-label">Nombre de places / portes</td>
                <td class="info-value">${vehicle.nbPlaces || 'N/A'} pl. / ${vehicle.nbPortes || 'N/A'} p.</td>
              </tr>
              <tr>
                <td class="info-label">Double de clés</td>
                <td class="info-value">${vehicle.doubleCles ? 'Oui' : 'Non'}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="grid">
          <div>
            <h2 class="section-title">Équipements de Série</h2>
            <ul class="list-container">
              ${seriesHtml}
            </ul>
          </div>

          <div>
            <h2 class="section-title">Options Supplémentaires</h2>
            <ul class="list-container">
              ${optionsHtml}
            </ul>
          </div>
        </div>

        <div class="grid" style="grid-template-cols: 0.9fr 1.1fr; gap: 30px; margin-top: 20px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 440px;">
            <div style="position: relative; width: 200px; height: 400px;">
              ${svgContent}
              ${printPinsHtml}
            </div>
          </div>
          <div>
            <h2 class="section-title">Défauts Relevés & Remarques</h2>
            <div style="margin-top: 10px;">
              ${pinListHtml}
            </div>
            
            <div style="margin-top: 20px; font-size: 11.5px; line-height: 1.6; color: #334155; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 15px;">
              <strong style="color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Commentaire général carrosserie :</strong>
              <span style="font-weight: 500; color: #78350f;">${vehicle.defauts || 'Aucun commentaire général enregistré.'}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 30px; border-top: 1.5px solid #e2e8f0; padding-top: 15px;">
          <h2 class="section-title">Suivi des Éléments Manquants</h2>
          <table class="info-table" style="margin-top: 10px;">
            ${missingHtml}
          </table>
        </div>

        <div class="footer">
          Fiche générée automatiquement par le logiciel CRM de ${vehicle.site || 'DJ CAR'}. Document à valeur informative non contractuel.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(rawHtml);
    printWindow.document.close();
  };

  // Document Uploads
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    filesArray.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Content = reader.result as string;
        const newDoc: VehicleDocument = {
          name: file.name,
          base64: base64Content,
          uploadedAt: new Date().toISOString(),
          size: `${(file.size / 1024 / 1024).toFixed(2)} Mo`
        };

        const updatedDocs = [...(vehicle.documents || []), newDoc];
        setVehicle(prev => ({ ...prev, documents: updatedDocs }));
        
        // Auto-save the new doc
        try {
          await setDoc(doc(db, getUserPath('vehicles', databaseUid), dbVehicle.id), {
            documents: updatedDocs,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          onShowToast(`Document "${file.name}" ajouté et sauvegardé !`, "success");
        } catch (err) {
          onShowToast("Erreur lors de la sauvegarde du document.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDocDelete = async (index: number) => {
    const updatedDocs = (vehicle.documents || []).filter((_, i) => i !== index);
    setVehicle(prev => ({ ...prev, documents: updatedDocs }));

    try {
      await setDoc(doc(db, getUserPath('vehicles', databaseUid), dbVehicle.id), {
        documents: updatedDocs,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      onShowToast("Document supprimé !", "success");
    } catch (err) {
      onShowToast("Erreur de suppression.", "error");
    }
  };

  // Add items functions
  const addOptionItem = () => {
    if (newOption.trim()) {
      setOptionsList(prev => [...prev, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOptionItem = (idx: number) => {
    setOptionsList(prev => prev.filter((_, i) => i !== idx));
  };

  const addSerieItem = () => {
    if (newSerie.trim()) {
      setSeriesList(prev => [...prev, newSerie.trim()]);
      setNewSerie('');
    }
  };

  const removeSerieItem = (idx: number) => {
    setSeriesList(prev => prev.filter((_, i) => i !== idx));
  };

  const addMissingItem = () => {
    if (newMissingItem.trim()) {
      setMissingItems(prev => [...prev, {
        id: `m-${Date.now()}`,
        name: newMissingItem.trim(),
        status: 'A récupérer'
      }]);
      setNewMissingItem('');
    }
  };

  const toggleMissingItemStatus = (id: string) => {
    setMissingItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: item.status === 'Reçu' ? 'A récupérer' : 'Reçu',
          date: item.status === 'Reçu' ? undefined : new Date().toISOString().split('T')[0]
        };
      }
      return item;
    }));
  };

  const removeMissingItem = (id: string) => {
    setMissingItems(prev => prev.filter(i => i.id !== id));
  };

  const addFeeItem = () => {
    if (newFee.label.trim() && newFee.amount > 0) {
      setFeesList(prev => [...prev, {
        id: `fee-${Date.now()}`,
        label: newFee.label.trim(),
        amount: newFee.amount,
        date: newFee.date,
        vendor: newFee.vendor.trim() || 'Non précisé',
        isPaid: newFee.isPaid
      }]);
      setNewFee({ label: '', amount: 0, date: new Date().toISOString().split('T')[0], vendor: '', isPaid: false });
    }
  };

  const removeFeeItem = (id: string) => {
    setFeesList(prev => prev.filter(f => f.id !== id));
  };

  // Diagram Pin Handlers
  const handleDetailCarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));
    setNewPin({ x, y });
    setNewPinComment('');
  };

  const handleAddDetailPin = () => {
    if (!newPin) return;
    const comment = newPinComment.trim() || 'Défaut';
    const currentPoints = vehicle.defautPoints || [];
    const updated = [...currentPoints, { x: newPin.x, y: newPin.y, comment }];
    
    setVehicle(prev => {
      const text = updated.map((p, i) => `${i + 1}. ${p.comment}`).join(', ');
      return {
        ...prev,
        defautPoints: updated,
        defauts: text
      };
    });
    setNewPin(null);
    setNewPinComment('');
  };

  const handleSaveDetailPinComment = () => {
    if (editingPinIndex === null) return;
    const comment = editingPinComment.trim() || 'Défaut';
    const currentPoints = vehicle.defautPoints || [];
    const updated = currentPoints.map((p, i) => i === editingPinIndex ? { ...p, comment } : p);
    
    setVehicle(prev => {
      const text = updated.map((p, i) => `${i + 1}. ${p.comment}`).join(', ');
      return {
        ...prev,
        defautPoints: updated,
        defauts: text
      };
    });
    setEditingPinIndex(null);
    setEditingPinComment('');
  };

  const handleDeleteDetailPin = (index: number) => {
    const currentPoints = vehicle.defautPoints || [];
    const updated = currentPoints.filter((_, i) => i !== index);
    
    setVehicle(prev => {
      const text = updated.map((p, i) => `${i + 1}. ${p.comment}`).join(', ');
      return {
        ...prev,
        defautPoints: updated,
        defauts: text
      };
    });
    setEditingPinIndex(null);
  };

  // Financial Margin calculations
  const finances = useMemo(() => {
    const pAchat = vehicle.prixAchat || 0;
    const totalFees = feesList.reduce((sum, f) => sum + f.amount, 0) + (vehicle.fraisEstimesHT || 0);
    const costPrice = pAchat + totalFees;
    const saleHT = vehicle.prixParticulierHT || 0;
    const margin = saleHT - costPrice;
    const marginPercent = saleHT > 0 ? (margin / saleHT) * 100 : 0;

    return {
      totalFees,
      costPrice,
      margin,
      marginPercent
    };
  }, [vehicle.prixAchat, vehicle.prixParticulierHT, vehicle.fraisEstimesHT, feesList]);

  // Related Sales to this Vehicle
  const relatedSales = useMemo(() => {
    return sales.filter(s => s.vin?.toUpperCase() === dbVehicle.vin?.toUpperCase() && s.vin);
  }, [sales, dbVehicle.vin]);

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Breadcrumb, Title and Action Buttons */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden select-none">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        
        <div className="relative z-10">
          {/* Breadcrumb & Discrete Back Button */}
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <div className="text-slate-400 text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <span>Véhicules</span>
              <ChevronRight size={10} />
              <span>Stock</span>
              <ChevronRight size={10} />
              <span className="text-indigo-400">Fiche N° {vehicle.numVO || 'N/A'}</span>
            </div>
            <button 
              onClick={onBack}
              className="text-xs text-slate-300 hover:text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft size={12} /> Retour au stock
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                  <Car className="text-indigo-400 w-7 h-7" />
                  {vehicle.marque} {vehicle.modele} {vehicle.version}
                </h1>
                
                {/* Status Badges */}
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  vehicle.status === 'PARC' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                  vehicle.status === 'ARRIVAGE' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  vehicle.status === 'EN_COURS' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  vehicle.status === 'EN_REPARATION' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                  'bg-slate-500/20 text-slate-300 border-slate-500/30'
                }`}>
                  {vehicle.status}
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                  {vehicle.type || 'VO'}
                </span>
              </div>
              <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-3xl truncate">
                {vehicle.version || 'Version non précisée'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {onCreateBdc && (
                <button 
                  onClick={() => onCreateBdc(vehicle as Vehicle)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Créer un bon de commande
                </button>
              )}

              <button 
                onClick={handleGenerateTechSheet}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileText size={14} /> Générer Fiche Technique
              </button>
              
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-slate-700/20 transition-all cursor-pointer"
              >
                <Check size={14} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Horizontal Tabs Menu */}
      <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-xs flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none select-none">
        {[
          { id: 'synthese', label: 'Synthèse', icon: Layers },
          { id: 'vehicule', label: 'Fiche technique', icon: Sliders },
          { id: 'expertise', label: 'Expertise', icon: Shield },
          { id: 'suivi', label: 'Suivi', icon: Clipboard },
          { id: 'achat', label: 'Achat', icon: Coins },
          { id: 'reservation', label: 'Réservation', icon: Users },
          { id: 'documents', label: 'Administratif', icon: FileCheck },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Panel Contents */}
      <div className="min-h-[500px]">
        {activeTab === 'synthese' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Box: Summary Details */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs relative overflow-hidden">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Car size={16} className="text-indigo-500" />
                  Caractéristiques Principales
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Car Outline / Visual Mock */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center min-h-[180px] select-none relative group">
                    <Car size={80} className="text-slate-300 stroke-[1] group-hover:scale-105 transition-all duration-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Illustration Véhicule</span>
                    <span className="absolute bottom-3 text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">Stock</span>
                  </div>

                  {/* General attributes table */}
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">Site / Entreprise :</span>
                      <span className="text-slate-800 font-black">{vehicle.site || 'DJ CAR'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">Type de Véhicule :</span>
                      <span className="text-slate-800 font-black">{vehicle.type || 'VO'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">Kilométrage :</span>
                      <span className="text-slate-800 font-black">{(vehicle.kms || 0).toLocaleString()} Km</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">M.E.C (Mise en circulation) :</span>
                      <span className="text-slate-800 font-black">{vehicle.mec || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">Énergie / Carburant :</span>
                      <span className="text-slate-800 font-black">{vehicle.energie || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-semibold">Couleur :</span>
                      <span className="text-slate-800 font-black">{vehicle.couleur || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-semibold">Pays de provenance :</span>
                      <span className="text-indigo-600 font-black">{vehicle.paysProvenance || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Immatriculation</span>
                    <span className="text-sm font-mono font-black text-slate-800 tracking-wider block mt-1">{vehicle.immatriculation || 'N/A'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">Numéro de Châssis (VIN)</span>
                    <span className="text-sm font-mono font-black text-slate-800 tracking-wider block mt-1 break-all select-all">{vehicle.vin || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Related Dossiers Info */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clipboard size={16} className="text-indigo-500" />
                  Historique / Dossiers Associés ({relatedSales.length})
                </h3>
                {relatedSales.length > 0 ? (
                  <div className="space-y-3">
                    {relatedSales.map(sale => (
                      <div key={sale.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-black text-slate-800 text-sm">BDC #{sale.bdcNumber}</div>
                          <div className="text-slate-500 mt-0.5">Client : <span className="font-bold">{sale.clientName}</span></div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-slate-900">{(sale.price).toLocaleString()} €</div>
                          <div className="text-slate-400 text-[10px] font-bold mt-0.5">{sale.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs italic text-center py-6 bg-slate-50 rounded-xl border border-slate-100/50">
                    Aucun bon de commande associé à ce numéro VIN pour l'instant.
                  </div>
                )}
              </div>

            </div>

            {/* Right Box: Quick Settings & Side panels */}
            <div className="space-y-6">
              
              {/* Target Sales Prices Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 opacity-10 bg-gradient-to-tr from-emerald-400 to-transparent pointer-events-none rounded-full" />
                
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Coins size={14} className="text-emerald-400" />
                    Prix de Vente Conseillés
                  </h3>
                  
                  {/* Interactive toggle button */}
                  <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setPriceDisplayMode('ttc')}
                      className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                        priceDisplayMode === 'ttc'
                          ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      TTC
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceDisplayMode('ht')}
                      className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                        priceDisplayMode === 'ht'
                          ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      HT
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {priceDisplayMode === 'ttc' ? (
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider block">Prix Particulier TTC (Grand)</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1">
                        {(vehicle.prixParticulierTTC || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        <span className="text-slate-400 text-[10px] font-bold uppercase">TTC</span>
                      </div>
                      <span className="text-slate-500 text-[10px] font-bold mt-1.5 block">Prix Particulier HT : <span className="text-slate-300">{(vehicle.prixParticulierHT || 0).toLocaleString('fr-FR')} € HT</span></span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider block">Prix Particulier HT (Grand)</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1">
                        {(vehicle.prixParticulierHT || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        <span className="text-slate-400 text-[10px] font-bold uppercase">HT</span>
                      </div>
                      <span className="text-slate-500 text-[10px] font-bold mt-1.5 block">Prix Particulier TTC : <span className="text-slate-300">{(vehicle.prixParticulierTTC || 0).toLocaleString('fr-FR')} € TTC</span></span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold block">Prix Pro HT</span>
                      <span className="text-slate-200 font-black">{(vehicle.prixProfessionnelHT || 0).toLocaleString()} €</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Prix Plancher Pro HT</span>
                      <span className="text-slate-200 font-black">{(vehicle.prixAchat || 0).toLocaleString()} €</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Defects Summary */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 shadow-xs">
                <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  État du Véhicule / Défauts
                </h3>
                <p className="text-xs text-slate-700 font-medium leading-relaxed italic bg-white/75 p-3.5 rounded-xl border border-amber-100/50">
                  {vehicle.defauts || 'Aucun défaut ou carrosserie impeccable renseignée.'}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <Key size={12} className={vehicle.doubleCles ? 'text-emerald-500' : 'text-slate-400'} />
                  Double de clés : <span className={vehicle.doubleCles ? 'text-emerald-600' : 'text-slate-400'}>{vehicle.doubleCles ? 'CONFIRMÉ / OUI' : 'NON DISPONIBLE'}</span>
                </div>
              </div>

              {/* Related Files Quick Links */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" />
                  Documents ({vehicle.documents?.length || 0})
                </h3>
                {vehicle.documents && vehicle.documents.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {vehicle.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold">
                        <span className="text-slate-700 truncate max-w-[150px]">{doc.name}</span>
                        <a href={doc.base64} download={doc.name} className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all">
                          Télécharger
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs italic text-center py-4">
                    Aucun document administratif.
                  </div>
                )}
              </div>

            </div>

          </motion.div>
        )}

        {activeTab === 'vehicule' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Spec Fields Box */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Sliders size={16} className="text-indigo-500" />
                Caractéristiques Générales du Véhicule (Éditables)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Site / Entreprise</label>
                  <select 
                    value={vehicle.site || ''} 
                    onChange={e => handleFieldChange('site', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="DJ CAR">DJ CAR</option>
                    <option value="KDB AUTO">KDB AUTO</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Type de produit</label>
                  <select 
                    value={vehicle.type || 'VO'} 
                    onChange={e => handleFieldChange('type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="VO">VO (Véhicule Occasion)</option>
                    <option value="VN">VN (Véhicule Neuf)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Genre (VP / VU)</label>
                  <input 
                    type="text" 
                    value={vehicle.genre || ''} 
                    onChange={e => handleFieldChange('genre', e.target.value)}
                    placeholder="ex: VP"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Immatriculation</label>
                  <input 
                    type="text" 
                    value={vehicle.immatriculation || ''} 
                    onChange={e => handleFieldChange('immatriculation', e.target.value.toUpperCase())}
                    placeholder="ex: AA-123-BB"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold font-mono tracking-wider text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">N° de Châssis (VIN)</label>
                  <input 
                    type="text" 
                    value={vehicle.vin || ''} 
                    onChange={e => handleFieldChange('vin', e.target.value.toUpperCase())}
                    placeholder="ex: UU1DJ..."
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Marque</label>
                  <input 
                    type="text" 
                    value={vehicle.marque || ''} 
                    onChange={e => handleFieldChange('marque', e.target.value)}
                    placeholder="ex: DACIA"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Modèle</label>
                  <input 
                    type="text" 
                    value={vehicle.modele || ''} 
                    onChange={e => handleFieldChange('modele', e.target.value)}
                    placeholder="ex: DUSTER"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Version Complète</label>
                  <input 
                    type="text" 
                    value={vehicle.version || ''} 
                    onChange={e => handleFieldChange('version', e.target.value)}
                    placeholder="ex: New Extreme 1.3 Tce 150 Ch BVA"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Couleur Extérieure</label>
                  <input 
                    type="text" 
                    value={vehicle.couleur || ''} 
                    onChange={e => handleFieldChange('couleur', e.target.value)}
                    placeholder="ex: Gris Schiste"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Énergie / Carburant</label>
                  <select 
                    value={vehicle.energie || ''} 
                    onChange={e => handleFieldChange('energie', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Essence">Essence</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Hybride">Hybride</option>
                    <option value="Électrique">Électrique</option>
                    <option value="GPL">GPL</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Type de Boite</label>
                  <select 
                    value={vehicle.boite || ''} 
                    onChange={e => handleFieldChange('boite', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Boite manuelle">Boite Manuelle</option>
                    <option value="Boite automatique">Boite Automatique</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Kilométrage (Kms)</label>
                  <input 
                    type="number" 
                    value={vehicle.kms || 0} 
                    onChange={e => handleFieldChange('kms', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Année de Fabrication</label>
                  <input 
                    type="text" 
                    value={vehicle.annee || ''} 
                    onChange={e => handleFieldChange('annee', e.target.value)}
                    placeholder="ex: 2026"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Mise en Circulation (M.E.C.)</label>
                  <input 
                    type="text" 
                    value={vehicle.mec || ''} 
                    onChange={e => handleFieldChange('mec', e.target.value)}
                    placeholder="ex: 27/06/2026"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Puissance DIN (ch)</label>
                  <input 
                    type="number" 
                    value={vehicle.puissanceDin || ''} 
                    onChange={e => handleFieldChange('puissanceDin', parseInt(e.target.value) || '')}
                    placeholder="ex: 150"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Puissance Fiscale (cv)</label>
                  <input 
                    type="number" 
                    value={vehicle.puissanceFiscale || ''} 
                    onChange={e => handleFieldChange('puissanceFiscale', parseInt(e.target.value) || '')}
                    placeholder="ex: 6"
                    className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Nombre de Portes / Places</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      value={vehicle.nbPortes || ''} 
                      onChange={e => handleFieldChange('nbPortes', parseInt(e.target.value) || '')}
                      placeholder="Portes"
                      className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                    />
                    <input 
                      type="number" 
                      value={vehicle.nbPlaces || ''} 
                      onChange={e => handleFieldChange('nbPlaces', parseInt(e.target.value) || '')}
                      placeholder="Places"
                      className="w-full bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 md:col-span-3 pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 text-xs font-black text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={vehicle.premiereMain || false} 
                      onChange={e => handleFieldChange('premiereMain', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    Véhicule Première Main
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-black text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={vehicle.kmGaranti || false} 
                      onChange={e => handleFieldChange('kmGaranti', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    Kilométrage Garanti
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-black text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={vehicle.doubleCles || false} 
                      onChange={e => handleFieldChange('doubleCles', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    Présence du Double de Clés
                  </label>
                </div>
              </div>
            </div>

            {/* Equipments Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Options */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckSquare size={16} className="text-indigo-500" />
                  Équipements en Option ({optionsList.length})
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOptionItem()}
                    placeholder="Ajouter une option (ex: Toit ouvrant)"
                    className="flex-1 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button onClick={addOptionItem} className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {optionsList.map((item, i) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      {item}
                      <button onClick={() => removeOptionItem(i)} className="text-indigo-400 hover:text-indigo-700 cursor-pointer font-black text-xs">×</button>
                    </span>
                  ))}
                  {optionsList.length === 0 && <span className="text-slate-400 text-xs italic">Aucune option saisie.</span>}
                </div>
              </div>

              {/* Serie equipment */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers size={16} className="text-indigo-500" />
                  Équipements de Série ({seriesList.length})
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text"
                    value={newSerie}
                    onChange={e => setNewSerie(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSerieItem()}
                    placeholder="Ajouter un équipement de série"
                    className="flex-1 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button onClick={addSerieItem} className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-xl transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {seriesList.map((item, i) => (
                    <span key={i} className="bg-slate-100 text-slate-700 border border-slate-200/50 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      {item}
                      <button onClick={() => removeSerieItem(i)} className="text-slate-400 hover:text-slate-700 cursor-pointer font-black text-xs">×</button>
                    </span>
                  ))}
                  {seriesList.length === 0 && <span className="text-slate-400 text-xs italic">Aucun équipement de série saisi.</span>}
                </div>
              </div>
            </div>

            {/* State & Defects editable */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Carrosserie, Défauts et Remarques d'État
              </h3>
              <textarea
                value={vehicle.defauts || ''}
                onChange={e => handleFieldChange('defauts', e.target.value)}
                placeholder="Rédigez ici l'état complet de la carrosserie ou les défauts mécaniques du véhicule..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl p-4 text-xs font-bold text-slate-800 outline-none transition-all"
              />
            </div>

          </motion.div>
        )}

        {activeTab === 'expertise' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* 1. Upper Quick Stats & Controls Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Etat général carrosserie</label>
                <select
                  value={vehicle.carrosserie || 'BON'}
                  onChange={e => handleFieldChange('carrosserie', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="EXCELLENT">EXCELLENT</option>
                  <option value="TRES_BON">TRÈS BON</option>
                  <option value="BON">BON / USAGE NORMAL</option>
                  <option value="MOYEN">MOYEN / À PRÉPARER</option>
                  <option value="MAUVAIS">MAUVAIS</option>
                  <option value="A_RESTAURER">À RESTAURER</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Niveau de carburant</label>
                <select
                  value={vehicle.genre || 'PLEIN'}
                  onChange={e => handleFieldChange('genre', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="PLEIN">100% (PLEIN)</option>
                  <option value="3/4">75% (3/4)</option>
                  <option value="1/2">50% (1/2)</option>
                  <option value="1/4">25% (1/4)</option>
                  <option value="RESERVE">10% (RÉSERVE)</option>
                  <option value="VIDE">VIDE</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Double des clés</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('doubleCles', true)}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                      vehicle.doubleCles
                        ? 'bg-slate-900 border-slate-950 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    OUI / DISPO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('doubleCles', false)}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                      !vehicle.doubleCles
                        ? 'bg-slate-900 border-slate-950 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    NON
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Frais de remise en état HT (€)</label>
                <input
                  type="number"
                  placeholder="Ex: 450"
                  value={vehicle.fraisEstimesHT || ''}
                  onChange={e => handleFieldChange('fraisEstimesHT', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* 2. Interactive Damage Diagram & Details Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Canvas: Click to pin diagram */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col items-center justify-center relative min-h-[480px]">
                <div className="absolute top-4 left-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Schéma de carrosserie
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">
                    Cliquez sur l'illustration pour signaler un défaut
                  </p>
                </div>

                <div 
                  className="relative cursor-crosshair w-[210px] h-[410px] select-none flex items-center justify-center p-2 rounded-lg hover:ring-1 hover:ring-indigo-100 transition-all mt-8"
                  onClick={handleDetailCarClick}
                >
                  <CarOutlineSVG />

                  {/* Render Placed Pinpoints */}
                  {(vehicle.defautPoints || []).map((pin, i) => (
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
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-40 bg-indigo-600 text-white text-[10px] font-bold p-1 rounded-full shadow-lg flex items-center justify-center"
                    >
                      <div className="w-3.5 h-3.5 rounded-full border border-white bg-indigo-600 animate-ping absolute" />
                      <div className="w-3.5 h-3.5 rounded-full border border-white bg-indigo-600 relative" />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Adding / Editing form & Listed defects */}
              <div className="lg:col-span-7 flex flex-col gap-5">
                
                {/* Temporary pin addition input block */}
                {newPin && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 shadow-xs flex flex-col gap-3 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={13} />
                        Nouveau défaut (Position: {newPin.x}%, {newPin.y}%)
                      </span>
                      <button 
                        onClick={() => setNewPin(null)} 
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Ex: Rayure profonde, Impact, Enfoncement..."
                        value={newPinComment}
                        onChange={e => setNewPinComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddDetailPin()}
                        className="flex-1 px-3 py-2 bg-white border border-indigo-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none outline-offset-0"
                        autoFocus
                      />
                      <button 
                        onClick={handleAddDetailPin}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-sm shadow-indigo-500/10 cursor-pointer"
                      >
                        Placer
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit Pin Description Modal/Block */}
                {editingPinIndex !== null && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col gap-3 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Modifier le Défaut N° {editingPinIndex + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleDeleteDetailPin(editingPinIndex)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                        >
                          Supprimer
                        </button>
                        <button 
                          onClick={() => setEditingPinIndex(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={editingPinComment}
                        onChange={e => setEditingPinComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveDetailPinComment()}
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                        autoFocus
                      />
                      <button 
                        onClick={handleSaveDetailPinComment}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                {/* Defects Table List */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex-1 flex flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Détail des anomalies relevées
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">
                      Total anomalies: {(vehicle.defautPoints || []).length}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[220px] rounded-xl border border-slate-100 divide-y divide-slate-50 bg-slate-50/30">
                    {(vehicle.defautPoints || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 h-full">
                        <CheckSquare size={24} className="text-emerald-500 mb-1.5" />
                        <p className="text-xs font-black text-slate-800">Carrosserie impeccable</p>
                        <p className="text-[10px] text-slate-400">Aucun impact, rayure ou anomalie signalée sur ce véhicule.</p>
                      </div>
                    ) : (
                      (vehicle.defautPoints || []).map((pin, i) => (
                        <div 
                          key={i}
                          onClick={() => {
                            setEditingPinIndex(i);
                            setEditingPinComment(pin.comment);
                          }}
                          className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-xs font-black text-slate-700">
                              {pin.comment}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDetailPin(i);
                            }}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* General Comments */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                      Commentaire général d'état / Synthèse mécanique
                    </h3>
                    <textarea
                      value={vehicle.defauts || ''}
                      onChange={e => handleFieldChange('defauts', e.target.value)}
                      placeholder="Indiquez ici l'état complet du véhicule ou les observations de l'expert..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl p-4 text-xs font-bold text-slate-800 outline-none transition-all"
                    />
                  </div>
                </div>

              </div>

            </div>

          </motion.div>
        )}

        {activeTab === 'suivi' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Tracking Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-2 space-y-5">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" />
                  Suivi Général du Véhicule
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Situation Actuelle</label>
                    <select 
                      value={vehicle.status || 'PARC'} 
                      onChange={e => handleFieldChange('status', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                    >
                      <option value="PARC">Dispo Parc (Prêt pour la vente)</option>
                      <option value="ARRIVAGE">En Arrivage (Commandé)</option>
                      <option value="EN_COURS">Vente En Cours / Réservé</option>
                      <option value="EN_REPARATION">En Préparation / Atelier</option>
                      <option value="VENDU">Vendu & Sorti</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Emplacement physique</label>
                    <input 
                      type="text" 
                      value={vehicle.site || ''} 
                      onChange={e => handleFieldChange('site', e.target.value)}
                      placeholder="ex: Ranger A, DJ CAR"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Missing Items Section */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clipboard size={14} className="text-indigo-500" />
                    Liste des éléments manquants à récupérer
                  </h4>

                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text"
                      value={newMissingItem}
                      onChange={e => setNewMissingItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMissingItem()}
                      placeholder="ex: Double de clé, Notice d'utilisation"
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                    <button onClick={addMissingItem} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>

                  <div className="space-y-2">
                    {missingItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold">
                        <span className={`flex items-center gap-2 ${item.status === 'Reçu' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          <span className={`w-2 h-2 rounded-full ${item.status === 'Reçu' ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                          {item.name}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {item.date && <span className="text-[10px] text-slate-400 bg-white border px-1.5 py-0.5 rounded font-mono">{item.date}</span>}
                          <button 
                            onClick={() => toggleMissingItemStatus(item.id)}
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-black transition-all cursor-pointer ${
                              item.status === 'Reçu' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {item.status === 'Reçu' ? 'Démarquer Reçu' : 'Marquer Reçu'}
                          </button>
                          <button onClick={() => removeMissingItem(item.id)} className="text-slate-400 hover:text-rose-600 p-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {missingItems.length === 0 && <span className="text-slate-400 text-xs italic block text-center py-4">Aucun élément manquant enregistré.</span>}
                  </div>
                </div>

              </div>

              {/* Chronology timeline inputs */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500" />
                  Chronologie & Dates
                </h3>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Date d'Arrivage prévue</label>
                  <input 
                    type="date" 
                    value={vehicle.dateDebut || ''} 
                    onChange={e => handleFieldChange('dateDebut', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Date d'Entrée Parc effective</label>
                  <input 
                    type="date" 
                    value={vehicle.createdAt?.substring(0, 10) || ''} 
                    onChange={e => handleFieldChange('createdAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Date Fin de Garantie</label>
                  <input 
                    type="date" 
                    value={vehicle.dateFin || ''} 
                    onChange={e => handleFieldChange('dateFin', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {activeTab === 'achat' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Purchase fields & calculations bento */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Purchase specs */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-2 space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Coins size={16} className="text-indigo-500" />
                  Renseignements de l'Achat du Véhicule
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Fournisseur</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={vehicle.fournisseur || ''} 
                        onChange={e => handleFieldChange('fournisseur', e.target.value)}
                        placeholder="Saisir le nom du fournisseur"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                      />
                      <Users size={14} className="absolute left-2.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Prix d'Achat (HT)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={vehicle.prixAchat || 0} 
                        onChange={e => handleFieldChange('prixAchat', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                      />
                      <Euro size={14} className="absolute left-2.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Frais de Réparation Estimés (HT)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={vehicle.fraisEstimesHT || 0} 
                        onChange={e => handleFieldChange('fraisEstimesHT', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                      />
                      <Sliders size={14} className="absolute left-2.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Prix de Vente Particulier (HT)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={vehicle.prixParticulierHT || 0} 
                        onChange={e => handlePriceChange('prixParticulierHT', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                      />
                      <Euro size={14} className="absolute left-2.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Prix de Vente Particulier (TTC)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={vehicle.prixParticulierTTC || 0} 
                        onChange={e => handlePriceChange('prixParticulierTTC', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-black text-slate-800 outline-none"
                      />
                      <Euro size={14} className="absolute left-2.5 top-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Additional detailed fees table */}
                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders size={14} className="text-indigo-500" />
                      Tableau des Frais Réels Additionnels (Frais d'Atelier, Carrosserie, Transports)
                    </h4>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 select-none">
                    <div className="md:col-span-2">
                      <input 
                        type="text"
                        value={newFee.label}
                        onChange={e => setNewFee(prev => ({ ...prev, label: e.target.value }))}
                        placeholder="Libellé du frais (ex: Peinture pare-choc)"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <input 
                        type="number"
                        value={newFee.amount || ''}
                        onChange={e => setNewFee(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="Montant HT (€)"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <button onClick={addFeeItem} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1">
                        <Plus size={14} /> Ajouter Frais
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black border-b border-slate-100">
                        <tr>
                          <th className="p-3">Désignation</th>
                          <th className="p-3 text-right">Montant (HT)</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {feesList.map(fee => (
                          <tr key={fee.id}>
                            <td className="p-3 font-bold text-slate-700">{fee.label}</td>
                            <td className="p-3 text-right font-black text-slate-900">{fee.amount.toLocaleString()} €</td>
                            <td className="p-3 text-right">
                              <button onClick={() => removeFeeItem(fee.id)} className="text-slate-400 hover:text-rose-600 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {feesList.length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-slate-400 italic">Aucun frais réel saisi.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Financial calculations side profile */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" />
                  Synthèse & Calculs de Marge
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between py-1 border-b border-slate-50 text-xs">
                    <span className="text-slate-400 font-bold">Prix d'Achat HT :</span>
                    <span className="text-slate-800 font-black">{(vehicle.prixAchat || 0).toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 text-xs">
                    <span className="text-slate-400 font-bold">Frais Totaux (Atelier & Est.) :</span>
                    <span className="text-slate-800 font-black">{finances.totalFees.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 text-xs bg-slate-50 px-2 rounded-lg">
                    <span className="text-slate-500 font-black">Coût de Revient HT :</span>
                    <span className="text-slate-900 font-black">{finances.costPrice.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 text-xs">
                    <span className="text-slate-400 font-bold">Prix de Vente Conseillé HT :</span>
                    <span className="text-slate-800 font-black">{(vehicle.prixParticulierHT || 0).toLocaleString()} €</span>
                  </div>

                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center space-y-1">
                    <span className="text-[10px] text-emerald-800 font-black uppercase tracking-wider block">Marge Brute HT</span>
                    <span className={`text-xl font-black block ${finances.margin >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {finances.margin.toLocaleString()} €
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block">
                      Taux de marge : {finances.marginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}

        {activeTab === 'reservation' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs max-w-xl">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Shield size={16} className="text-indigo-500" />
                Paramètres de Réservation / Option d'Achat
              </h3>

              <div className="space-y-5">
                <label className="flex items-center gap-3 text-xs font-black text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={vehicle.status === 'EN_COURS'} 
                    onChange={e => handleFieldChange('status', e.target.checked ? 'EN_COURS' : 'PARC')}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 animate-pulse"
                  />
                  <div>
                    <span className="block">Marquer ce véhicule comme RÉSERVÉ (Option active)</span>
                    <span className="text-[10px] text-slate-400 font-normal mt-0.5 block">Le véhicule sera identifié comme bloqué et ne pourra pas être affecté à une autre vente directe.</span>
                  </div>
                </label>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Durée de l'Option (Heures)</label>
                  <select 
                    value={vehicle.dureeMois || 24} 
                    onChange={e => handleFieldChange('dureeMois', parseInt(e.target.value) || 24)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="12">12 Heures</option>
                    <option value="24">24 Heures (Par défaut)</option>
                    <option value="48">48 Heures (2 jours)</option>
                    <option value="72">72 Heures (3 jours)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Nom du bénéficiaire (Client ou Collaborateur)</label>
                  <input 
                    type="text" 
                    value={vehicle.typeGarantie || ''} 
                    onChange={e => handleFieldChange('typeGarantie', e.target.value)}
                    placeholder="Nom complet ou raison sociale"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {activeTab === 'documents' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileCheck size={16} className="text-indigo-500" />
                Documents Administratifs Attachés
              </h3>
              <p className="text-xs text-slate-400 font-medium mb-6">Attachez et archivez des pièces d'identité, KBIS, carte grise barrée, bons d'enlèvement ou mandats associés au véhicule.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* File Uploader */}
                <div className="border-2 border-dashed border-slate-200/80 hover:border-indigo-400 bg-slate-50 hover:bg-slate-50/20 p-6 rounded-2xl transition-all flex flex-col items-center justify-center text-center select-none relative">
                  <input 
                    type="file" 
                    multiple
                    onChange={handleDocUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <FileText className="text-slate-300 w-12 h-12 mb-3 stroke-[1.25]" />
                  <span className="text-xs font-black text-slate-700 block mb-1">Faites glisser des fichiers ou cliquez pour uploader</span>
                  <span className="text-[10px] text-slate-400 block">Formates acceptés: PDF, PNG, JPEG. Taille max: 5 Mo.</span>
                </div>

                {/* Attached Files List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider block">Fichiers sauvegardés ({vehicle.documents?.length || 0})</h4>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {vehicle.documents && vehicle.documents.length > 0 ? (
                      vehicle.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold hover:border-indigo-100 transition-all">
                          <div>
                            <span className="text-slate-800 block truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{doc.size || 'Taille inconnue'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <a href={doc.base64} download={doc.name} className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg uppercase tracking-wider font-black">
                              Consulter
                            </a>
                            <button 
                              onClick={() => handleDocDelete(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-white hover:shadow-xs rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs italic block text-center py-8">Aucun document attaché à ce véhicule.</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        )}
      </div>

    </div>
  );
};
