import React, { useState } from 'react';
import { ArrowLeft, CheckCheck, FileText, Calendar, Truck, Circle, RefreshCw, Bell, Info, ChevronRight } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'bdc' | 'release' | 'refund' | 'system';
  targetHash?: string;
  read: boolean;
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
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'unread') return !notif.read;
    if (activeTab === 'read') return notif.read;
    return true;
  });

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'bdc':
        return (
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <FileText size={18} />
          </div>
        );
      case 'release':
        return (
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Truck size={18} />
          </div>
        );
      case 'refund':
        return (
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <RefreshCw size={18} />
          </div>
        );
      default:
        return (
          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100">
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

      {/* Main Tabs and List */}
      <div className="bg-white rounded-2xl border border-slate-100/95 shadow-sm overflow-hidden">
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-fade-in" />
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-fade-in" />
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
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-fade-in" />
              )}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-slate-100/70">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 px-4">
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
                  !notif.read ? 'bg-blue-50/20' : ''
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
                      {notif.time}
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
                <div className="self-center text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all">
                  <ChevronRight size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
