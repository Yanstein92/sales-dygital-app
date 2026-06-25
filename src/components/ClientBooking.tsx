import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Loader2, Car, Shield, User } from 'lucide-react';

interface ClientBookingProps {
  saleId: string;
  onShowToast: (m: string, t: 'success' | 'error') => void;
}

export const ClientBooking: React.FC<ClientBookingProps> = ({ saleId, onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Loaded data
  const [sale, setSale] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    slots: ["09:00 - 10:30", "10:30 - 12:00", "14:00 - 15:30", "15:30 - 17:00"],
    workingDays: [1, 2, 3, 4, 5]
  });
  const [bookings, setBookings] = useState<any[]>([]);

  // Selection states
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/booking/${saleId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erreur de chargement");
        }
        const data = await res.json();
        setSale(data.sale);
        setConfig(data.config);
        setBookings(data.bookings);

        // Pre-fill if already scheduled
        if (data.sale.deliveryDate) {
          setSelectedDate(data.sale.deliveryDate);
          setSelectedSlot(data.sale.deliverySlot || '');
        }
      } catch (e: any) {
        setError(e.message || "Impossible de charger le dossier.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [saleId]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot) {
      onShowToast("Veuillez sélectionner une date et un créneau horaire.", "error");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/booking/${saleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, slot: selectedSlot })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors de l'enregistrement");
      }
      setSuccess(true);
      onShowToast("Votre livraison a été planifiée avec succès !", "success");
    } catch (e: any) {
      onShowToast(e.message || "Erreur réseau", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Generate 25 days list starting from today
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay(); // 0 Sunday, 6 Saturday
      
      // Filter out non-working days
      if (config.workingDays && config.workingDays.includes(dayOfWeek)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        // 1. Check if date is in any blocked period
        const blockedPeriods = config.blockedPeriods || [];
        const isBlocked = blockedPeriods.some((p: any) => {
          if (!p.from || !p.to) return false;
          return formattedDate >= p.from && formattedDate <= p.to;
        });

        // 2. Check if day has reached limit
        const maxLimit = config.maxDeliveriesPerDay;
        let isFullyBooked = false;
        if (maxLimit && maxLimit > 0) {
          const bookingsOnDayCount = bookings.filter(b => b.date === formattedDate).length;
          if (bookingsOnDayCount >= maxLimit && sale?.deliveryDate !== formattedDate) {
            isFullyBooked = true;
          }
        }
        
        dates.push({
          dateStr: formattedDate,
          label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
          rawDate: d,
          isBlocked,
          isFullyBooked
        });
      }
    }
    return dates;
  };

  const isSlotBooked = (date: string, slot: string) => {
    return bookings.some(b => b.date === date && b.slot === slot && sale?.deliverySlot !== slot);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 size={40} className="text-slate-900 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Chargement de votre espace de réservation...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-red-100">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Lien invalide ou expiré</h2>
          <p className="text-slate-500 text-sm mb-6">{error || "Le dossier de commande demandé n'existe pas."}</p>
          <div className="text-xs text-slate-400">Veuillez contacter le concessionnaire ou votre commercial pour plus d'informations.</div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center border border-emerald-100 animate-fade-in-up">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Réservation Confirmée !</h2>
          <p className="text-slate-600 text-sm mb-6">Votre rendez-vous pour la livraison de votre véhicule est bien enregistré.</p>
          
          <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-100 space-y-3 mb-6 text-sm">
            <div className="flex items-start gap-3">
              <Car className="text-slate-400 mt-0.5" size={18} />
              <div>
                <div className="font-bold text-slate-800">{sale.marque} {sale.modele}</div>
                <div className="text-xs text-slate-500 font-mono">VIN : {sale.vin || 'Non renseigné'} • Immat : {sale.plaque || 'Non renseigné'}</div>
              </div>
            </div>
            <hr className="border-slate-200" />
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-slate-400" size={18} />
              <div className="text-slate-700 font-medium">
                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="text-slate-400" size={18} />
              <div className="text-slate-700 font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">
                Créneau : {selectedSlot}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-slate-400">
            Un email de confirmation vous a été envoyé. Si vous devez modifier cet horaire, veuillez contacter {sale.company}.
          </div>
        </div>
      </div>
    );
  }

  const availableDates = getAvailableDates();

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white font-black px-4 py-2 rounded-xl mb-4 text-sm shadow-md">
            <Shield size={16} className="text-blue-400" /> {sale.company}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Planifiez votre livraison</h1>
          <p className="text-slate-500 mt-2 text-sm">Bonjour <span className="font-bold text-slate-800">{sale.clientName}</span>, veuillez choisir le jour et l'heure de livraison qui vous conviennent.</p>
        </div>

        {/* Vehicle Info Card */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/60 p-5 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-inner">
            <Car size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Véhicule réservé</div>
            <h3 className="font-extrabold text-slate-800 text-base">{sale.marque} {sale.modele}</h3>
            <div className="text-slate-500 text-xs truncate">VIN : {sale.vin || 'N/A'} • Immatriculation : {sale.plaque || 'N/A'}</div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/60 p-6 mb-6">
          <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-sm">
            <CalendarIcon size={18} className="text-blue-600" />
            1. Choisissez une date de livraison
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {availableDates.map(item => {
              const isSelected = selectedDate === item.dateStr;
              const isDisabled = item.isBlocked || item.isFullyBooked;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setSelectedDate(item.dateStr);
                    setSelectedSlot('');
                  }}
                  className={`p-3 rounded-xl border-2 text-center transition-all flex flex-col justify-center items-center relative ${
                    isDisabled
                    ? 'border-slate-100 bg-slate-100/50 text-slate-400 cursor-not-allowed opacity-60'
                    : isSelected 
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-md ring-2 ring-blue-500/10' 
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 cursor-pointer'
                  }`}
                  title={item.isBlocked ? "Période bloquée par l'établissement" : item.isFullyBooked ? "Limite de livraisons atteinte pour ce jour" : ""}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label.split(' ')[0]}</span>
                  <span className="text-lg font-black">{item.label.split(' ')[1]}</span>
                  <span className="text-xs font-medium text-slate-500">{item.label.split(' ')[2]}</span>
                  {item.isBlocked && (
                    <span className="absolute bottom-1 text-[8px] font-black bg-red-100 text-red-800 px-1 rounded uppercase tracking-wider scale-90">Bloqué</span>
                  )}
                  {item.isFullyBooked && (
                    <span className="absolute bottom-1 text-[8px] font-black bg-amber-100 text-amber-800 px-1 rounded uppercase tracking-wider scale-90">Complet</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot Selector */}
        {selectedDate && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200/60 p-6 mb-8 animate-fade-in-up">
            <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2 text-sm">
              <Clock size={18} className="text-blue-600" />
              2. Choisissez un créneau horaire
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.slots && config.slots.map((slot: string) => {
                const isBooked = isSlotBooked(selectedDate, slot);
                const isSelected = selectedSlot === slot;
                
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isBooked}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${
                      isBooked
                      ? 'border-slate-100 bg-slate-50 text-slate-300'
                      : isSelected
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-md ring-2 ring-blue-500/10'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{slot}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-md uppercase font-black tracking-wider ${
                      isBooked 
                      ? 'bg-slate-100 text-slate-400' 
                      : isSelected 
                      ? 'bg-blue-600 text-white shadow-sm animate-scale-up' 
                      : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isBooked ? "Indisponible" : isSelected ? "Sélectionné" : "Disponible"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirm Booking Panel */}
        {selectedDate && selectedSlot && (
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-up">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Rendez-vous sélectionné</div>
              <p className="text-sm font-medium">
                Le <span className="font-extrabold text-blue-400">{new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span> à <span className="font-extrabold text-blue-400">{selectedSlot}</span>
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-6 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Confirmer la livraison
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
