import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../lib/context';
import { 
  Send, MessageSquare, Image as ImageIcon, Users, User, ArrowLeft, 
  Search, Smile, Check, CheckCheck, Phone, Video, MoreVertical, 
  Paperclip, Plus, X, Shield, Bell, BellOff, Volume2, HelpCircle, FileText, Car
} from 'lucide-react';
import { db, getUserPath, getUserDocPath } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, query, orderBy, limit, getDocs, updateDoc, writeBatch } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  timestamp: string;
  imageUrl?: string;
  readBy?: string[];
}

interface ChatSession {
  id: string;
  name: string;
  isGroup: boolean;
  participants: string[];
  createdBy: string;
  createdAt: string;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: string;
  };
  unreadCounts?: Record<string, number>;
}

// User-specific notification settings
interface ChatNotificationSettings {
  muteAll: boolean;
  muteGroups: boolean;
  showToasts: boolean;
  playSounds: boolean;
}

export const ChatView: React.FC = () => {
  const { userProfile, userAuth, databaseUid, teamMembers, clients, vehicles, sales } = useApp();
  const currentUserId = userAuth?.uid || '';
  const currentUserName = userProfile?.name || 'Utilisateur';

  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Create group modal & state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  
  // Search session state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Image sending state
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Mention Autocomplete state
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [mentionCategory, setMentionCategory] = useState<'all' | 'members' | 'clients' | 'vehicles' | 'sales'>('all');

  // Notification settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState<ChatNotificationSettings>({
    muteAll: false,
    muteGroups: false,
    showToasts: true,
    playSounds: true
  });

  // Hover states for tooltips
  const [hoveredTag, setHoveredTag] = useState<{
    type: 'member' | 'client' | 'vehicle' | 'sale';
    id: string;
    rect: DOMRect;
  } | null>(null);

  // References
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load user notification settings on mount
  useEffect(() => {
    if (!currentUserId) return;
    const stored = localStorage.getItem(`chat_notif_settings_${currentUserId}`);
    if (stored) {
      try {
        setNotifSettings(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUserId]);

  const saveNotifSettings = (newSettings: ChatNotificationSettings) => {
    setNotifSettings(newSettings);
    localStorage.setItem(`chat_notif_settings_${currentUserId}`, JSON.stringify(newSettings));
  };

  // Subscribe to chat sessions
  useEffect(() => {
    if (!databaseUid) return;
    const colRef = collection(db, getUserPath('chats', databaseUid));
    const unsub = onSnapshot(colRef, (snapshot) => {
      const loaded: ChatSession[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      // Sort sessions by last message timestamp descending, or created date
      loaded.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || a.createdAt;
        const timeB = b.lastMessage?.timestamp || b.createdAt;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
      setSessions(loaded);
      
      // If we don't have an active session, or the active session data changed, update it
      if (activeSession) {
        const updated = loaded.find(s => s.id === activeSession.id);
        if (updated) {
          setActiveSession(updated);
        }
      }
    }, (error) => {
      console.error("Error fetching sessions:", error);
    });

    return () => unsub();
  }, [databaseUid, activeSession?.id]);

  // Subscribe to messages of active session
  useEffect(() => {
    if (!databaseUid || !activeSession) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, getUserPath('chats', databaseUid) + '/' + activeSession.id + '/messages');
    // For simplicity and real-time without complex queries, get messages sorted by timestamp
    const unsub = onSnapshot(messagesRef, (snapshot) => {
      const loaded: Message[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as Message);
      });
      loaded.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(loaded);

      // Reset unread count for current user in this session
      try {
        const sessionRef = doc(db, getUserPath('chats', databaseUid), activeSession.id);
        updateDoc(sessionRef, {
          [`unreadCounts.${currentUserId}`]: 0
        }).catch(err => {
          // If updateDoc fails (e.g. key doesn't exist yet), we merge set
          setDoc(sessionRef, {
            unreadCounts: { [currentUserId]: 0 }
          }, { merge: true });
        });
      } catch (e) {
        console.error("Failed to update unread count:", e);
      }
    });

    return () => unsub();
  }, [databaseUid, activeSession?.id, currentUserId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle autocomplete mentions filter
  const filteredSuggestions = useMemo(() => {
    if (!showMentionSuggestions) return [];

    const q = mentionQuery.toLowerCase();
    const list: Array<{
      type: 'member' | 'client' | 'vehicle' | 'sale';
      id: string;
      title: string;
      subtitle: string;
    }> = [];

    // Members
    if (mentionCategory === 'all' || mentionCategory === 'members') {
      teamMembers.forEach(m => {
        if (m.name?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q)) {
          list.push({
            type: 'member',
            id: m.uid || m.id,
            title: m.name || '',
            subtitle: m.role === 'admin' ? 'Administrateur' : m.role === 'commercial' ? 'Commercial' : m.role === 'park_manager' ? 'Gestionnaire de Stock' : 'Équipe'
          });
        }
      });
      // Also add generic roles as mentions
      ['admin', 'commercial', 'park_manager'].forEach(role => {
        const roleLabel = role === 'admin' ? 'Administrateurs' : role === 'commercial' ? 'Commerciaux' : 'Gestionnaires de Stock';
        if (role.includes(q) || roleLabel.toLowerCase().includes(q)) {
          list.push({
            type: 'member',
            id: `role:${role}`,
            title: `@Role: ${roleLabel}`,
            subtitle: `Tague tous les ${roleLabel.toLowerCase()}`
          });
        }
      });
    }

    // Clients
    if (mentionCategory === 'all' || mentionCategory === 'clients') {
      clients.forEach(c => {
        if (c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)) {
          list.push({
            type: 'client',
            id: c.id,
            title: c.name || '',
            subtitle: `Client • ${c.city || 'Pas de ville'}`
          });
        }
      });
    }

    // Vehicles
    if (mentionCategory === 'all' || mentionCategory === 'vehicles') {
      vehicles.forEach(v => {
        const brandModel = `${v.marque} ${v.modele}`.toLowerCase();
        if (brandModel.includes(q) || v.plaque?.toLowerCase().includes(q) || v.vin?.toLowerCase().includes(q)) {
          list.push({
            type: 'vehicle',
            id: v.id,
            title: `${v.marque} ${v.modele}`,
            subtitle: `Véhicule • Plaque: ${v.plaque || '-'} • VIN: ${v.vin || '-'}`
          });
        }
      });
    }

    // Sales (BDC)
    if (mentionCategory === 'all' || mentionCategory === 'sales') {
      sales.forEach(s => {
        const bdcMatch = `bdc #${s.id}`.toLowerCase();
        if (bdcMatch.includes(q) || s.clientName?.toLowerCase().includes(q) || s.marque?.toLowerCase().includes(q) || s.modele?.toLowerCase().includes(q)) {
          list.push({
            type: 'sale',
            id: s.id,
            title: `Bon de Commande #${s.id.substring(0, 6)}...`,
            subtitle: `Dossier • Client: ${s.clientName} • ${s.marque} ${s.modele}`
          });
        }
      });
    }

    return list.slice(0, 10); // Limit to 10 items for performance & look
  }, [showMentionSuggestions, mentionQuery, mentionCategory, teamMembers, clients, vehicles, sales]);

  // Monitor text typing to open mention autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && (lastAtIdx === 0 || textBeforeCursor[lastAtIdx - 1] === ' ')) {
      // We have a potential trigger!
      const chunk = textBeforeCursor.substring(lastAtIdx + 1);
      // Ensure no spaces inside the mention typing
      if (!chunk.includes(' ')) {
        setShowMentionSuggestions(true);
        setMentionQuery(chunk);
        setMentionTriggerIndex(lastAtIdx);
        return;
      }
    }
    setShowMentionSuggestions(false);
  };

  const selectMentionSuggestion = (item: typeof filteredSuggestions[0]) => {
    if (mentionTriggerIndex === -1) return;

    const textBeforeMention = inputText.substring(0, mentionTriggerIndex);
    const textAfterCursor = inputText.substring(inputRef.current?.selectionStart || mentionTriggerIndex);

    const formattedTag = `[${item.title}](mention:${item.type}:${item.id})`;
    const updatedText = textBeforeMention + formattedTag + ' ' + textAfterCursor;

    setInputText(updatedText);
    setShowMentionSuggestions(false);
    setMentionTriggerIndex(-1);

    // Focus back and set selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = textBeforeMention.length + formattedTag.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  // Convert mentions formatted text into clickable, hoverable elements
  const renderMessageContent = (text: string) => {
    // Regex matching [Title](mention:type:id)
    const mentionRegex = /\[([^\]]+)\]\(mention:([^:]+):([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      
      // Push leading plain text
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const [full, title, type, id] = match;
      
      // Tag hover handlers
      const handleTagMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredTag({
          type: type as any,
          id,
          rect
        });
      };

      const handleTagMouseLeave = () => {
        setHoveredTag(null);
      };

      // Determine tag styling
      let tagBg = 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200';
      if (type === 'client') tagBg = 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200';
      if (type === 'vehicle') tagBg = 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200';
      if (type === 'sale') tagBg = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200';

      parts.push(
        <span
          key={matchIndex}
          onMouseEnter={handleTagMouseEnter}
          onMouseLeave={handleTagMouseLeave}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-extrabold text-xs cursor-pointer transition-all ${tagBg}`}
        >
          {type === 'member' ? '@' : type === 'client' ? '👥 ' : type === 'vehicle' ? '🚗 ' : '📝 '}
          {title}
        </span>
      );

      lastIndex = mentionRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Get active hovered tag details for the summary card
  const activeHoverDetails = useMemo(() => {
    if (!hoveredTag) return null;
    const { type, id } = hoveredTag;

    if (type === 'member') {
      if (id.startsWith('role:')) {
        const role = id.substring(5);
        const membersWithRole = teamMembers.filter(m => m.role === role);
        return {
          type,
          title: `Rôle : ${role === 'admin' ? 'Administrateurs' : role === 'commercial' ? 'Commerciaux' : 'Gestionnaires de Stock'}`,
          details: [
            { label: "Membres affectés", value: `${membersWithRole.length} personne(s)` },
            { label: "Rôles", value: membersWithRole.map(m => m.name).join(', ') || 'Aucun' }
          ]
        };
      } else {
        const member = teamMembers.find(m => (m.uid || m.id) === id);
        if (!member) return null;
        return {
          type,
          title: member.name || '',
          details: [
            { label: "Rôle", value: member.role === 'admin' ? 'Administrateur' : member.role === 'commercial' ? 'Commercial' : 'Gestionnaire de Stock' },
            { label: "Email", value: member.email || 'Non renseigné' },
            { label: "Téléphone", value: member.phone || 'Non renseigné' },
            { label: "Entreprise", value: member.companyId || 'Non renseigné' }
          ]
        };
      }
    }

    if (type === 'client') {
      const client = clients.find(c => c.id === id);
      if (!client) return null;
      return {
        type,
        title: client.name || '',
        details: [
          { label: "Email", value: client.email || 'Non renseigné' },
          { label: "Téléphone", value: client.phone || 'Non renseigné' },
          { label: "Adresse", value: client.address ? `${client.address}, ${client.zipCode} ${client.city}` : 'Non renseignée' }
        ]
      };
    }

    if (type === 'vehicle') {
      const vehicle = vehicles.find(v => v.id === id);
      if (!vehicle) return null;
      return {
        type,
        title: `${vehicle.marque} ${vehicle.modele}`,
        details: [
          { label: "Plaque", value: vehicle.plaque || '-' },
          { label: "VIN/Châssis", value: vehicle.vin || '-' },
          { label: "Prix", value: vehicle.prix ? `${Number(vehicle.prix).toLocaleString('fr-FR')} €` : '-' },
          { label: "Statut", value: vehicle.status === 'disponible' ? 'En Stock' : vehicle.status === 'vendu' ? 'Vendu' : 'Réservé' }
        ]
      };
    }

    if (type === 'sale') {
      const sale = sales.find(s => s.id === id);
      if (!sale) return null;
      return {
        type,
        title: `Bon de Commande #${id.substring(0, 8)}`,
        details: [
          { label: "Client", value: sale.clientName || '-' },
          { label: "Véhicule", value: `${sale.marque} ${sale.modele}` },
          { label: "Prix d'achat", value: sale.price ? `${Number(sale.price).toLocaleString('fr-FR')} €` : '-' },
          { label: "Livraison", value: sale.deliveryDate ? `Planifiée le ${sale.deliveryDate}` : 'Non planifiée' },
          { label: "Statut", value: sale.deliveryStatus === 'livre' ? 'Livré' : sale.deliveryStatus === 'programmee' ? 'Programmé' : 'En attente' }
        ]
      };
    }

    return null;
  }, [hoveredTag, teamMembers, clients, vehicles, sales]);

  // Handle image upload and compression
  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      alert("L'image est trop lourde. Veuillez choisir une image de moins de 500 ko.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setSelectedImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedImageBase64) return;
    if (!databaseUid || !activeSession) return;

    try {
      setIsUploadingImage(true);
      const text = inputText;
      setInputText(''); // Reset early for instant feel
      const imageToSend = selectedImageBase64;
      setSelectedImageBase64(null);

      const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const msgRef = doc(db, getUserPath('chats', databaseUid) + '/' + activeSession.id + '/messages', msgId);

      const payload: Message = {
        id: msgId,
        text: text.trim(),
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: userProfile?.role,
        timestamp: new Date().toISOString()
      };

      if (imageToSend) {
        payload.imageUrl = imageToSend;
      }

      await setDoc(msgRef, payload);

      // Update session last message and trigger red unread badges for OTHER participants
      const sessionRef = doc(db, getUserPath('chats', databaseUid), activeSession.id);
      
      const updatedUnreadCounts: Record<string, any> = {};
      activeSession.participants.forEach(pId => {
        if (pId !== currentUserId) {
          const currentCount = activeSession.unreadCounts?.[pId] || 0;
          updatedUnreadCounts[`unreadCounts.${pId}`] = currentCount + 1;
        }
      });

      await updateDoc(sessionRef, {
        lastMessage: {
          text: imageToSend ? "🖼️ Photo" : text.trim().substring(0, 50),
          senderId: currentUserId,
          senderName: currentUserName,
          timestamp: new Date().toISOString()
        },
        ...updatedUnreadCounts
      });

    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsUploadingImage(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Handle new group creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !databaseUid) return;

    try {
      const gId = 'group_' + Date.now();
      const pList = [...selectedGroupMembers, currentUserId];

      const newGroup: ChatSession = {
        id: gId,
        name: groupName.trim(),
        isGroup: true,
        participants: pList,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
        unreadCounts: pList.reduce((acc, uid) => ({ ...acc, [uid]: 0 }), {})
      };

      await setDoc(doc(db, getUserPath('chats', databaseUid), gId), newGroup);

      // Create a system welcome message
      const welcomeMsgId = 'msg_welcome';
      await setDoc(doc(db, getUserPath('chats', databaseUid) + '/' + gId + '/messages', welcomeMsgId), {
        id: welcomeMsgId,
        text: `🚀 Groupe "${groupName}" créé par ${currentUserName}. Bienvenue !`,
        senderId: 'system',
        senderName: 'Système',
        timestamp: new Date().toISOString()
      });

      setShowCreateGroup(false);
      setGroupName('');
      setSelectedGroupMembers([]);
      setActiveSession(newGroup);
    } catch (err) {
      console.error("Error creating group:", err);
    }
  };

  // Start or open a 1-to-1 direct chat with a member
  const handleOpenDirectChat = async (targetUser: typeof teamMembers[0]) => {
    if (!databaseUid) return;
    const targetUserId = targetUser.uid || targetUser.id;
    if (targetUserId === currentUserId) return;

    // Look if session already exists
    const existing = sessions.find(s => 
      !s.isGroup && 
      s.participants.includes(currentUserId) && 
      s.participants.includes(targetUserId)
    );

    if (existing) {
      setActiveSession(existing);
      return;
    }

    // Otherwise create one
    try {
      const directId = `direct_${currentUserId}_${targetUserId}`;
      const newSession: ChatSession = {
        id: directId,
        name: targetUser.name || 'Discussion',
        isGroup: false,
        participants: [currentUserId, targetUserId],
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
        unreadCounts: {
          [currentUserId]: 0,
          [targetUserId]: 0
        }
      };

      await setDoc(doc(db, getUserPath('chats', databaseUid), directId), newSession);
      setActiveSession(newSession);
    } catch (err) {
      console.error("Error starting direct chat:", err);
    }
  };

  // List of other users to message
  const otherTeamMembers = useMemo(() => {
    return teamMembers.filter(m => (m.uid || m.id) !== currentUserId);
  }, [teamMembers, currentUserId]);

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const nameMatch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const lastMsgMatch = s.lastMessage?.text?.toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || lastMsgMatch;
    });
  }, [sessions, searchQuery]);

  // Total unread messages count for sidebar/badge
  const totalUnreadCount = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.unreadCounts?.[currentUserId] || 0), 0);
  }, [sessions, currentUserId]);

  return (
    <div className="flex bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden h-[calc(100vh-130px)] max-w-7xl mx-auto relative select-none">
      
      {/* 1. CHATS SIDEBAR / LIST */}
      <div className={`w-full md:w-80 border-r border-slate-150 flex flex-col shrink-0 ${activeSession ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-blue-600" size={20} />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Messagerie</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
              title="Créer un groupe"
            >
              <Plus size={16} />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
              title="Paramètres de notification"
            >
              <Bell size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Search className="text-slate-400 shrink-0" size={14} />
            <input
              type="text"
              placeholder="Rechercher un chat ou message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full font-bold text-slate-700"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          
          {/* Create Group fast trigger */}
          {filteredSessions.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs font-semibold">
              Aucune conversation. Cliquez sur le <Plus className="inline mx-1 text-blue-600" size={14} /> en haut pour créer un groupe !
            </div>
          )}

          {filteredSessions.map((session) => {
            const isActive = activeSession?.id === session.id;
            const unreadCount = session.unreadCounts?.[currentUserId] || 0;
            
            // Resolve 1-to-1 direct message names & initial
            let displayName = session.name;
            let displayInitials = session.name.substring(0, 2).toUpperCase();

            if (!session.isGroup) {
              const otherUserId = session.participants.find(pId => pId !== currentUserId);
              const otherUser = teamMembers.find(m => (m.uid || m.id) === otherUserId);
              if (otherUser) {
                displayName = otherUser.name || displayName;
                displayInitials = (otherUser.name || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              }
            }

            return (
              <div
                key={session.id}
                onClick={() => setActiveSession(session)}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors relative ${isActive ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50/50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                  session.isGroup 
                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-black' 
                    : 'bg-emerald-100 border-emerald-200 text-emerald-700 font-extrabold'
                }`}>
                  {session.isGroup ? <Users size={16} /> : <span className="text-xs">{displayInitials}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 truncate block">{displayName}</span>
                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                      {session.lastMessage?.timestamp 
                        ? new Date(session.lastMessage.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) 
                        : ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-slate-500 font-bold truncate pr-3">
                      {session.lastMessage 
                        ? `${session.lastMessage.senderName}: ${session.lastMessage.text}` 
                        : 'Aucun message.'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 shrink-0 min-w-[16px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick Team Members Directory list */}
          {otherTeamMembers.length > 0 && (
            <div className="p-3 bg-slate-50">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Membres disponibles</span>
              <div className="flex gap-2 overflow-x-auto py-2 scrollbar-none">
                {otherTeamMembers.map(m => (
                  <button
                    key={m.uid || m.id}
                    onClick={() => handleOpenDirectChat(m)}
                    className="flex flex-col items-center gap-1 shrink-0 bg-white border border-slate-150 p-2 rounded-xl hover:border-blue-300 shadow-2xs cursor-pointer transition-all min-w-[70px]"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-black text-xs">
                      {(m.name || 'U')[0]}
                    </div>
                    <span className="text-[9px] font-black text-slate-700 truncate w-14 text-center">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 2. CHAT MESSAGES PANEL */}
      <div className={`flex-1 flex flex-col bg-slate-50/30 ${!activeSession ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {!activeSession ? (
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-md">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Aucune discussion active</h3>
            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
              Sélectionnez une discussion à gauche ou commencez un chat direct avec un membre de l'équipe pour collaborer en temps réel.
            </p>
          </div>
        ) : (
          <>
            {/* Active Chat Header */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm z-10 select-none">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveSession(null)}
                  className="p-1 text-slate-400 hover:text-slate-800 md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  activeSession.isGroup 
                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-black' 
                    : 'bg-emerald-100 border-emerald-200 text-emerald-700 font-black'
                }`}>
                  {activeSession.isGroup ? <Users size={16} /> : <span className="text-xs">
                    {activeSession.name.substring(0, 2).toUpperCase()}
                  </span>}
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 tracking-tight">{activeSession.name}</h3>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                    {activeSession.isGroup 
                      ? `${activeSession.participants.length} membres` 
                      : 'Discussion directe'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 cursor-not-allowed"><Phone size={14} /></button>
                <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 cursor-not-allowed"><Video size={14} /></button>
                <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 cursor-not-allowed"><MoreVertical size={14} /></button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 relative">
              {messages.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs font-bold italic">
                  Début de la conversation. Écrivez un message ou taguez un dossier pour commencer !
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const isSystem = msg.senderId === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center select-none">
                      <div className="bg-slate-200/60 border border-slate-300/30 text-[10px] text-slate-600 font-extrabold px-3 py-1 rounded-xl shadow-3xs max-w-sm text-center">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 shadow-md border ${
                      isMe 
                        ? 'bg-blue-600 border-blue-700 text-white rounded-br-none' 
                        : 'bg-white border-slate-100 text-slate-800 rounded-bl-none'
                    }`}>
                      {/* Name / Role for groups or others */}
                      {!isMe && (
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-black text-indigo-600">{msg.senderName}</span>
                          {msg.senderRole && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              {msg.senderRole === 'admin' ? 'Admin' : msg.senderRole === 'commercial' ? 'Commercial' : 'Stock'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Image attachments */}
                      {msg.imageUrl && (
                        <div className="mb-2 max-w-full rounded-xl overflow-hidden border border-slate-100/10">
                          <img src={msg.imageUrl} alt="Chat attachment" className="w-full max-h-60 object-contain rounded-xl bg-slate-900" />
                        </div>
                      )}

                      {/* Text content with Mention parser */}
                      <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">
                        {renderMessageContent(msg.text)}
                      </p>

                      {/* Timestamp & Status indicators */}
                      <div className="flex items-center justify-end gap-1 mt-1.5">
                        <span className={`text-[8px] font-bold ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck size={10} className="text-blue-100" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Mention Suggestions Popup */}
            {showMentionSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute bottom-[72px] left-4 right-4 bg-white border border-slate-150 rounded-2xl shadow-2xl z-30 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                <div className="p-2 bg-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Type de tag :</span>
                  <div className="flex gap-1">
                    {(['all', 'members', 'clients', 'vehicles', 'sales'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMentionCategory(cat)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          mentionCategory === cat 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {cat === 'all' ? 'Tout' : cat === 'members' ? 'Membres' : cat === 'clients' ? 'Clients' : cat === 'vehicles' ? 'Stocks' : 'Dossiers'}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredSuggestions.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => selectMentionSuggestion(item)}
                    className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors font-bold"
                  >
                    <div>
                      <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.type === 'member' ? 'bg-blue-500' : item.type === 'client' ? 'bg-purple-500' : item.type === 'vehicle' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        {item.title}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{item.subtitle}</div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 select-none">Entrée</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Image attachment Preview */}
            {selectedImageBase64 && (
              <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-150 overflow-hidden relative group">
                    <img src={selectedImageBase64} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setSelectedImageBase64(null)}
                      className="absolute inset-0 bg-red-600/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-xs"
                    >
                      Suppr.
                    </button>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Pièce jointe prête à l'envoi</span>
                    <span className="text-[10px] text-slate-400">Cliquez sur envoyer pour l'ajouter au message</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedImageBase64(null)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Message Chat Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 shrink-0 flex items-center gap-2 select-none relative z-10">
              {/* Attachment selector */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-500 hover:text-slate-700 rounded-xl cursor-pointer transition-all shrink-0"
                title="Ajouter une image"
              >
                <ImageIcon size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleSelectImage}
                className="hidden"
              />

              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Écrivez votre message... Utilisez @ pour taguer membres, clients, stocks, dossiers"
                  className="w-full bg-slate-50 border border-slate-150 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none max-h-24 font-bold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isUploadingImage || (!inputText.trim() && !selectedImageBase64)}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>

      {/* 3. NOTIFICATION SETTINGS MODAL */}
      {showSettings && (
        <div 
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden animate-scale-in"
          >
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">Paramètres du Chat</h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-white/80 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4 font-bold text-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black block">Sourdine générale</span>
                  <span className="text-[10px] text-slate-400 font-medium leading-normal">Désactiver toutes les alertes de chat</span>
                </div>
                <button
                  type="button"
                  onClick={() => saveNotifSettings({ ...notifSettings, muteAll: !notifSettings.muteAll })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifSettings.muteAll ? 'bg-red-500' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${notifSettings.muteAll ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <div>
                  <span className="text-xs font-black block">Sourdine des groupes</span>
                  <span className="text-[10px] text-slate-400 font-medium leading-normal">Muter uniquement les conversations de groupe</span>
                </div>
                <button
                  type="button"
                  onClick={() => saveNotifSettings({ ...notifSettings, muteGroups: !notifSettings.muteGroups })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifSettings.muteGroups ? 'bg-red-500' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${notifSettings.muteGroups ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <div>
                  <span className="text-xs font-black block">Alertes flottantes (Toasts)</span>
                  <span className="text-[10px] text-slate-400 font-medium leading-normal">Notifications en bas de l'écran lors d'un nouveau message</span>
                </div>
                <button
                  type="button"
                  onClick={() => saveNotifSettings({ ...notifSettings, showToasts: !notifSettings.showToasts })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifSettings.showToasts ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${notifSettings.showToasts ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <div>
                  <span className="text-xs font-black block">Sons de notification</span>
                  <span className="text-[10px] text-slate-400 font-medium leading-normal">Jouer un signal sonore à la réception</span>
                </div>
                <button
                  type="button"
                  onClick={() => saveNotifSettings({ ...notifSettings, playSounds: !notifSettings.playSounds })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifSettings.playSounds ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${notifSettings.playSounds ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div 
          onClick={() => setShowCreateGroup(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <form 
            onSubmit={handleCreateGroup}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden animate-scale-in"
          >
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">Créer un Groupe</h3>
              </div>
              <button type="button" onClick={() => setShowCreateGroup(false)} className="text-white/80 hover:text-white cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Nom du groupe</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Livraisons Urgentes, Staff Commercial"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5 select-none">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-1">Membres à inviter</label>
                <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 p-1 bg-slate-50/50">
                  {otherTeamMembers.map(m => {
                    const isSelected = selectedGroupMembers.includes(m.uid || m.id);
                    const toggleSelect = () => {
                      if (isSelected) {
                        setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== (m.uid || m.id)));
                      } else {
                        setSelectedGroupMembers([...selectedGroupMembers, m.uid || m.id]);
                      }
                    };

                    return (
                      <div 
                        key={m.uid || m.id}
                        onClick={toggleSelect}
                        className="p-2.5 flex items-center justify-between hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-black text-xs">
                            {(m.name || 'U')[0]}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-800 block">{m.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold capitalize">{m.role === 'admin' ? 'Administrateur' : m.role === 'commercial' ? 'Commercial' : 'Stock'}</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={10} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 select-none">
              <span className="text-[10px] text-slate-400 font-bold">{selectedGroupMembers.length} invités sélectionnés</span>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateGroup(false)}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer shadow-2xs"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={!groupName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Créer le groupe
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 5. GORGEOUS HOVER MENTION DETAIL CARD */}
      {hoveredTag && activeHoverDetails && (
        <div 
          className="fixed bg-white/95 border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 max-w-xs w-64 animate-fade-in pointer-events-none backdrop-blur-sm select-none"
          style={{
            top: hoveredTag.rect.bottom + 8 + window.scrollY,
            left: Math.min(window.innerWidth - 270, Math.max(10, hoveredTag.rect.left + window.scrollX - 50))
          }}
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
            <div className={`p-1.5 rounded-lg text-white font-black shrink-0 ${
              hoveredTag.type === 'member' ? 'bg-blue-600' : hoveredTag.type === 'client' ? 'bg-purple-600' : hoveredTag.type === 'vehicle' ? 'bg-amber-600' : 'bg-emerald-600'
            }`}>
              {hoveredTag.type === 'member' ? <User size={14} /> : hoveredTag.type === 'client' ? <Users size={14} /> : hoveredTag.type === 'vehicle' ? <Car size={14} /> : <FileText size={14} />}
            </div>
            <span className="text-xs font-black text-slate-800 truncate block">{activeHoverDetails.title}</span>
          </div>
          <div className="space-y-2">
            {activeHoverDetails.details.map((det, idx) => (
              <div key={idx}>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block">{det.label}</span>
                <span className="text-[11px] text-slate-700 font-bold block truncate leading-tight mt-0.5" title={det.value}>{det.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
