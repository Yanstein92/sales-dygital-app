import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, X, ChevronLeft, ChevronRight, User, Car, Settings, Check, CheckCircle2, AlertCircle, Trash2, History, ClipboardCopy, Printer, ArrowRight, Save, Info, RefreshCw, Bell, Search } from 'lucide-react';
import { db, doc, setDoc, getDoc, getUserDocPath } from '../lib/firebase';
import { useApp } from '../lib/context';
import { Sale } from '../types';

interface DeliveryCalendarProps {
  onShowToast: (m: string, t: 'success' | 'error') => void;
}

interface DeliveryConfig {
  slots: string[];
  workingDays: number[]; // e.g. [1,2,3,4,5]
  dischargeText: string;
  maxDeliveriesPerDay?: number;
  blockedPeriods?: { from: string; to: string; reason?: string }[];
  reminderDaysBefore?: number;
  minDaysBeforeBooking?: number;
}

export const DeliveryCalendar: React.FC<DeliveryCalendarProps> = ({ onShowToast }) => {
  const { sales, userProfile, databaseUid } = useApp();
  const canModifySortie = userProfile?.role === 'admin' || userProfile?.role === 'park_manager';
  
  // Navigation states
  const [activeTab, setActiveTab] = useState<'calendar' | 'config' | 'logs'>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month'>('month');
  
  // Configuration states
  const [config, setConfig] = useState<DeliveryConfig>({
    slots: ["09:00 - 10:30", "10:30 - 12:00", "14:00 - 15:30", "15:30 - 17:00"],
    workingDays: [1, 2, 3, 4, 5],
    dischargeText: "Je soussigné, [Client], certifie avoir pris livraison du véhicule [Marque] [Modèle] immatriculé [Plaque] (N° VIN : [VIN]) en parfait état et muni de tous ses documents administratifs.",
    maxDeliveriesPerDay: 4,
    blockedPeriods: []
  });
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [newSlotStart, setNewSlotStart] = useState('');
  const [newSlotEnd, setNewSlotEnd] = useState('');

  // Block period inputs
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Active planning state
  const [isPlanningSale, setIsPlanningSale] = useState<Sale | null>(null);
  const [planningSlot, setPlanningSlot] = useState<string>('');
  const [viewingVehicleSale, setViewingVehicleSale] = useState<Sale | null>(null);
  const [isAssigningForSlot, setIsAssigningForSlot] = useState<{ date: string; slot: string } | null>(null);
  const [searchQueryToPlan, setSearchQueryToPlan] = useState('');

  // Discharge Generation State
  const [isGeneratingDischarge, setIsGeneratingDischarge] = useState<Sale | null>(null);
  const [dischargeForm, setDischargeForm] = useState({
    recipientType: 'client', // client or other
    recipientName: '',
    recipientId: '',
    checkedItems: {
      FACTURE: true,
      CPI: true,
      CARTE_GRISE: true,
      COC: false,
      PASSEPORT: false,
      DOUBLE_DE_CLE: true,
      CESSION: true,
      CHAINE_DE_PROPRIETE: false,
      AUTRE: false,
    },
    autreCommentaire: ''
  });

  // Fetch Delivery Config on Mount
  useEffect(() => {
    const fetchConfig = async () => {
      if (!databaseUid) return;
      try {
        setIsConfigLoading(true);
        const configDocRef = doc(db, getUserDocPath(databaseUid) + '/settings/delivery_config');
        const configSnap = await getDoc(configDocRef);
        if (configSnap.exists()) {
          const data = configSnap.data() as DeliveryConfig;
          setConfig({
            slots: data.slots || ["09:00 - 10:30", "10:30 - 12:00", "14:00 - 15:30", "15:30 - 17:00"],
            workingDays: data.workingDays || [1, 2, 3, 4, 5],
            dischargeText: data.dischargeText || "Je soussigné, [Client], certifie avoir pris livraison du véhicule [Marque] [Modèle] immatriculé [Plaque] (N° VIN : [VIN]) en parfait état et muni de tous ses documents administratifs.",
            maxDeliveriesPerDay: data.maxDeliveriesPerDay || 4,
            blockedPeriods: data.blockedPeriods || [],
            reminderDaysBefore: data.reminderDaysBefore ?? 1,
            minDaysBeforeBooking: data.minDaysBeforeBooking ?? 0
          });
        } else {
          // Initialize first default config
          await setDoc(configDocRef, config);
        }
      } catch (e) {
        console.error("Error reading delivery config:", e);
      } finally {
        setIsConfigLoading(false);
      }
    };
    fetchConfig();
  }, [databaseUid]);

  // Save config to Firestore
  const saveConfig = async (newConfig: DeliveryConfig) => {
    if (!databaseUid) return;
    try {
      const configDocRef = doc(db, getUserDocPath(databaseUid) + '/settings/delivery_config');
      await setDoc(configDocRef, newConfig);
      setConfig(newConfig);
      onShowToast("Configuration enregistrée avec succès !", "success");
    } catch (e) {
      onShowToast("Erreur lors de l'enregistrement de la configuration.", "error");
    }
  };

  const handleAddBlockedPeriod = async () => {
    if (!blockFrom || !blockTo) {
      onShowToast("Veuillez sélectionner les dates de début et de fin.", "error");
      return;
    }
    if (blockFrom > blockTo) {
      onShowToast("La date de début doit être antérieure ou égale à la date de fin.", "error");
      return;
    }

    const newPeriod = {
      from: blockFrom,
      to: blockTo,
      reason: blockReason.trim()
    };

    const updatedPeriods = [...(config.blockedPeriods || []), newPeriod];
    const updatedConfig = { ...config, blockedPeriods: updatedPeriods };
    await saveConfig(updatedConfig);
    setBlockFrom('');
    setBlockTo('');
    setBlockReason('');
  };

  const handleRemoveBlockedPeriod = async (index: number) => {
    const updatedPeriods = (config.blockedPeriods || []).filter((_, idx) => idx !== index);
    const updatedConfig = { ...config, blockedPeriods: updatedPeriods };
    await saveConfig(updatedConfig);
  };

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const planSaleId = hashParams.get('planSaleId');
    if (planSaleId && sales && sales.length > 0 && config.slots.length > 0) {
      const sale = sales.find(s => s.id === planSaleId);
      if (sale && sale.factureStatus === 'facture') {
        setIsPlanningSale(sale);
        setPlanningSlot(sale.deliverySlot || config.slots[0] || '');
        // Clear param to avoid looping
        window.history.replaceState(null, '', '#delivery_calendar');
      }
    }
  }, [sales, config.slots]);

  // Handle Delivery Scheduling internally
  const handleScheduleDelivery = async (sale: Sale, date: string, slot: string) => {
    if (!databaseUid) return;

    // Check daily capacity limit
    const maxLimit = config.maxDeliveriesPerDay;
    if (maxLimit && maxLimit > 0) {
      const cellDeliveriesCount = (sales || []).filter(s => s.deliveryDate === date && s.deliveryStatus === 'programmee' && s.id !== sale.id).length;
      if (cellDeliveriesCount >= maxLimit) {
        const confirmOverride = window.confirm(
          `Attention: La limite quotidienne de ${maxLimit} livraisons est déjà atteinte pour le ${date}.\n\nSouhaitez-vous forcer l'ajout de ce rendez-vous (autorisé pour le Gestionnaire/Admin/Commercial) ?`
        );
        if (!confirmOverride) return;
      }
    }

    // Check if falls in a blocked period
    const isBlocked = (config.blockedPeriods || []).some(p => date >= p.from && date <= p.to);
    if (isBlocked) {
      const confirmOverride = window.confirm(
        `Attention: La date du ${date} se situe dans une période bloquée pour congés ou fermeture.\n\nSouhaitez-vous forcer l'ajout de ce rendez-vous malgré le blocage ?`
      );
      if (!confirmOverride) return;
    }

    try {
      const saleRef = doc(db, getUserDocPath(databaseUid) + '/sales/' + sale.id);
      const logEntry = {
        user: userProfile?.name || 'Administrateur',
        action: `Livraison planifiée pour le ${date} à ${slot}`,
        timestamp: new Date().toISOString()
      };
      
      const existingLog = sale.deliveryLog || [];
      const updatedFields = {
        deliveryDate: date,
        deliverySlot: slot,
        deliveryStatus: 'programmee' as const,
        releaseStatus: 'programmee' as const,
        deliveryLog: [...existingLog, logEntry]
      };

      await setDoc(saleRef, updatedFields, { merge: true });
      onShowToast(`Livraison de ${sale.clientName} programmée avec succès.`, "success");
      setIsPlanningSale(null);
    } catch (e) {
      onShowToast("Erreur lors de la planification de la livraison.", "error");
    }
  };

  // Handle Mark as Delivered
  const handleMarkAsDelivered = async (sale: Sale) => {
    if (!databaseUid) return;
    try {
      const saleRef = doc(db, getUserDocPath(databaseUid) + '/sales/' + sale.id);
      const logEntry = {
        user: userProfile?.name || 'Administrateur',
        action: "Livraison marquée comme EFFECTUÉE (SORTIE)",
        timestamp: new Date().toISOString()
      };
      const existingLog = sale.deliveryLog || [];
      await setDoc(saleRef, {
        deliveryStatus: 'livre',
        releaseStatus: 'sorti',
        deliveryLog: [...existingLog, logEntry]
      }, { merge: true });
      onShowToast(`Véhicule marqué comme livré. Dossier clôturé !`, "success");
    } catch (e) {
      onShowToast("Erreur lors de la mise à jour.", "error");
    }
  };

  // Handle Cancel Delivery
  const handleCancelDelivery = async (sale: Sale) => {
    if (!databaseUid) return;
    if (!confirm(`Annuler la livraison pour ${sale.clientName} ? Les horaires redeviendront libres.`)) return;
    try {
      const saleRef = doc(db, getUserDocPath(databaseUid) + '/sales/' + sale.id);
      const logEntry = {
        user: userProfile?.name || 'Administrateur',
        action: "Livraison ANNULÉE",
        timestamp: new Date().toISOString()
      };
      const existingLog = sale.deliveryLog || [];
      await setDoc(saleRef, {
        deliveryStatus: 'annule',
        releaseStatus: 'non_sorti',
        deliveryLog: [...existingLog, logEntry]
      }, { merge: true });
      onShowToast("Livraison annulée.", "success");
    } catch (e) {
      onShowToast("Erreur lors de l'annulation.", "error");
    }
  };

  // Filter Sales that are invoiced ('facture') but not yet delivered
  const invoicedSales = (sales || []).filter(s => s.factureStatus === 'facture');
  
  // Pending planifications: Invoiced and doesn't have a programmed date or status is non_programmee/annule
  const pendingPlanificationSales = useMemo(() => {
    const basePending = invoicedSales.filter(s => !s.deliveryDate || s.deliveryStatus === 'non_programmee' || s.deliveryStatus === 'annule');
    if (!searchQueryToPlan) return basePending;
    const q = searchQueryToPlan.toLowerCase();
    return basePending.filter(s => {
      return (
        String(s.clientName || '').toLowerCase().includes(q) ||
        String(s.marque || '').toLowerCase().includes(q) ||
        String(s.modele || '').toLowerCase().includes(q) ||
        String(s.vin || '').toLowerCase().includes(q) ||
        String(s.plaque || '').toLowerCase().includes(q) ||
        String(s.ref || '').toLowerCase().includes(q) ||
        String(s.bdcNumber || '').toLowerCase().includes(q)
      );
    });
  }, [invoicedSales, searchQueryToPlan]);

  // Filter active programmed deliveries for the selectedDate
  const dayDeliveries = invoicedSales.filter(s => s.deliveryDate === selectedDate && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre'));

  // Generate Calendar Days list
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 0, 0); // last day
    const numDays = new Date(year, month + 1, 0).getDate();
    
    // Day of the week of first day (0 is Sun, shift so Monday is 0)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday
    
    const days = [];
    
    // Padding previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= numDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }
    
    return days;
  };

  const getDaysInWeek = (refDate: Date) => {
    const days = [];
    const day = refDate.getDay();
    const dayOfWeek = day === 0 ? 6 : day - 1;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ date: d, isCurrentMonth: true });
    }
    return days;
  };

  const getDaysInDay = (refDate: Date) => {
    return [{ date: new Date(refDate), isCurrentMonth: true }];
  };

  const calendarDays = useMemo(() => {
    if (calendarViewMode === 'month') {
      return getDaysInMonth(currentMonth);
    } else if (calendarViewMode === 'week') {
      return getDaysInWeek(currentMonth);
    } else {
      return getDaysInDay(currentMonth);
    }
  }, [calendarViewMode, currentMonth]);

  // Helper to format date key YYYY-MM-DD
  const formatDateKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handlePeriodChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (calendarViewMode === 'month') {
      newDate.setMonth(currentMonth.getMonth() + (direction === 'prev' ? -1 : 1));
    } else if (calendarViewMode === 'week') {
      newDate.setDate(currentMonth.getDate() + (direction === 'prev' ? -7 : 7));
    } else {
      newDate.setDate(currentMonth.getDate() + (direction === 'prev' ? -1 : 1));
    }
    setCurrentMonth(newDate);
    
    const dateKey = formatDateKey(newDate);
    setSelectedDate(dateKey);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(formatDateKey(today));
  };

  const getHeaderTitle = () => {
    if (calendarViewMode === 'month') {
      return currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } else if (calendarViewMode === 'week') {
      const days = getDaysInWeek(currentMonth);
      const first = days[0].date;
      const last = days[6].date;
      const format = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `Semaine du ${format(first)} au ${format(last)} ${last.getFullYear()}`;
    } else {
      return currentMonth.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // Copy reservation link
  const copyBookingLink = (saleId: string) => {
    const link = `${window.location.origin}/#reserve/${saleId}`;
    navigator.clipboard.writeText(link);
    onShowToast("Lien de réservation copié dans le presse-papiers !", "success");
  };

  const handleDropOnCell = (saleId: string, dateKey: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      setSelectedDate(dateKey);
      setIsPlanningSale(sale);
      const occupiedSlots = (sales || [])
        .filter(s => s.deliveryDate === dateKey && s.deliveryStatus === 'programmee')
        .map(s => s.deliverySlot);
      const firstAvailableSlot = config.slots.find(slot => !occupiedSlots.includes(slot)) || config.slots[0] || '';
      setPlanningSlot(firstAvailableSlot);
    }
  };

  // Add a custom slot
  const handleAddSlot = () => {
    if (!newSlotStart || !newSlotEnd) return;
    const formattedSlot = `${newSlotStart.trim()} - ${newSlotEnd.trim()}`;
    if (config.slots.includes(formattedSlot)) {
      onShowToast("Ce créneau existe déjà.", "error");
      return;
    }
    const updatedSlots = [...config.slots, formattedSlot].sort();
    saveConfig({ ...config, slots: updatedSlots });
    setNewSlotStart('');
    setNewSlotEnd('');
  };

  // Remove a custom slot
  const handleRemoveSlot = (indexToRemove: number) => {
    const updatedSlots = config.slots.filter((_, idx) => idx !== indexToRemove);
    saveConfig({ ...config, slots: updatedSlots });
  };

  // Toggle Working Days
  const handleToggleWorkingDay = (day: number) => {
    const updatedDays = config.workingDays.includes(day)
      ? config.workingDays.filter(d => d !== day)
      : [...config.workingDays, day].sort();
    saveConfig({ ...config, workingDays: updatedDays });
  };

  // Open Discharge Form
  const openDischargeModal = (sale: Sale) => {
    setIsGeneratingDischarge(sale);
    setDischargeForm({
      recipientType: 'client',
      recipientName: sale.clientName,
      recipientId: '',
      checkedItems: {
        FACTURE: true,
        CPI: true,
        CARTE_GRISE: true,
        COC: false,
        PASSEPORT: false,
        DOUBLE_DE_CLE: true,
        CESSION: true,
        CHAINE_DE_PROPRIETE: false,
        AUTRE: false,
      },
      autreCommentaire: ''
    });
  };

  // Print Discharge
  const triggerPrintDischarge = () => {
    if (!isGeneratingDischarge) return;
    
    // Generate text replacing variables
    let text = config.dischargeText;
    text = text.replace(/\[Client\]/g, isGeneratingDischarge.clientName || "Client");
    text = text.replace(/\[Marque\]/g, isGeneratingDischarge.marque || "");
    text = text.replace(/\[Modèle\]/g, isGeneratingDischarge.modele || "");
    text = text.replace(/\[Plaque\]/g, isGeneratingDischarge.plaque || "Non immatriculé");
    text = text.replace(/\[VIN\]/g, isGeneratingDischarge.vin || "");
    text = text.replace(/\[Entreprise\]/g, isGeneratingDischarge.company || "Concessionnaire");

    // Recipient line
    const recipientLine = dischargeForm.recipientType === 'client' 
      ? `Acheteur d'origine : ${isGeneratingDischarge.clientName}`
      : `Mandataire / Récupérateur : ${dischargeForm.recipientName} (Pièce d'identité : ${dischargeForm.recipientId || 'N/A'})`;

    // Retrieve company details
    const compName = isGeneratingDischarge.company || "Dygital";
    const compDetail = userProfile?.companiesDetails?.find(c => c.name.toUpperCase() === compName.toUpperCase());

    // Print Layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onShowToast("Veuillez autoriser les popups pour imprimer la décharge.", "error");
      return;
    }

    const docDate = new Date().toLocaleDateString('fr-FR');
    const docTitle = `decharge_${compName.replace(/\s+/g, '_')}_${isGeneratingDischarge.bdcNumber}_${docDate.replace(/\//g, '-')}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              padding: 40px;
              line-height: 1.6;
              font-size: 14px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .company-name {
              font-size: 24px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .doc-title {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-weight: 700;
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 1px;
              color: #64748b;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .info-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 8px;
            }
            .info-label {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 14px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 2px;
            }
            .checkbox-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-top: 15px;
            }
            .checkbox-item {
              display: flex;
              align-items: center;
              gap: 10px;
              font-weight: 500;
            }
            .box {
              width: 16px;
              height: 16px;
              border: 1.5px solid #0f172a;
              display: inline-block;
              position: relative;
              border-radius: 3px;
            }
            .box.checked::after {
              content: "✔";
              position: absolute;
              top: -3px;
              left: 2px;
              font-size: 12px;
              color: #0f172a;
            }
            .discharge-text {
              background: #f8fafc;
              border-left: 4px solid #0f172a;
              padding: 15px;
              font-style: italic;
              color: #334155;
              margin-bottom: 30px;
              border-radius: 0 8px 8px 0;
            }
            .signatures {
              margin-top: 50px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 100px;
            }
            .sig-box {
              height: 120px;
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
              padding: 15px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #fdfdfd;
            }
            .sig-title {
              font-size: 12px;
              font-weight: 700;
              text-align: center;
              color: #475569;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 5px;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              margin-top: 80px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { padding: 0; }
              .sig-box { background: none; }
            }
          </style>
        </head>
        <body>
          <div class="header" style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              ${compDetail?.logoUrl ? `
                <img src="${compDetail.logoUrl}" style="max-height: 60px; max-width: 150px; object-fit: contain;" />
              ` : `
                <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; border: 1.5px solid #0f172a; padding: 5px 12px; border-radius: 6px;">${compName}</div>
              `}
              <div style="border-left: 1.5px solid #e2e8f0; padding-left: 15px; font-size: 11px; color: #475569; line-height: 1.4;">
                <div style="font-weight: 900; font-size: 13px; color: #0f172a; margin-bottom: 2px; text-transform: uppercase;">${compName}</div>
                ${compDetail?.address ? `<div>${compDetail.address}</div>` : ''}
                ${compDetail?.siret ? `<div>SIRET : ${compDetail.siret}</div>` : ''}
                ${compDetail?.email ? `<div>Email : ${compDetail.email}</div>` : ''}
                ${compDetail?.phone ? `<div>Tél : ${compDetail.phone}</div>` : ''}
              </div>
            </div>
            <div style="text-align: right; line-height: 1.4;">
              <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Décharge de Sortie</div>
              <div style="font-size: 11px; color: #475569;">
                <div>N° Bon de Commande : <strong>${isGeneratingDischarge.bdcNumber}</strong></div>
                <div>Date de sortie : <strong>${docDate}</strong></div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informations Véhicule</div>
            <div class="grid">
              <div class="info-box">
                <div class="info-label">Marque / Modèle</div>
                <div class="info-value">${isGeneratingDischarge.marque} ${isGeneratingDischarge.modele}</div>
                <div style="margin-top: 10px;" class="info-label">Teinte / Couleur</div>
                <div class="info-value">${isGeneratingDischarge.color || "Non renseigné"}</div>
              </div>
              <div class="info-box">
                <div class="info-label font-mono">N° de Châssis (VIN)</div>
                <div class="info-value font-mono">${isGeneratingDischarge.vin}</div>
                <div style="margin-top: 10px;" class="info-label">Immatriculation</div>
                <div class="info-value font-mono">${isGeneratingDischarge.plaque || "Non immatriculé"}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Destinataire / Mandataire</div>
            <div class="info-box">
              <div class="info-label">Bénéficiaire de la sortie</div>
              <div class="info-value" style="font-size: 15px;">${recipientLine}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Attestation de sortie & conformité</div>
            <div class="discharge-text">
              "${text}"
            </div>
          </div>

          <div class="section">
            <div class="section-title">Documents et éléments remis</div>
            <div class="checkbox-grid">
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.FACTURE ? 'checked' : ''}"></div>
                <span>FACTURE D'ACHAT</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.CPI ? 'checked' : ''}"></div>
                <span>CPI (Certificat Provisoire d'Immatriculation)</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.CARTE_GRISE ? 'checked' : ''}"></div>
                <span>CARTE GRISE / TITRE ÉTRANGER</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.COC ? 'checked' : ''}"></div>
                <span>COC (Certificat de Conformité)</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.PASSEPORT ? 'checked' : ''}"></div>
                <span>PASSEPORT / PIÈCE D'IDENTITÉ</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.DOUBLE_DE_CLE ? 'checked' : ''}"></div>
                <span>DOUBLE DE CLÉ</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.CESSION ? 'checked' : ''}"></div>
                <span>CERTIFICAT DE CESSION</span>
              </div>
              <div class="checkbox-item">
                <div class="box ${dischargeForm.checkedItems.CHAINE_DE_PROPRIETE ? 'checked' : ''}"></div>
                <span>CHAINE DE PROPRIÉTÉ</span>
              </div>
              ${dischargeForm.checkedItems.AUTRE ? `
              <div class="checkbox-item" style="grid-column: span 2; margin-top: 5px;">
                <div class="box checked"></div>
                <span style="font-style: italic; color: #475569;">Autre : ${dischargeForm.autreCommentaire || "N/A"}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-title">Signature du client / mandataire</div>
              <div style="font-size: 11px; color: #94a3b8; text-align: center;">Mention manuscrite "Bon pour décharge de sortie"</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">Le concessionnaire (${compName})</div>
              <div style="font-size: 11px; color: #94a3b8; text-align: center;">Nom et signature du préparateur</div>
            </div>
          </div>

          <div class="footer">
            Document généré numériquement par ${compName}. Fait à la date du ${docDate}.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    onShowToast("Impression lancée.", "success");
    setIsGeneratingDischarge(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      {/* Top Banner with Navigation Tabs */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md border-b border-indigo-900 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Logistique & Livraisons
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <CalendarIcon className="text-indigo-400" size={28} /> Agenda des Livraisons
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
              Gérez la préparation des véhicules facturés, programmez les rendez-vous et générez les décharges.
            </p>
          </div>
          
          {/* Tab Controls */}
          <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shrink-0">
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
            >
              <CalendarIcon size={14} /> Calendrier
            </button>
            <button 
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
            >
              <Settings size={14} /> Configuration
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
            >
              <History size={14} /> Historique global
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 w-full max-w-[1600px] mx-auto">
        {/* ==================== TAB: CALENDAR ==================== */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Vehicles to Program */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col h-[calc(100vh-220px)] min-h-[450px]">
              <div className="mb-4 text-slate-800">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Véhicules à planifier ({pendingPlanificationSales.length})
                </h3>
                <p className="text-xs text-slate-400 mt-1">Dossiers d'achat déjà facturés sans date de sortie programmée.</p>
              </div>

              {/* Search input to filter vehicles to schedule */}
              <div className="relative mb-4">
                <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 h-full pointer-events-none" size={14} />
                <input 
                  type="text"
                  placeholder="Rechercher par client, modèle, VIN, BDC..."
                  value={searchQueryToPlan}
                  onChange={(e) => setSearchQueryToPlan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
                {searchQueryToPlan && (
                  <button 
                    onClick={() => setSearchQueryToPlan('')} 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Scrollable list of pending vehicles */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {pendingPlanificationSales.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                    <CheckCircle2 className="mx-auto mb-3 text-slate-200" size={32} />
                    <p className="text-xs font-bold uppercase tracking-wider">Tout est planifié !</p>
                    <p className="text-[10px] text-slate-400 mt-1 px-4">Aucun véhicule facturé en attente de programmation.</p>
                  </div>
                ) : (
                  pendingPlanificationSales.map(sale => (
                    <div 
                      key={sale.id} 
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", sale.id);
                      }}
                      onClick={() => setViewingVehicleSale(sale)}
                      className="bg-slate-50 hover:bg-blue-50/40 border border-slate-200/50 hover:border-blue-300 p-4 rounded-xl transition-all space-y-3 shadow-inner cursor-grab active:cursor-grabbing hover:shadow-md group/card"
                      title="Glisser vers une date du calendrier ou cliquer pour voir les détails"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200">Facturé</span>
                          <h4 className="font-extrabold text-slate-800 text-sm mt-1.5 truncate group-hover/card:text-blue-900 transition-colors">{sale.marque} {sale.modele}</h4>
                          <p className="text-xs text-slate-500 truncate">Client: {sale.clientName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold font-mono text-slate-400">BDC {sale.bdcNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyBookingLink(sale.id);
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copier le lien public de réservation client"
                        >
                          <ClipboardCopy size={13} /> Lien client
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPlanningSale(sale);
                            setPlanningSlot(config.slots[0] || '');
                          }}
                          className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-black px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          Placer <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Calendar Grid */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
              {/* Calendar Grid Controller */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-800 capitalize flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    {getHeaderTitle()}
                  </h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={handleTodayClick} 
                    className="text-xs font-bold uppercase tracking-wider px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 transition-colors cursor-pointer"
                  >
                    Aujourd'hui
                  </button>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handlePeriodChange('prev')} 
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* View Switcher Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                      <button 
                        onClick={() => setCalendarViewMode('day')}
                        className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                          calendarViewMode === 'day' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Jour
                      </button>
                      <button 
                        onClick={() => setCalendarViewMode('week')}
                        className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                          calendarViewMode === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Semaine
                      </button>
                      <button 
                        onClick={() => setCalendarViewMode('month')}
                        className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                          calendarViewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Mois
                      </button>
                    </div>

                    <button 
                      onClick={() => handlePeriodChange('next')} 
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Calendar Grid Area */}
              <div className="mt-6">
                {calendarViewMode === 'month' && (
                  <div>
                    {/* Month view headers */}
                    <div className="grid grid-cols-7 gap-2.5 text-center font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">
                      <span>Lun</span>
                      <span>Mar</span>
                      <span>Mer</span>
                      <span>Jeu</span>
                      <span>Ven</span>
                      <span>Sam</span>
                      <span>Dim</span>
                    </div>

                    {/* Day Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((cell, idx) => {
                        const dateKey = formatDateKey(cell.date);
                        const isSelected = selectedDate === dateKey;
                        const isToday = formatDateKey(new Date()) === dateKey;
                        
                        // Filter deliveries scheduled for this cell day
                        const cellDeliveries = (sales || []).filter(s => s.deliveryDate === dateKey && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre'));

                        const isBlockedDate = (config.blockedPeriods || []).some(
                          p => dateKey >= p.from && dateKey <= p.to
                        );

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDate(dateKey)}
                            onDragOver={(e) => {
                              if (!isBlockedDate) {
                                e.preventDefault();
                              }
                            }}
                            onDrop={(e) => {
                              if (!isBlockedDate) {
                                const saleId = e.dataTransfer.getData("text/plain");
                                handleDropOnCell(saleId, dateKey);
                              }
                            }}
                            className="h-24 p-2.5 rounded-xl border flex flex-col justify-between items-start transition-all cursor-pointer relative border-slate-100 hover:border-slate-300 hover:bg-slate-50/40 bg-white"
                            style={{
                              borderColor: isSelected ? '#2563eb' : undefined,
                              borderWidth: isSelected ? '2px' : '1px',
                              boxShadow: isSelected ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' : undefined,
                              backgroundColor: isBlockedDate ? 'rgba(239, 68, 68, 0.03)' : !cell.isCurrentMonth ? 'rgba(248, 250, 252, 0.5)' : undefined
                            }}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                                isToday ? 'bg-blue-600 text-white' : 'text-slate-700'
                              }`}>
                                {cell.date.getDate()}
                              </span>
                              
                              {isBlockedDate && (
                                <span className="text-[8px] bg-red-100 text-red-800 px-1 py-0.5 rounded font-black uppercase tracking-wider scale-90" title="Période de livraison bloquée">Bloqué</span>
                              )}
                              {!isBlockedDate && cellDeliveries.length > 0 && (
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-scale-up" title={`${cellDeliveries.length} livraison(s)`}></span>
                              )}
                            </div>

                            {/* Miniature display of deliveries */}
                            <div className="w-full mt-1.5 overflow-hidden space-y-1 text-left shrink-0">
                              {cellDeliveries.slice(0, 2).map(delivery => {
                                const isLivre = delivery.deliveryStatus === 'livre';
                                return (
                                  <div 
                                    key={delivery.id} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingVehicleSale(delivery);
                                    }}
                                    className={`text-[9px] border font-extrabold truncate px-1.5 rounded-md py-0.5 leading-none cursor-pointer ${
                                      isLivre 
                                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-600 border-slate-200' 
                                        : 'bg-blue-50 hover:bg-blue-100 text-blue-900 hover:text-blue-950 border-blue-100'
                                    }`}
                                    title={isLivre ? "Livré (Historique) - Cliquer pour détails" : "Cliquer pour voir les détails de la sortie"}
                                  >
                                    {delivery.marque} {delivery.modele}
                                  </div>
                                );
                              })}
                              {cellDeliveries.length > 2 && (
                                <div className="text-[8px] font-bold text-slate-400 pl-1">+{cellDeliveries.length - 2} autres</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected Date Details Panel (Only shown in Month View for selected date) */}
                {calendarViewMode === 'month' && selectedDate && (
                  <div className="mt-6 bg-slate-50/50 rounded-2xl border border-slate-100 p-5 animate-fade-in-up">
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-4">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                          📅 Rendez-vous du {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">Créneaux horaires de livraison pour cette journée.</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 font-black text-xs px-3 py-1 rounded-full">
                        {dayDeliveries.length} livraison(s) programmée(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {config.slots.map(slot => {
                        const activeDelivery = (sales || []).find(s => s.deliveryDate === selectedDate && s.deliverySlot === slot && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre'));
                        const isLivre = activeDelivery?.deliveryStatus === 'livre';
                        
                        return (
                          <div key={slot} className={`border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${
                            activeDelivery 
                              ? isLivre 
                                ? 'border-slate-200 bg-slate-50/70 shadow-none opacity-80' 
                                : 'border-blue-200 bg-blue-50/30 shadow-md' 
                              : 'border-slate-100 bg-white hover:bg-slate-50/30'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">{slot}</span>
                              {activeDelivery ? (
                                isLivre ? (
                                  <span className="text-[10px] bg-slate-200 text-slate-600 font-black px-2 py-0.5 rounded-full uppercase">Sorti</span>
                                ) : (
                                  <span className="text-[10px] bg-blue-150 text-blue-800 font-black px-2 py-0.5 rounded-full uppercase">Occupé</span>
                                )
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase">Libre</span>
                              )}
                            </div>

                            {activeDelivery ? (
                              <div className="space-y-3">
                                <div 
                                  onClick={() => setViewingVehicleSale(activeDelivery)}
                                  className="cursor-pointer hover:bg-slate-100/50 p-1.5 rounded-lg transition-colors"
                                >
                                  <h5 className={`font-extrabold text-sm truncate ${isLivre ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{activeDelivery.marque} {activeDelivery.modele}</h5>
                                  <p className="text-xs text-slate-500 mt-0.5 truncate">Client: {activeDelivery.clientName}</p>
                                  {activeDelivery.plaque && (
                                    <span className={`inline-block mt-2 text-[10px] font-mono font-black border rounded px-2 py-0.5 ${
                                      isLivre 
                                        ? 'text-slate-500 bg-slate-100 border-slate-200' 
                                        : 'text-blue-600 bg-blue-50 border-blue-100'
                                    }`}>{activeDelivery.plaque}</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 justify-end pt-2 border-t border-slate-200/50">
                                  {/* Discharge printing is always accessible */}
                                  <button 
                                    onClick={() => openDischargeModal(activeDelivery)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors cursor-pointer"
                                    title="Imprimer décharge de responsabilité"
                                  >
                                    <Printer size={14} />
                                  </button>

                                  {/* Green button named "Sortir" replaces the small green check icon button, shown only if not yet delivered */}
                                  {!isLivre && (
                                    <button 
                                      onClick={() => handleMarkAsDelivered(activeDelivery)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                                      title="Valider la sortie du véhicule"
                                    >
                                      <Check size={14} /> Sortir
                                    </button>
                                  )}

                                  {/* If delivered/sortie: modifications limited to admin/park_manager */}
                                  {isLivre ? (
                                    canModifySortie ? (
                                      <>
                                        <button 
                                          onClick={() => {
                                            setIsPlanningSale(activeDelivery);
                                            setPlanningSlot(activeDelivery.deliverySlot || slot);
                                            setSelectedDate(activeDelivery.deliveryDate || selectedDate);
                                          }}
                                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                          title="Reprogrammer"
                                        >
                                          <CalendarIcon size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleCancelDelivery(activeDelivery)}
                                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 transition-colors cursor-pointer"
                                          title="Annuler rendez-vous"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-bold italic block text-right">
                                        Modifs restreintes (Admin)
                                      </span>
                                    )
                                  ) : (
                                    /* If not delivered, normal modification buttons are visible to all authorized */
                                    <>
                                      <button 
                                        onClick={() => {
                                          setIsPlanningSale(activeDelivery);
                                          setPlanningSlot(activeDelivery.deliverySlot || slot);
                                          setSelectedDate(activeDelivery.deliveryDate || selectedDate);
                                        }}
                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                        title="Reprogrammer"
                                      >
                                        <CalendarIcon size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleCancelDelivery(activeDelivery)}
                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 transition-colors cursor-pointer"
                                        title="Annuler rendez-vous"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setIsAssigningForSlot({ date: selectedDate, slot: slot })}
                                className="w-full text-center text-xs text-slate-500 hover:text-blue-600 font-bold py-2 border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-xl transition-all cursor-pointer"
                              >
                                + Assigner un véhicule
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calendarViewMode === 'week' && (
                  <div className="h-full overflow-auto border border-slate-150 rounded-lg shadow-sm bg-white">
                    <table className="w-full min-w-[700px] border-collapse text-left">
                      <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-24 bg-slate-50">Créneaux</th>
                          {calendarDays.map((cell, idx) => {
                            const isToday = formatDateKey(new Date()) === formatDateKey(cell.date);
                            return (
                              <th key={idx} className="py-2 px-2 text-center border-l border-slate-150 w-28">
                                <div className={`text-[9px] font-black tracking-wider uppercase leading-none ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                                  {cell.date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                                </div>
                                <div className={`text-[10px] font-bold mt-0.5 leading-none ${isToday ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
                                  {cell.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {config.slots.map((slot) => (
                          <tr key={slot} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/10">
                            <td className="py-2 px-2 text-[10px] font-black text-slate-600 bg-slate-50/40 align-middle border-r border-slate-150">
                              <div className="flex items-center gap-1">
                                <Clock size={11} className="text-slate-400 shrink-0" />
                                <span className="leading-none">{slot}</span>
                              </div>
                            </td>
                            {calendarDays.map((cell, idx) => {
                              const dateKey = formatDateKey(cell.date);
                              
                              // Filter active delivery for this day and slot
                              const activeDelivery = (sales || []).find(
                                s => s.deliveryDate === dateKey && s.deliverySlot === slot && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre')
                              );
                              const isLivre = activeDelivery?.deliveryStatus === 'livre';

                              const isBlockedDate = (config.blockedPeriods || []).some(
                                p => dateKey >= p.from && dateKey <= p.to
                              );

                              const jsDay = cell.date.getDay();
                              const workingDayNum = jsDay === 0 ? 7 : jsDay;
                              const isWorkingDay = config.workingDays.includes(workingDayNum);

                              const isDisabled = isBlockedDate || !isWorkingDay;

                              return (
                                <td key={idx} className="p-1 border-l border-slate-100 align-top">
                                  {isDisabled ? (
                                    <div className="h-full flex items-center justify-center bg-slate-50/70 rounded-lg border border-dashed border-slate-100 p-1.5 min-h-[50px]" title={isBlockedDate ? 'Période de fermeture / congés' : 'Jour non ouvré'}>
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                        {isBlockedDate ? 'Bloqué' : 'Fermé'}
                                      </span>
                                    </div>
                                  ) : activeDelivery ? (
                                    <div className={`border rounded-lg p-1.5 flex flex-col justify-between min-h-[55px] shadow-sm relative group/card transition-all ${
                                      isLivre 
                                        ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                        : 'bg-blue-50/90 border border-blue-100 hover:border-blue-200 hover:bg-blue-50'
                                    }`}>
                                      <div>
                                        <div className={`text-[9px] font-black truncate uppercase leading-none mb-0.5 ${isLivre ? 'text-slate-500 line-through' : 'text-blue-900'}`} title={activeDelivery.clientName}>
                                          {activeDelivery.clientName}
                                        </div>
                                        <div className={`text-[8px] font-extrabold truncate leading-none mb-0.5 ${isLivre ? 'text-slate-400' : 'text-blue-700'}`} title={`${activeDelivery.marque} ${activeDelivery.modele}`}>
                                          {activeDelivery.marque} {activeDelivery.modele}
                                        </div>
                                      </div>
                                      
                                      {/* Compact Actions Menu */}
                                      <div className="flex items-center justify-end gap-0.5 mt-1 pt-1 border-t border-blue-100/30 shrink-0">
                                        <button
                                          onClick={() => setViewingVehicleSale(activeDelivery)}
                                          className={`p-0.5 rounded transition-colors cursor-pointer ${isLivre ? 'hover:bg-slate-250 text-slate-500' : 'hover:bg-blue-200/60 text-blue-800'}`}
                                          title="Consulter"
                                        >
                                          <Info size={10} />
                                        </button>
                                        
                                        {/* Sortir check button shown only if not delivered */}
                                        {!isLivre && (
                                          <button
                                            onClick={() => handleMarkAsDelivered(activeDelivery)}
                                            className="p-0.5 hover:bg-emerald-200/60 rounded text-emerald-800 transition-colors cursor-pointer"
                                            title="Sortie effectuée (Sortir)"
                                          >
                                            <Check size={10} />
                                          </button>
                                        )}

                                        {isLivre ? (
                                          canModifySortie && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  setIsPlanningSale(activeDelivery);
                                                  setPlanningSlot(activeDelivery.deliverySlot || slot);
                                                  setSelectedDate(activeDelivery.deliveryDate || dateKey);
                                                }}
                                                className="p-0.5 hover:bg-blue-200/60 rounded text-blue-800 transition-colors cursor-pointer"
                                                title="Reprogrammer"
                                              >
                                                <CalendarIcon size={10} />
                                              </button>
                                              <button
                                                onClick={() => handleCancelDelivery(activeDelivery)}
                                                className="p-0.5 hover:bg-red-100 hover:text-red-800 rounded text-red-500 transition-colors cursor-pointer"
                                                title="Annuler RDV"
                                              >
                                                <Trash2 size={10} />
                                              </button>
                                            </>
                                          )
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => {
                                                setIsPlanningSale(activeDelivery);
                                                setPlanningSlot(activeDelivery.deliverySlot || slot);
                                                setSelectedDate(activeDelivery.deliveryDate || dateKey);
                                              }}
                                              className="p-0.5 hover:bg-blue-200/60 rounded text-blue-800 transition-colors cursor-pointer"
                                              title="Reprogrammer"
                                            >
                                              <CalendarIcon size={10} />
                                            </button>
                                            <button
                                              onClick={() => handleCancelDelivery(activeDelivery)}
                                              className="p-0.5 hover:bg-red-100 hover:text-red-800 rounded text-red-500 transition-colors cursor-pointer"
                                              title="Annuler RDV"
                                            >
                                              <Trash2 size={10} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setIsAssigningForSlot({ date: dateKey, slot: slot })}
                                      className="w-full h-full min-h-[50px] flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/10 text-slate-300 hover:text-blue-600 transition-all cursor-pointer group p-1"
                                    >
                                      <Plus size={11} className="group-hover:scale-110 transition-transform text-slate-300 group-hover:text-blue-500" />
                                      <span className="text-[7px] font-black uppercase tracking-wider mt-0.5 text-slate-400 group-hover:text-blue-600">Assigner</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {calendarViewMode === 'day' && (
                  <div className="space-y-2 h-full overflow-y-auto">
                    {config.slots.map((slot) => {
                      const dateKey = selectedDate;
                      const activeDelivery = (sales || []).find(
                        s => s.deliveryDate === dateKey && s.deliverySlot === slot && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre')
                      );
                      const isLivre = activeDelivery?.deliveryStatus === 'livre';
                      
                      const isBlockedDate = (config.blockedPeriods || []).some(
                        p => dateKey >= p.from && dateKey <= p.to
                      );

                      const refDate = new Date(selectedDate);
                      const jsDay = refDate.getDay();
                      const workingDayNum = jsDay === 0 ? 7 : jsDay;
                      const isWorkingDay = config.workingDays.includes(workingDayNum);
                      const isDisabled = isBlockedDate || !isWorkingDay;

                      return (
                        <div 
                          key={slot} 
                          className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                            isDisabled 
                            ? 'bg-slate-50/50 border-slate-200 opacity-75' 
                            : activeDelivery 
                              ? isLivre 
                                ? 'border-slate-200 bg-slate-100/55 opacity-80'
                                : 'border-blue-200 bg-blue-50/20' 
                              : 'border-slate-100 bg-slate-50/20 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              isDisabled 
                              ? 'bg-slate-200 text-slate-400' 
                              : activeDelivery 
                                ? isLivre 
                                  ? 'bg-slate-400 text-white'
                                  : 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              <Clock size={14} />
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase block">{slot}</span>
                              {isDisabled ? (
                                <span className="font-extrabold text-slate-400 text-xs">
                                  {isBlockedDate ? 'Indisponible (Période bloquée)' : 'Fermé (Jour non ouvré)'}
                                </span>
                              ) : activeDelivery ? (
                                <span className={`font-extrabold text-xs ${isLivre ? 'text-slate-500 line-through' : 'text-blue-900'}`}>
                                  {isLivre ? 'Livré (Historique)' : 'Occupé'} • {activeDelivery.clientName}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold text-xs">Disponible</span>
                              )}
                            </div>
                          </div>

                          {!isDisabled && (
                            activeDelivery ? (
                              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                                <button
                                  onClick={() => { setViewingVehicleSale(activeDelivery); }}
                                  className={`text-left bg-white border p-2 rounded-lg shadow-sm hover:shadow-md transition-all group flex flex-col gap-0.5 shrink-0 cursor-pointer ${
                                    isLivre ? 'border-slate-200' : 'border-blue-200 hover:border-blue-400'
                                  }`}
                                >
                                  <div className={`flex items-center gap-1 font-extrabold group-hover:text-blue-600 transition-colors text-[11px] ${isLivre ? 'text-slate-500 line-through' : 'text-blue-900'}`}>
                                    <Car size={11} className={isLivre ? 'text-slate-400' : 'text-blue-500'} />
                                    <span>{activeDelivery.marque} {activeDelivery.modele}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1 text-[9px] text-slate-500 font-bold font-mono">
                                    {activeDelivery.plaque && (
                                      <span className="bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-slate-700">Immat: {activeDelivery.plaque}</span>
                                    )}
                                  </div>
                                </button>

                                {/* Validation button 'Sortir' replaces the small icon button, shown only if not delivered */}
                                {!isLivre && (
                                  <button 
                                    onClick={() => handleMarkAsDelivered(activeDelivery)}
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 size={11} /> Sortir
                                  </button>
                                )}

                                <button 
                                  onClick={() => openDischargeModal(activeDelivery)}
                                  className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-black px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer size={11} /> Décharge
                                </button>

                                {/* If delivered, modifications restricted to admin and park_manager */}
                                {isLivre ? (
                                  canModifySortie && (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setIsPlanningSale(activeDelivery);
                                          setPlanningSlot(activeDelivery.deliverySlot || slot);
                                          setSelectedDate(activeDelivery.deliveryDate || dateKey);
                                        }}
                                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-black px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer animate-scale-up"
                                      >
                                        <CalendarIcon size={11} /> Modifier
                                      </button>

                                      <button 
                                        onClick={() => handleCancelDelivery(activeDelivery)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent rounded transition-all cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  )
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setIsPlanningSale(activeDelivery);
                                        setPlanningSlot(activeDelivery.deliverySlot || slot);
                                        setSelectedDate(activeDelivery.deliveryDate || dateKey);
                                      }}
                                      className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-black px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer animate-scale-up"
                                    >
                                      <CalendarIcon size={11} /> Modifier
                                    </button>

                                    <button 
                                      onClick={() => handleCancelDelivery(activeDelivery)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent rounded transition-all cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div>
                                <button 
                                  onClick={() => {
                                    setIsAssigningForSlot({ date: dateKey, slot: slot });
                                  }}
                                  className="text-[10px] text-slate-600 hover:text-slate-900 font-bold px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  + Assigner un véhicule
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB: CONFIGURATION ==================== */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-8 animate-fade-in-up max-w-4xl mx-auto">
            
            {/* Delivery Hours Slots Manager */}
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                Créneaux Horaires de Livraison
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configurez les heures de rendez-vous disponibles pour vos clients lors de leur réservation.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* List of slots */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                  {config.slots.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Aucun créneau configuré.</p>
                  ) : (
                    config.slots.map((slot, idx) => (
                      <div key={slot} className="bg-white border border-slate-200 p-2 px-3 rounded-lg flex justify-between items-center text-xs font-bold text-slate-700 shadow-sm">
                        <span className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /> {slot}</span>
                        <button 
                          onClick={() => handleRemoveSlot(idx)}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add slot form */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ajouter un créneau</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Heure de début</label>
                      <input 
                        type="text" 
                        placeholder="ex: 08:30" 
                        value={newSlotStart} 
                        onChange={e => setNewSlotStart(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Heure de fin</label>
                      <input 
                        type="text" 
                        placeholder="ex: 10:00" 
                        value={newSlotEnd} 
                        onChange={e => setNewSlotEnd(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" 
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleAddSlot}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Enregistrer le créneau
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Working Days Manager */}
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <CalendarIcon className="text-blue-600" size={18} />
                Jours d'ouverture de l'atelier
              </h3>
              <p className="text-xs text-slate-400 mt-1">Cochez les jours de la semaine disponibles pour planifier des remises de clés.</p>
              
              <div className="flex flex-wrap gap-2.5 mt-4">
                {[
                  { value: 1, label: "Lundi" },
                  { value: 2, label: "Mardi" },
                  { value: 3, label: "Mercredi" },
                  { value: 4, label: "Jeudi" },
                  { value: 5, label: "Vendredi" },
                  { value: 6, label: "Samedi" },
                  { value: 0, label: "Dimanche" }
                ].map(day => {
                  const isActive = config.workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleToggleWorkingDay(day.value)}
                      className={`p-2.5 px-4 rounded-xl border-2 font-bold text-xs transition-all cursor-pointer ${
                        isActive 
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-extrabold shadow-sm' 
                        : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Limit and Blocked Periods Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Daily Capacity Limit and Reminders */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-3 shadow-inner">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Settings className="text-blue-600" size={16} />
                    Limite de Livraisons Quotidiennes
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Fixez le nombre maximum de rendez-vous de livraison que les clients peuvent réserver par jour via leur lien public. Les administrateurs et gestionnaires de parc peuvent outrepasser cette limite.
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.maxDeliveriesPerDay || 4}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 4;
                        setConfig(prev => ({ ...prev, maxDeliveriesPerDay: val }));
                      }}
                      className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                    />
                    <span className="text-xs font-bold text-slate-500">livraisons max par jour</span>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => saveConfig(config)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow cursor-pointer"
                    >
                      Enregistrer la limite
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-3 shadow-inner animate-fade-in-up">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Bell className="text-blue-600" size={16} />
                    Rappels de Livraison
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Définissez à quel moment les notifications de rappel de livraison doivent s'afficher dans l'application (pour le commercial assigné et le gestionnaire de parc).
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <select
                      value={config.reminderDaysBefore ?? 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setConfig(prev => ({ ...prev, reminderDaysBefore: val }));
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                    >
                      <option value={0}>Le jour même de la livraison</option>
                      <option value={1}>1 jour à l'avance</option>
                      <option value={2}>2 jours à l'avance</option>
                      <option value={3}>3 jours à l'avance</option>
                      <option value={5}>5 jours à l'avance</option>
                      <option value={7}>7 jours à l'avance</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => saveConfig(config)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow cursor-pointer"
                    >
                      Enregistrer le délai de rappel
                    </button>
                  </div>
                </div>

                {/* Minimum days before client booking restriction */}
                <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-3 shadow-inner">
                  <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <CalendarIcon className="text-blue-600" size={16} />
                    Délai Minimum de Réservation Client
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Empêchez le client de choisir une date de rendez-vous trop proche lorsqu'il utilise son lien public de programmation (ex: le jour-même, le lendemain ou le surlendemain).
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <select
                      value={config.minDaysBeforeBooking ?? 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setConfig(prev => ({ ...prev, minDaysBeforeBooking: val }));
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                    >
                      <option value={0}>Pas de restriction (le jour même est possible)</option>
                      <option value={1}>Demain inclus (J+1 minimum)</option>
                      <option value={2}>Après-demain inclus (J+2 minimum)</option>
                      <option value={3}>3 jours à l'avance minimum (J+3)</option>
                      <option value={5}>5 jours à l'avance minimum (J+5)</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => saveConfig(config)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow cursor-pointer"
                    >
                      Enregistrer la restriction
                    </button>
                  </div>
                </div>
              </div>

              {/* Blocked Periods Form and List */}
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4 shadow-inner">
                <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={16} />
                  Bloquer une Période (Fermeture / Congés)
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Interdisez aux clients de planifier des livraisons pendant une plage de dates spécifique.
                </p>

                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Du</label>
                      <input
                        type="date"
                        value={blockFrom}
                        onChange={e => setBlockFrom(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Au (inclus)</label>
                      <input
                        type="date"
                        value={blockTo}
                        onChange={e => setBlockTo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Motif du blocage</label>
                    <input
                      type="text"
                      placeholder="Ex: Congés annuels, Inventaire..."
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBlockedPeriod}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Bloquer cette période
                  </button>
                </div>

                {/* List of Blocked Periods */}
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {(!config.blockedPeriods || config.blockedPeriods.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center italic py-2">Aucune période de blocage active.</p>
                  ) : (
                    config.blockedPeriods.map((period, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-xl flex justify-between items-center text-xs shadow-sm">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-800">
                            Du {new Date(period.from).toLocaleDateString('fr-FR')} au {new Date(period.to).toLocaleDateString('fr-FR')}
                          </p>
                          {period.reason && (
                            <p className="text-[10px] text-slate-500 font-medium truncate">{period.reason}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlockedPeriod(idx)}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer shrink-0"
                          title="Supprimer le blocage"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Discharge Template Text Editor */}
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Printer className="text-blue-600" size={18} />
                Contenu de l'Attestation de Décharge
              </h3>
              <p className="text-xs text-slate-400 mt-1">Rédigez le texte légal imprimé sur la décharge. Utilisez des variables dynamiques entre crochets.</p>
              
              {/* Variable Helper chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['[Client]', '[Marque]', '[Modèle]', '[Plaque]', '[VIN]', '[Entreprise]'].map(variable => (
                  <button
                    key={variable}
                    onClick={() => {
                      setConfig(prev => ({ ...prev, dischargeText: prev.dischargeText + " " + variable }));
                    }}
                    className="bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 text-[10px] font-black px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    + {variable}
                  </button>
                ))}
              </div>

              <textarea
                value={config.dischargeText}
                onChange={e => setConfig({ ...config, dischargeText: e.target.value })}
                rows={4}
                className="w-full mt-3 bg-white border border-slate-200 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 leading-relaxed shadow-inner"
                placeholder="Rédigez ici le texte légal..."
              />

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => saveConfig(config)}
                  className="bg-slate-950 hover:bg-slate-900 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} /> Enregistrer l'attestation
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: AUDIT LOGS ==================== */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 animate-fade-in-up max-w-4xl mx-auto">
            <div className="border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <History className="text-blue-600" size={18} />
                Journal des Actions de Livraison
              </h3>
              <p className="text-xs text-slate-400 mt-1">Historique complet et inaltérable de tous les mouvements et programmations effectués.</p>
            </div>

            {/* List all log entries parsed from sales */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {(() => {
                // Collect and sort all logs across all sales
                const allLogs: { 
                  saleId: string; 
                  client: string; 
                  vehicle: string; 
                  chassis: string;
                  plaque: string;
                  user: string; 
                  action: string; 
                  timestamp: string; 
                  sale: any;
                }[] = [];
                (sales || []).forEach(sale => {
                  if (sale.deliveryLog) {
                    sale.deliveryLog.forEach(log => {
                      allLogs.push({
                        saleId: sale.id,
                        client: sale.clientName,
                        vehicle: `${sale.marque} ${sale.modele}`,
                        chassis: sale.vin || 'Non renseigné',
                        plaque: sale.plaque || 'Non renseignée',
                        user: log.user,
                        action: log.action,
                        timestamp: log.timestamp,
                        sale: sale
                      });
                    });
                  }
                });

                // Sort descending
                allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                if (allLogs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-100 rounded-xl">
                      <History className="mx-auto mb-2 text-slate-200" size={24} />
                      <p className="text-xs font-bold">Aucune activité enregistrée</p>
                    </div>
                  );
                }

                return allLogs.map((log, idx) => (
                  <div key={idx} className="bg-slate-50/50 border border-slate-200/40 p-4 rounded-xl flex items-start justify-between gap-4 text-xs hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-800">{log.user}</span>
                        <span className="text-slate-400 font-bold">•</span>
                        <span className="text-slate-500 font-bold">{log.action}</span>
                      </div>
                      <button 
                        onClick={() => setViewingVehicleSale(log.sale)}
                        className="text-left text-blue-600 hover:text-blue-800 font-extrabold text-[10px] uppercase cursor-pointer hover:underline block mt-1 transition-all"
                        title="Cliquer pour ouvrir le dossier"
                      >
                        Dossier : {log.client} - {log.vehicle} - Châssis : {log.chassis} - Plaque : {log.plaque}
                      </button>
                    </div>
                    <span className="text-slate-400 font-bold text-[10px] shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ==================== DRAWER: PLAN FROM CALENDAR ==================== */}
      {isPlanningSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-scale-up">
            <button 
              onClick={() => setIsPlanningSale(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="font-extrabold text-slate-900 text-lg mb-2">Programmer la Sortie</h3>
            <p className="text-xs text-slate-500 mb-4">Configurez le rendez-vous pour <span className="font-bold text-slate-800">{isPlanningSale.clientName}</span>.</p>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 space-y-1 text-xs text-slate-700">
              <div className="font-bold">{isPlanningSale.marque} {isPlanningSale.modele}</div>
              <div className="font-mono text-slate-500">VIN : {isPlanningSale.vin || 'N/A'} • Immat : {isPlanningSale.plaque || 'N/A'}</div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date de rendez-vous</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Créneau horaire libre</label>
                <select 
                  value={planningSlot} 
                  onChange={e => setPlanningSlot(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                >
                  {config.slots.map(slot => {
                    // Check if slot already occupied on this date
                    const isOccupied = (sales || []).some(s => s.deliveryDate === selectedDate && s.deliverySlot === slot && (s.deliveryStatus === 'programmee' || s.deliveryStatus === 'livre'));
                    return (
                      <option key={slot} value={slot} disabled={isOccupied}>
                        {slot} {isOccupied ? " (Déjà réservé)" : " (Disponible)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button 
                onClick={() => handleScheduleDelivery(isPlanningSale, selectedDate, planningSlot)}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white font-black py-2.5 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
              >
                <Check size={16} /> Confirmer le Rendez-vous
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: DISCHARGE GENERATION ==================== */}
      {isGeneratingDischarge && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">Générer la Décharge de Sortie</h3>
                <p className="text-xs text-slate-500 mt-0.5">Complétez le récépissé de remise des clés.</p>
              </div>
              <button 
                onClick={() => setIsGeneratingDischarge(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm">
              
              {/* Recipient selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Qui réceptionne le véhicule ?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDischargeForm({ ...dischargeForm, recipientType: 'client', recipientName: isGeneratingDischarge.clientName })}
                    className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer font-bold text-xs ${
                      dischargeForm.recipientType === 'client'
                      ? 'border-blue-600 bg-blue-50/20 text-blue-900 font-extrabold'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    👤 Le Client Acheteur
                  </button>
                  <button
                    onClick={() => setDischargeForm({ ...dischargeForm, recipientType: 'other', recipientName: '' })}
                    className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer font-bold text-xs ${
                      dischargeForm.recipientType === 'other'
                      ? 'border-blue-600 bg-blue-50/20 text-blue-900 font-extrabold'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    ⚙️ Mandataire / Conjoint
                  </button>
                </div>
              </div>

              {/* Recipient fields if mandataire */}
              {dischargeForm.recipientType === 'other' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in-up bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom du mandataire</label>
                    <input 
                      type="text" 
                      required
                      placeholder="ex: Jean Dupon" 
                      value={dischargeForm.recipientName} 
                      onChange={e => setDischargeForm({ ...dischargeForm, recipientName: e.target.value })} 
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pièce d'identité n°</label>
                    <input 
                      type="text" 
                      placeholder="ex: CNI / Passeport" 
                      value={dischargeForm.recipientId} 
                      onChange={e => setDischargeForm({ ...dischargeForm, recipientId: e.target.value })} 
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" 
                    />
                  </div>
                </div>
              )}

              {/* Checklist items */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Documents et éléments remis</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {Object.entries(dischargeForm.checkedItems).map(([key, value]) => {
                    const formattedLabel = key.replace(/_/g, ' ');
                    return (
                      <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => {
                            setDischargeForm({
                              ...dischargeForm,
                              checkedItems: {
                                ...dischargeForm.checkedItems,
                                [key]: e.target.checked
                              }
                            });
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="uppercase">{formattedLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Extra text comment if AUTRE checked */}
              {dischargeForm.checkedItems.AUTRE && (
                <div className="animate-fade-in-up">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Détails de l'élément remis</label>
                  <input 
                    type="text" 
                    placeholder="ex: Tapis de sol, gilets de sécurité, etc." 
                    value={dischargeForm.autreCommentaire} 
                    onChange={e => setDischargeForm({ ...dischargeForm, autreCommentaire: e.target.value })} 
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" 
                  />
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsGeneratingDischarge(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold px-4 py-2 border border-slate-200 bg-white rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button 
                onClick={triggerPrintDischarge}
                disabled={dischargeForm.recipientType === 'other' && !dischargeForm.recipientName}
                className="text-xs bg-slate-950 hover:bg-slate-900 text-white font-black px-5 py-2 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={14} /> Imprimer & Générer la Décharge
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. Modal: Détails du véhicule à planifier */}
      {viewingVehicleSale && (
        <div 
          onClick={() => setViewingVehicleSale(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-lg w-full overflow-hidden animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-amber-200">Facturé • En attente de sortie</span>
                <h3 className="font-extrabold text-slate-900 text-lg mt-2 flex items-center gap-2">
                  <Car className="text-blue-600" size={18} />
                  {viewingVehicleSale.marque} {viewingVehicleSale.modele}
                </h3>
              </div>
              <button 
                onClick={() => setViewingVehicleSale(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Plaque d'immatriculation</span>
                  <span className="font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                    {viewingVehicleSale.plaque || "Non renseignée"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Numéro de Châssis (VIN)</span>
                  <span className="font-bold font-mono text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded block truncate">
                    {viewingVehicleSale.vin || "Non renseigné"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Client & Dossier</span>
                <p className="font-black text-slate-900 text-base">{viewingVehicleSale.clientName}</p>
                <p className="text-xs text-slate-500 mt-1">Bon de Commande : N° {viewingVehicleSale.bdcNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Commercial Assigné</span>
                  <span className="font-bold text-slate-800">{viewingVehicleSale.commercial || "Non assigné"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Date de Vente</span>
                  <span className="font-bold text-slate-800">{viewingVehicleSale.date ? new Date(viewingVehicleSale.date).toLocaleDateString('fr-FR') : "N/A"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Couleur</span>
                  <span className="font-bold text-slate-800">{viewingVehicleSale.color || "Non spécifiée"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mise en circulation</span>
                  <span className="font-bold text-slate-800 font-mono">{viewingVehicleSale.mec || "Non renseignée"}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setViewingVehicleSale(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold px-4 py-2 border border-slate-200 bg-white rounded-lg cursor-pointer"
              >
                Fermer
              </button>
              <button 
                onClick={() => {
                  setViewingVehicleSale(null);
                  window.location.hash = `#detail/${viewingVehicleSale.id}`;
                }}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                Ouvrir le dossier client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Sélectionner un véhicule à assigner */}
      {isAssigningForSlot && (
        <div 
          onClick={() => setIsAssigningForSlot(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-md w-full overflow-hidden animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Assigner un Véhicule</h3>
                <p className="text-xs text-slate-500 mt-1">Sélectionnez un véhicule pour le créneau <span className="font-black text-slate-700">{isAssigningForSlot.slot}</span> du <span className="font-black text-slate-700">{new Date(isAssigningForSlot.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>.</p>
              </div>
              <button 
                onClick={() => setIsAssigningForSlot(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[350px] overflow-y-auto space-y-2">
              {pendingPlanificationSales.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="mx-auto mb-2 text-slate-200" size={24} />
                  <p className="text-xs font-bold uppercase tracking-wider">Aucun véhicule disponible</p>
                  <p className="text-[10px] text-slate-400 mt-1">Tous les véhicules facturés ont déjà été planifiés.</p>
                </div>
              ) : (
                pendingPlanificationSales.map(sale => (
                  <button
                    key={sale.id}
                    onClick={() => {
                      setIsAssigningForSlot(null);
                      setIsPlanningSale(sale);
                      setPlanningSlot(isAssigningForSlot.slot);
                    }}
                    className="w-full text-left bg-slate-50 hover:bg-blue-50/50 border border-slate-200/50 hover:border-blue-300 p-3.5 rounded-xl transition-all flex justify-between items-center group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs group-hover:text-blue-900 transition-colors">{sale.marque} {sale.modele}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Client: {sale.clientName}</p>
                      <span className="text-[9px] bg-slate-200/60 font-mono text-slate-500 px-1.5 py-0.5 rounded mt-1.5 inline-block">BDC {sale.bdcNumber}</span>
                    </div>
                    <span className="text-[10px] text-blue-600 group-hover:translate-x-1 transition-transform font-extrabold flex items-center gap-0.5">
                      Choisir <ArrowRight size={10} />
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button 
                onClick={() => setIsAssigningForSlot(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold px-4 py-2 border border-slate-200 bg-white rounded-lg cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
