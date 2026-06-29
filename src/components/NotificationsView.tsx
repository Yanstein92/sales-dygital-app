import React, { useState } from 'react';
import { 
  ArrowLeft, CheckCheck, FileText, Calendar, Truck, 
  Circle, RefreshCw, Bell, Info, ChevronRight, Coins, Settings 
} from 'lucide-react';
import { useApp } from '../lib/context';
import { db, doc, setDoc, getUserDocPath } from '../lib/firebase';

export interface Notification {
  id: string;
  title: string;
  description: string;
  time?: string;
  type: 'bdc' | 'release' | 'refund' | 'system' | 'payment' | 'modification';
  targetHash?: string;
  read: boolean;
  createdAt?: string;
}

interface NotificationsViewProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onBack: () => void;
  onNavigate: (hash: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onBack,
  onNavigate,
}) => {
  const { userProfile, setUserProfile, userAuth } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');

  // Load preferences from profile
  const settings = {
    bdc: userProfile?.notificationSettings?.bdc ?? true,
    release: userProfile?.notificationSettings?.release ?? true,
    payment: userProfile?.notificationSettings?.payment ?? true,
    refund: userProfile?.notificationSettings?.refund ?? true,
    modification: userProfile?.notificationSettings?.modification ?? true,
    deliveryReminder: userProfile?.notificationSettings?.deliveryReminder ?? true,
    deliveryReminderHours: userProfile?.notificationSettings?.deliveryReminderHours ?? 24,
  };

  const handleToggleSetting = async (key: keyof Omit<typeof settings, 'deliveryReminderHours'>) => {
    if (!userAuth?.uid) return;
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };

    // Optimistic update of React context
    setUserProfile(prev => prev ? {
      ...prev,
      notificationSettings: newSettings
    } : null);

    try {
      await setDoc(doc(db, getUserDocPath(userAuth.uid)), {
        notificationSettings: newSettings
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save settings to Firestore", e);
    }
  };

  const handleUpdateHoursSetting = async (hours: number) => {
    if (!userAuth?.uid) return;
    const newSettings = {
      ...settings,
      deliveryReminderHours: hours
    };

    setUserProfile(prev => prev ? {
      ...prev,
      notificationSettings: newSettings
    } : null);

    try {
      await setDoc(doc(db, getUserDocPath(userAuth.uid)), {
        notificationSettings: newSettings
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save settings to Firestore", e);
    }
  };

  const formatRelativeTime = (isoString?: string, defaultTime?: string) => {
    if (!isoString) return defaultTime || '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} j`;
  };

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'unread') return !notif.read;
    if (activeTab === 'read') return notif.read;
    return true;
  });

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'bdc':
        return (
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
            <FileText size={18} />
          </div>
        );
      case 'release':
        return (
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
            <Truck size={18} />
          </div>
        );
      case 'refund':
        return (
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shrink-0">
            <RefreshCw size={18} />
          </div>
        );
      case 'payment':
        return (
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
            <Coins size={18} />
          </div>
        );
      case 'modification':
        return (
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0">
            <RefreshCw size={18} />
          </div>
        );
      default:
        return (
          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 shrink-0">
            <Bell size={18} />
          </div>
        );
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read
    onMarkAsRead(notif.id);
    
    // Navigate to target path if available
    if (notif.targetHash) {
      onNavigate(notif.targetHash);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all cursor-pointer shadow-xs"
            title="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Centre de notifications</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Suivez l'activité de votre entreprise en temps réel</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <CheckCheck size={14} className="text-blue-600" />
            <span>Tout marquer comme lu</span>
          </button>
        )}
      </div>

      {/* Grid Layout: Notifications and Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Tabs and List (3/4 width on desktop) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100/95 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Tabs Bar */}
            <div className="flex border-b border-slate-100 px-6 py-1 bg-slate-50/50">
              <div className="flex space-x-6">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-3 text-xs font-black relative cursor-pointer transition-all ${
                    activeTab === 'all' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Toutes ({notifications.length})
                  {activeTab === 'all' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={`py-3 text-xs font-black relative cursor-pointer transition-all ${
                    activeTab === 'unread' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Non lues ({unreadCount})
                  {activeTab === 'unread' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('read')}
                  className={`py-3 text-xs font-black relative cursor-pointer transition-all ${
                    activeTab === 'read' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Lues ({notifications.length - unreadCount})
                  {activeTab === 'read' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="divide-y divide-slate-100/70">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-20 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-100">
                    <Bell size={20} />
                  </div>
                  <p className="text-slate-800 font-bold text-sm">Aucune notification</p>
                  <p className="text-slate-400 text-xs mt-1">Vous n'avez pas de notifications correspondant à ce filtre.</p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-5 flex items-start gap-4 hover:bg-slate-50/70 transition-all cursor-pointer group relative ${
                      !notif.read ? 'bg-blue-50/10' : ''
                    }`}
                  >
                    {/* Unread indicator bullet */}
                    {!notif.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}

                    {/* Left: Icon type */}
                    {getNotifIcon(notif.type)}

                    {/* Middle: Title, Description, Date */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-black truncate ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0 ml-auto">
                          {formatRelativeTime(notif.createdAt, notif.time)}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed font-medium">
                        {notif.description}
                      </p>
                      
                      {notif.targetHash && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-600 bg-blue-50 hover:underline px-2 py-0.5 rounded mt-2 uppercase tracking-wide">
                          Voir la source
                        </span>
                      )}
                    </div>

                    {/* Right: Chevron */}
                    <div className="self-center text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Settings Sidebar Panel (1/4 width on desktop) */}
        <div className="bg-white rounded-2xl border border-slate-100/95 shadow-sm p-6 space-y-5 h-fit">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
              <Settings size={16} />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Vos Paramètres</h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Contrôlez vos alertes</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Toggle 1: BDC */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-800 cursor-pointer">Nouveaux BDC</label>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Alertes lors d'imports ou de créations de fiches de vente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSetting('bdc')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.bdc ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.bdc ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Releases & Deliveries */}
            <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-800 cursor-pointer">Sorties & Livraisons</label>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Changements de planning, livraisons validées, remises en parc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSetting('release')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.release ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.release ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Payments */}
            <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-800 cursor-pointer">Paiements & Versements</label>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Ajout, modification ou encaissement de virements ou acomptes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSetting('payment')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.payment ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.payment ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4: Refunds */}
            <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-800 cursor-pointer">Remboursements</label>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Notifications d'annulation, de remboursements et d'avoirs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSetting('refund')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.refund ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.refund ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 5: Modifications */}
            <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-slate-800 cursor-pointer">Modifications de Fiche</label>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Modifications de n'importe quel champ ou d'une information générale.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSetting('modification')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.modification ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.modification ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 6: Pre-delivery Reminders */}
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <label className="text-xs font-black text-slate-800 cursor-pointer">Rappels de livraison</label>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal">
                    Alertes de rappel envoyées aux administrateurs, commerciaux et gestionnaires de stock avant chaque livraison.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSetting('deliveryReminder')}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.deliveryReminder ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.deliveryReminder ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.deliveryReminder && (
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 max-w-xs self-start w-full">
                  <span className="text-[10px] font-black text-slate-500 pl-1.5">Délai :</span>
                  <div className="flex gap-1 flex-1">
                    {[24, 48, 72].map(hours => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => handleUpdateHoursSetting(hours)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          settings.deliveryReminderHours === hours
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-250 font-black'
                            : 'text-slate-500 hover:text-slate-850'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
