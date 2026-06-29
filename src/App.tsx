import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, CheckCircle2, LogOut, Users, Edit2, Check, KeyRound, LayoutDashboard, Car, ShieldCheck, Activity, Menu, X, Trash2, TrendingUp, Calendar as CalendarIcon, Clock, Search, Bell, ChevronDown, Globe, FileText, MessageSquare } from 'lucide-react';
import { AppProvider, useApp } from './lib/context';
import { auth, signOut, db, doc, setDoc, getUserDocPath, getUserPath, collection, onSnapshot } from './lib/firebase';
import { CustomLogo } from './components/CustomLogo';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { SaleDetail } from './components/SaleDetail';
import { PdfValidation } from './components/PdfValidation';
import { TeamManagement } from './components/TeamManagement';
import { SuperAdmin } from './components/SuperAdmin';
import { CompanyManagement } from './components/CompanyManagement';
import { AdminPerformanceDashboard } from './components/AdminPerformanceDashboard';
import { DeliveryCalendar } from './components/DeliveryCalendar';
import { ClientBooking } from './components/ClientBooking';
import { MyAccount } from './components/MyAccount';
import { NotificationsView, Notification } from './components/NotificationsView';
import { StockView } from './components/StockView';
import { ClientsView } from './components/ClientsView';
import { PdfTemplatesEditor } from './components/PdfTemplatesEditor';
import { ChatView } from './components/ChatView';
import { Sale } from './types';
import { checkAndSendDeliveryReminders } from './lib/notifications';
// PDF parsing logic pulled into helper to keep App clean
const processPDFFile = async (
  file: File, 
  sales: Sale[], 
  setDraftExtraction: (data: any) => void, 
  setCurrentView: (view: string) => void,
  showToast: (msg: string, type?: 'success'|'error') => void,
  setIsLoading: (val: boolean) => void,
  userProfile?: any
) => {
  setIsLoading(true);
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
    }

    const company = fullText.includes('DJ CAR') ? 'DJ CAR' : 'KDB AUTO';
    const extractedBdc = (fullText.match(/BON DE COMMANDE N°\s*(\d+)/i) || [])[1] || '';
    const finalBdc = extractedBdc || file.name.match(/\d{3,5}/)?.[0] || '';

    const dateMatch = fullText.match(/Le\s*(\d{2}\/\d{2}\/\d{4})/i);
    let dateFormatted = new Date().toISOString().split('T')[0];
    if (dateMatch) { const parts = dateMatch[1].split('/'); dateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`; }

    // Enhanced Client Name Extraction (including fallbacks)
    let clientMatch = (fullText.match(/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÀ-Ÿa-zÀ-ÿ\s-]+?)(?=\s+\d+|\s+Adresse|\s+T[ée]l|\s+Email|\s+Courriel|\s+BON|\s+Le|$)/i) || [])[1] || '';
    if (!clientMatch) {
      const altClientMatch = fullText.match(/(?:Client|Acheteur|Nom de l'acheteur|Nom)\s*[:\s]+([A-ZÀ-Ÿa-zÀ-ÿ\s-]+?)(?=\s+\d+|\s+Adresse|\s+T[ée]l|\s+Email|\s+Courriel|\s+BON|\s+Le|$)/i);
      if (altClientMatch) {
        clientMatch = altClientMatch[1];
      }
    }
    let nameParts = clientMatch.trim().split(/\s+/);
    if (nameParts.length > 4) nameParts = nameParts.slice(0, 4); 
    let clientName = [...new Set(nameParts)].join(' ').replace(/[-_]$/, '').trim() || 'Client inconnu';

    // Direct Extraction of Email & Phone
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const allEmails = fullText.match(emailRegex) || [];
    let email = '';
    if (allEmails.length > 0) {
      // Filter out emails containing company names or generic role-based mailboxes
      const companyKeywords = ['kdb', 'djcar', 'dj-car', 'contact@', 'sales@', 'admin@', 'direction@', 'facturation@', 'info@', 'commercial@', 'support@', 'noreply@', 'no-reply@', 'billing@', 'garage@'];
      const clientEmails = allEmails.filter(e => {
        const lowerEmail = e.toLowerCase();
        return !companyKeywords.some(kw => lowerEmail.includes(kw));
      });
      // Fallback to the first available email if all of them are company emails
      email = clientEmails.length > 0 ? clientEmails[0].trim() : allEmails[0].trim();
    }

    const phoneRegex = /(?:tél|téléphone|port|portable|gsm|tel)\s*[:\s.-]*(\+?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/i;
    const phoneRegexAlt = /(?:\D|^)(0[1-9](?:[\s.-]?\d{2}){4})(?:\D|$)/;
    const phoneMatch = fullText.match(phoneRegex) || fullText.match(phoneRegexAlt);
    const phone = phoneMatch ? phoneMatch[1].replace(/[^0-9+]/g, '').trim() : '';

    // Extraction de l'adresse, du code postal et de la ville
    const addressRegex = /(?:adresse|demeurant|résidant|domicilié)\s*[:\s]+([A-Za-z0-9À-ÿ\s,'.()-]{5,150})(?=\s*(?:tél|téléphone|port|portable|gsm|email|courriel|bon|le|date|n°|$))/i;
    const addressMatch = fullText.match(addressRegex);
    let address = addressMatch ? addressMatch[1].trim() : '';

    let zipCode = '';
    let city = '';

    if (address) {
      const zipInAddress = address.match(/\b(\d{5})\b/);
      if (zipInAddress) {
        zipCode = zipInAddress[1];
        const zipIdx = address.indexOf(zipCode);
        const beforeZip = address.substring(0, zipIdx).trim().replace(/,$/, '').trim();
        const afterZip = address.substring(zipIdx + 5).trim();
        const cityParts = afterZip.match(/^([A-Za-zÀ-ÿ\s-]+)/);
        if (cityParts) {
          city = cityParts[1].trim();
        }
        if (beforeZip.length > 3) {
          address = beforeZip;
        }
      }
    } else {
      const fallbackZipRegex = /\b((?:0[1-9]|[1-8]\d|9[0-5]|97[1-8]|98[4-9])\d{3})\b\s*([A-ZÀ-ÿ][A-ZÀ-ÿa-zÀ-ÿ\s-]+)/;
      const fallbackZipMatch = fullText.match(fallbackZipRegex);
      if (fallbackZipMatch) {
        zipCode = fallbackZipMatch[1];
        city = fallbackZipMatch[2].trim().split(/\s{2,}/)[0];
      }
    }

    const marque = (fullText.match(/Marque[\s",:]+(?:Marque[\s",:]+)?([A-Z]+)/i) || [])[1]?.trim() || '';
    const modele = (fullText.match(/Modèle[\s",:]+(?:Modèle[\s",:]+)?([A-Z\s0-9.-]+?)(?=\s*Version|\s*M\.E\.C|\s*Km|\s*Couleur|")/i) || [])[1]?.trim() || '';
    const color = (fullText.match(/Couleur[\s",:]+(?:Couleur[\s",:]+)?([A-Z\s]+?)(?=\s*Puiss|\s*1ère|\s*Immat|")/i) || [])[1]?.trim() || '';
    const plaque = (fullText.match(/Immat\.?[\s",:]+(?:Immat\.?[\s",:]+)?([A-Z0-9-]{7,9})/i) || [])[1] || '';
    const vin = (fullText.match(/VIN[\s",:]+(?:VIN[\s",:]+)?([A-Z0-9]{17})/i) || [])[1] || '';
    const mec = (fullText.match(/M\.E\.C\.?\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || '';

    // Robust Vehicle Price Extraction with Cascading Fallbacks
    let price = 0;
    const htExactMatch = fullText.match(/Total HT du v[ée]hicule\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i);
    const fallbackPriceMatch = 
      fullText.match(/Prix de vente\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Prix TTC\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Total TTC\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Net [aà] payer\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Prix du v[ée]hicule\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i) ||
      fullText.match(/Montant total\s*["':,\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)/i);

    const priceString = htExactMatch ? htExactMatch[1] : (fallbackPriceMatch ? fallbackPriceMatch[1] : '');
    if (priceString) {
      price = parseFloat(priceString.replace(/[\s\u00A0]/g, '').replace(',', '.'));
    }

    // Payment Extraction
    let extractedAcomptes = [...fullText.matchAll(/ACOMPTE N[°º]?\s*\d+(.*?)(?=ACOMPTE N[°º]?\s*\d+|Reste à payer|Solde|Total|$)/gi)].map((block, index) => {
      const amount = parseFloat((block[1].match(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/) || [])[1]?.replace(/[\s\u00A0]/g, '').replace(',', '.') || '0');
      let type = 'VIR';
      const tUp = block[1].toUpperCase();
      if (tUp.includes('ESPÈCE') || tUp.includes('ESP')) type = 'ESP';
      if (tUp.includes('CHÈQUE') || tUp.includes('CHQ')) type = 'CHQ';
      let bank = block[1].replace(/(\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s*€/g, '').replace(/Virement|Espèces?|Chèque|Banque\s*:?/ig, '').replace(/[-_:,"]/g, ' ').trim().replace(/\s{2,}/g, ' ');
      return { id: `draft-pay-${index}`, amount, type, payer: bank ? `${clientName} (${bank.substring(0,20)})` : clientName, selected: true };
    }).filter(p => p.amount > 0); 

    if (extractedAcomptes.length === 0) {
      const singleAcompteMatch = fullText.match(/(?:Acompte|Règlement|Paiement)\s*[:\s]*(\d{1,3}(?:[\s\u00A0]\d{3})*(?:[.,]\d{2})?)\s*€/i);
      if (singleAcompteMatch) {
        const amt = parseFloat(singleAcompteMatch[1].replace(/[\s\u00A0]/g, '').replace(',', '.'));
        if (amt > 0) {
          extractedAcomptes.push({
            id: `draft-pay-0`,
            amount: amt,
            type: fullText.toUpperCase().includes('CHQ') || fullText.toUpperCase().includes('CHÈQUE') ? 'CHQ' : fullText.toUpperCase().includes('ESP') || fullText.toUpperCase().includes('ESPÈCE') ? 'ESP' : 'VIR',
            payer: clientName,
            selected: true
          });
        }
      }
    }

    const existingSale = sales.find(s => s.company === company && String(s.bdcNumber) === finalBdc && finalBdc !== '');

    setDraftExtraction({
      isManual: false, 
      id: null, 
      bdcNumber: finalBdc, 
      company, 
      clientName, 
      marque, modele, color, vin, plaque, mec,
      price: price ? price.toString() : (existingSale ? existingSale.price.toString() : ''), 
      date: dateFormatted, 
      commercial: existingSale ? (existingSale.commercial || 'À assigner') : (userProfile?.name || 'À assigner'), 
      phone: phone || (existingSale ? (existingSale.phone || '') : ''), 
      email: email || (existingSale ? (existingSale.email || '') : ''), 
      ref: existingSale ? (existingSale.ref || '') : '', 
      address: address || (existingSale ? ((existingSale as any).address || '') : ''),
      zipCode: zipCode || (existingSale ? ((existingSale as any).zipCode || '') : ''),
      city: city || (existingSale ? ((existingSale as any).city || '') : ''),
      draftPayments: extractedAcomptes
    });
    setCurrentView('pdf_validation');
  } catch (error) { 
    showToast("Erreur d'analyse PDF. Vérifiez le format.", "error"); 
  } finally { 
    setIsLoading(false); 
  }
};

const MainAppContent: React.FC = () => {
  const { 
    userAuth, userProfile, isDbLoading, sales, teamMembers, payments, databaseUid,
    vehicles, clients, setSelectedClientId, setSelectedVehicleId 
  } = useApp();
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [draftExtraction, setDraftExtraction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminPath, setIsAdminPath] = useState(window.location.pathname === '/salesadmin');

  // Sidebar drag & drop ordering state
  const [sidebarOrder, setSidebarOrder] = useState<string[]>([
    'dashboard', 'delivery_calendar', 'stock', 'clients', 'chat', 'perf_dashboard'
  ]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Load custom sidebar order on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_custom_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        const validDefault = ['dashboard', 'delivery_calendar', 'stock', 'clients', 'chat', 'perf_dashboard'];
        const filtered = parsed.filter(id => validDefault.includes(id));
        const missing = validDefault.filter(id => !filtered.includes(id));
        setSidebarOrder([...filtered, ...missing]);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const newOrder = [...sidebarOrder];
    const draggedItem = newOrder[draggedIdx];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, draggedItem);
    setDraggedIdx(idx);
    setSidebarOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    localStorage.setItem('sidebar_custom_order', JSON.stringify(sidebarOrder));
  };

  // Header Global Search results computation
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const headerSearchResults = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return null;

    const results = {
      sales: [] as typeof sales,
      vehicles: [] as typeof vehicles,
      clients: [] as typeof clients,
      deliveries: [] as typeof sales
    };

    sales.forEach(s => {
      const match = 
        s.clientName?.toLowerCase().includes(q) ||
        s.marque?.toLowerCase().includes(q) ||
        s.modele?.toLowerCase().includes(q) ||
        s.plaque?.toLowerCase().includes(q) ||
        s.vin?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.commercial?.toLowerCase().includes(q) ||
        s.ref?.toLowerCase().includes(q);

      if (match) {
        if (s.deliveryDate && s.deliveryStatus === 'programmee') {
          results.deliveries.push(s);
        } else {
          results.sales.push(s);
        }
      }
    });

    vehicles.forEach(v => {
      const match = 
        v.marque?.toLowerCase().includes(q) ||
        v.modele?.toLowerCase().includes(q) ||
        v.plaque?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q) ||
        v.status?.toLowerCase().includes(q);
      
      if (match) {
        results.vehicles.push(v);
      }
    });

    clients.forEach(c => {
      const match = 
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q);

      if (match) {
        results.clients.push(c);
      }
    });

    return results;
  }, [headerSearchQuery, sales, vehicles, clients]);

  // Floating Chat message notification toasts & Dual-tone Synthesizer Audio chime
  const [chatToasts, setChatToasts] = useState<Array<{ id: string, senderName: string, text: string, sessionName: string, sessionId: string }>>([]);
  const lastMsgTimestampRef = useRef<Record<string, string>>({});
  const isInitialLoadRef = useRef(true);

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.35);
      }, 120);
    } catch (e) {
      console.warn("Audio Context blocked or failed:", e);
    }
  };

  useEffect(() => {
    if (!databaseUid || !userAuth?.uid) return;

    const currentUserId = userAuth.uid;
    const colRef = collection(db, getUserPath('chats', databaseUid));
    
    const unsub = onSnapshot(colRef, (snapshot) => {
      const isInitial = isInitialLoadRef.current;
      
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const sessionId = change.doc.id;
        const lastMessage = data.lastMessage;

        if (lastMessage && lastMessage.senderId !== currentUserId) {
          const storedTime = lastMsgTimestampRef.current[sessionId];
          const newTime = lastMessage.timestamp;

          if (newTime && storedTime !== newTime) {
            lastMsgTimestampRef.current[sessionId] = newTime;

            if (!isInitial) {
              const msgAge = Date.now() - new Date(newTime).getTime();
              if (msgAge < 15000 && currentView !== 'chat') {
                let showToasts = true;
                let playSounds = true;
                const storedSettings = localStorage.getItem(`chat_notif_settings_${currentUserId}`);
                if (storedSettings) {
                  try {
                    const settings = JSON.parse(storedSettings);
                    if (settings.muteAll) {
                      showToasts = false;
                      playSounds = false;
                    } else if (settings.muteGroups && data.isGroup) {
                      showToasts = false;
                      playSounds = false;
                    } else {
                      showToasts = settings.showToasts !== false;
                      playSounds = settings.playSounds !== false;
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }

                if (playSounds) {
                  playChime();
                }

                if (showToasts) {
                  const toastId = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                  setChatToasts(prev => [
                    ...prev,
                    {
                      id: toastId,
                      senderName: lastMessage.senderName,
                      text: lastMessage.text,
                      sessionName: data.name,
                      sessionId
                    }
                  ]);
                  setTimeout(() => {
                    setChatToasts(prev => prev.filter(t => t.id !== toastId));
                  }, 5000);
                }
              }
            }
          }
        }
      });
      
      isInitialLoadRef.current = false;
    });

    return () => unsub();
  }, [databaseUid, userAuth?.uid, currentView]);

  // Trigger 24h pre-delivery reminders check
  useEffect(() => {
    if (sales && sales.length > 0 && teamMembers && teamMembers.length > 0 && databaseUid) {
      checkAndSendDeliveryReminders(sales, teamMembers, databaseUid);
    }
  }, [sales, teamMembers, databaseUid]);

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showManageCompanies, setShowManageCompanies] = useState(false);

  const generateNextBdcNumber = (): string => {
    const numbers = sales
      .map(s => {
        const cleaned = String(s.bdcNumber || '').replace(/\D/g, '');
        return parseInt(cleaned);
      })
      .filter(n => !isNaN(n) && n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 6000;
    return String(maxNum + 1);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState({ code: 'fr', name: 'French', flag: '🇫🇷' });
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userAuth?.uid) {
      setNotifications([]);
      return;
    }
    const pathNotifs = getUserPath('notifications', userAuth.uid);
    const unsubNotifs = onSnapshot(collection(db, pathNotifs), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      // Sort: newest first
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setNotifications(list);
    }, (error) => {
      console.error("Error loading notifications:", error);
    });

    return () => unsubNotifs();
  }, [userAuth]);

  const handleMarkAsRead = async (id: string) => {
    if (!userAuth?.uid) return;
    try {
      await setDoc(doc(db, getUserPath('notifications', userAuth.uid), id), { read: true }, { merge: true });
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userAuth?.uid) return;
    try {
      const promises = notifications.filter(n => !n.read).map(n => 
        setDoc(doc(db, getUserPath('notifications', userAuth.uid), n.id), { read: true }, { merge: true })
      );
      await Promise.all(promises);
    } catch (e) {
      console.error("Failed to mark all notifications as read:", e);
    }
  };

  const currentCompanyDetails = userProfile?.companiesDetails?.find(
    c => c.name.toUpperCase() === userProfile?.companyId?.toUpperCase()
  );
  const companyLogo = currentCompanyDetails?.logoUrl;

  useEffect(() => {
    if (userProfile?.companyId) {
      setNewCompanyName(userProfile.companyId);
    }
  }, [userProfile?.companyId]);

  useEffect(() => {
    const handleLocationChange = () => setIsAdminPath(window.location.pathname === '/salesadmin');
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Synchronise state with window.location.hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#detail/')) {
        const id = hash.replace('#detail/', '');
        setSelectedSaleId(id);
        setCurrentView('detail');
      } else if (hash === '#pdf_validation') {
        setCurrentView('pdf_validation');
      } else if (hash.startsWith('#delivery_calendar')) {
        setCurrentView('delivery_calendar');
      } else if (hash === '#team_management') {
        setCurrentView('team_management');
      } else if (hash === '#company_management') {
        if (userProfile?.role === 'admin') {
          setCurrentView('company_management');
        } else {
          window.location.hash = 'dashboard';
        }
      } else if (hash === '#perf_dashboard') {
        if (userProfile?.role === 'admin') {
          setCurrentView('perf_dashboard');
        } else {
          window.location.hash = 'dashboard';
        }
      } else if (hash === '#my_account') {
        setCurrentView('my_account');
      } else if (hash === '#pdf_templates') {
        setCurrentView('pdf_templates');
      } else if (hash === '#notifications') {
        setCurrentView('notifications');
      } else if (hash === '#stock') {
        setCurrentView('stock');
      } else if (hash === '#clients') {
        setCurrentView('clients');
      } else {
        setSelectedSaleId(null);
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Initial sync
    if (window.location.hash) {
      handleHashChange();
    } else if (userProfile) {
      if (userProfile.role === 'admin') {
        window.location.hash = 'perf_dashboard';
      } else if (userProfile.role === 'park_manager') {
        window.location.hash = 'delivery_calendar';
      } else {
        window.location.hash = 'dashboard';
      }
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [userProfile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 4000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), duration);
  };

  const handleRenameCompany = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCompanyName.trim() || newCompanyName.trim() === userProfile?.companyId) {
      setIsEditingCompany(false);
      return;
    }
    try {
      setIsLoading(true);
      const newName = newCompanyName.trim();
      const promises = teamMembers.flatMap(member => [
        fetch(`/api/users/${member.uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: newName })
        }),
        setDoc(doc(db, getUserDocPath(member.uid)), { companyId: newName }, { merge: true })
      ]);
      // Ensure current user is updated in the API
      if (userAuth?.uid) {
        promises.push(
          fetch(`/api/users/${userAuth.uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: newName })
          })
        );
        // Also update local canvas document directly so frontend reads it properly on load
        const updatedProfile = { 
          ...userProfile, 
          companyId: newName,
          uid: userAuth.uid,
          email: userAuth.email || '',
          name: userProfile?.name || userAuth.email?.split('@')[0] || 'Utilisateur',
          role: userProfile?.role || 'admin'
        };
        promises.push(
          setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true })
        );
      }
      
      await Promise.all(promises);
      showToast("Nom de l'entreprise mis à jour", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast("Erreur lors de la mise à jour", "error");
    } finally {
      setIsLoading(false);
      setIsEditingCompany(false);
    }
  };

  // ----- Admin Route Handler -----
  if (isAdminPath) {
    if (!showSuperAdmin) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-xl w-full max-w-sm text-center shadow-xl">
            <h2 className="text-white text-xl font-bold mb-6">Accès Super Admin</h2>
            <input 
              type="password" 
              placeholder="Mot de passe"
              className="w-full bg-slate-700 text-white border-0 rounded-lg py-2 px-3 mb-4 focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (adminPassword === 'SalesDygital#321321') {
                    setShowSuperAdmin(true);
                  } else {
                    alert('Mot de passe incorrect');
                  }
                }
              }}
            />
            <button 
              onClick={() => {
                if (adminPassword === 'SalesDygital#321321') {
                  setShowSuperAdmin(true);
                } else {
                  alert('Mot de passe incorrect');
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-md"
            >
              Valider
            </button>
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/');
                setIsAdminPath(false);
              }}
              className="mt-4 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }
    
    return <SuperAdmin onClose={() => { setShowSuperAdmin(false); window.history.pushState({}, '', '/'); setIsAdminPath(false); }} onShowToast={showToast} />;
  }
  // -------------------------------

  const handleLogout = async () => {
    try { await signOut(auth); } catch (err) {}
  };

  if (!userAuth) {
    return (
      <>
        <Login onShowToast={showToast} />
        {toast.show && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 z-50 text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <CheckCircle2 size={20} />{toast.message}
          </div>
        )}
      </>
    );
  }



  const totalPortfolio = sales.reduce((sum, s) => {
    const salePayments = (payments || []).filter(p => p.saleId === s.id);
    const paidAmount = salePayments.reduce((tot, p) => tot + p.amount, 0);
    const remaining = Math.max(0, s.price - paidAmount);
    return sum + remaining;
  }, 0);

  const handleUserChangeName = async () => {
    if (!userProfile?.uid || !userAuth?.uid) return;
    const newName = window.prompt("Saisir votre nouveau nom d'utilisateur :", userProfile.name);
    if (newName && newName.trim()) {
      try {
        setIsLoading(true);
        const trimmedName = newName.trim();
        const updatedProfile = { 
          ...userProfile, 
          name: trimmedName,
          uid: userAuth.uid,
          email: userAuth.email || '',
          role: userProfile?.role || 'commercial',
          companyId: userProfile?.companyId || 'Entreprise'
        };
        await setDoc(doc(db, getUserDocPath(userAuth.uid)), updatedProfile, { merge: true });
        showToast("Nom d'utilisateur mis à jour avec succès.", "success");
        setTimeout(() => window.location.reload(), 500);
      } catch (e) {
        showToast("Erreur lors de la mise à jour du nom.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUserChangePassword = async () => {
    if (!userProfile?.uid) return;
    const newPass = window.prompt("Saisir votre nouveau mot de passe (Minimum 6 caractères) :");
    if (newPass) {
      if (newPass.length < 6) {
        alert("Le mot de passe doit comporter au moins 6 caractères.");
        return;
      }
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userProfile.uid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPass })
        });
        if (response.ok) {
          showToast("Votre mot de passe a été modifié avec succès.", "success");
        } else {
          const err = await response.json();
          showToast(`Erreur : ${err.error || "Mise à jour échouée."}`, "error");
        }
      } catch (e) {
        showToast("Erreur réseau.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative flex overflow-hidden h-screen">
      {toast.show && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 z-50 text-white animate-fade-in-up ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <CheckCircle2 size={20} />{toast.message}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
            <div className="bg-purple-100 p-4 rounded-full mb-4"><Loader2 className="animate-spin text-purple-600" size={40} /></div>
            <p className="text-slate-800 font-black text-xl text-center">Traitement en cours...</p>
            <p className="text-slate-500 text-sm mt-2 text-center">Opération sécurisée en cours.</p>
          </div>
        </div>
      )}

      {/* NEW NARROW SIDEBAR (ERP RAIL LAYOUT) */}
      <aside className="w-16 md:w-20 bg-slate-950 border-r border-slate-900 flex flex-col items-center py-6 justify-between text-white shrink-0 select-none z-30 shadow-2xl">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo brand */}
          <div className="flex items-center justify-center cursor-pointer group" onClick={() => { window.location.hash = 'dashboard'; }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-blue-900/40 overflow-hidden ring-1 ring-white/10 relative transform group-hover:scale-105 transition-all">
              <CustomLogo className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>

          <div className="h-px w-8 bg-slate-800"></div>

          {/* Navigation Links with Drag-and-Drop Reordering */}
          <nav className="flex flex-col gap-3.5 w-full px-2">
            {sidebarOrder.map((id, index) => {
              if (id === 'perf_dashboard' && userProfile?.role !== 'admin') return null;

              let IconComp = LayoutDashboard;
              let label = 'Ventes';
              let tooltip = 'Bons de commande';
              let hashValue = 'dashboard';
              let activeColor = 'bg-blue-600 text-white shadow-lg shadow-blue-600/20';

              if (id === 'dashboard') {
                IconComp = LayoutDashboard;
                label = 'Ventes';
                tooltip = 'Tableau de bord';
                hashValue = 'dashboard';
              } else if (id === 'delivery_calendar') {
                IconComp = CalendarIcon;
                label = 'Agenda';
                tooltip = 'Calendrier des sorties';
                hashValue = 'delivery_calendar';
              } else if (id === 'stock') {
                IconComp = Car;
                label = 'Stock';
                tooltip = 'Stock Véhicules';
                hashValue = 'stock';
              } else if (id === 'clients') {
                IconComp = Users;
                label = 'Clients';
                tooltip = 'Annuaire Clients';
                hashValue = 'clients';
              } else if (id === 'chat') {
                IconComp = MessageSquare;
                label = 'Chat';
                tooltip = 'Messagerie';
                hashValue = 'chat';
              } else if (id === 'perf_dashboard') {
                IconComp = TrendingUp;
                label = 'Stats';
                tooltip = 'Performances';
                hashValue = 'perf_dashboard';
                activeColor = 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20';
              }

              const isActive = currentView === id;

              return (
                <button 
                  key={id}
                  draggable="true"
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => { window.location.hash = hashValue; }}
                  className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 w-full transition-all group relative cursor-grab active:cursor-grabbing ${
                    isActive 
                      ? activeColor 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                  }`}
                  title={tooltip}
                >
                  <IconComp size={18} />
                  <span className="text-[9px] font-black tracking-tight block md:hidden lg:block">
                    {label}
                  </span>
                  
                  {/* Tooltip for desktop */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {tooltip}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom part of sidebar is now empty as logout is handled via the profile menu */}
      </aside>

      {/* MAIN CONTAINER next to Sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* UPPER MAIN HEADER */}
        <header className="h-20 bg-white border-b border-slate-100/90 flex items-center justify-between px-8 shrink-0 z-20 relative select-none">
          {/* Left: Breadcrumbs & Company Renamer */}
          <div className="flex items-center space-x-6">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <span>Sales Dygital</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-600 font-black">
                  {currentView === 'dashboard' ? 'Bons de commande' : currentView === 'detail' ? 'Détails du dossier' : currentView === 'delivery_calendar' ? 'Calendrier des sorties' : currentView === 'my_account' ? 'Mon Compte' : currentView === 'pdf_templates' ? 'Éditer modèles PDF' : currentView === 'notifications' ? 'Notifications' : currentView === 'clients' ? 'Clients' : currentView === 'perf_dashboard' ? 'Statistiques' : currentView === 'stock' ? 'Stock' : currentView === 'team_management' ? 'Équipe' : currentView === 'company_management' ? 'Gestion Entreprise' : 'Validation' }
                </span>
              </div>
              <div className="flex items-center gap-2 group mt-0.5">
                <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center border border-slate-200 text-[10px] font-black text-slate-600 overflow-hidden shrink-0">
                  {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    userProfile?.companyId?.charAt(0) || 'E'
                  )}
                </div>
                {isEditingCompany && userProfile?.role === 'admin' ? (
                  <form onSubmit={handleRenameCompany} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="bg-slate-100 text-slate-800 border border-slate-300 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500 font-bold max-w-[150px]"
                      autoFocus
                      onBlur={handleRenameCompany}
                    />
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-700">
                      {userProfile?.companyId || 'Entreprise'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Vertical divider */}
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

            {/* Search Input inspired by DashStack UI Kit */}
            <div className="relative hidden md:block w-72 lg:w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={headerSearchQuery}
                onChange={(e) => {
                  setHeaderSearchQuery(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100/50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600/80 rounded-full text-xs font-semibold transition-all"
                placeholder="Dossier, véhicule, client, livraison..."
              />
              {headerSearchQuery && (
                <button
                  onClick={() => {
                    setHeaderSearchQuery('');
                    setSearchQuery('');
                  }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Global search dropdown */}
              {headerSearchQuery && headerSearchResults && (
                <>
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setHeaderSearchQuery('')} />
                  <div className="absolute left-0 mt-2 w-[340px] md:w-[420px] lg:w-[480px] max-h-[480px] bg-white border border-slate-150 shadow-2xl rounded-2xl p-4 overflow-y-auto z-50 animate-fade-in text-slate-800 flex flex-col gap-3.5">
                    {/* No results message */}
                    {headerSearchResults.sales.length === 0 &&
                     headerSearchResults.vehicles.length === 0 &&
                     headerSearchResults.clients.length === 0 &&
                     headerSearchResults.deliveries.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs font-bold">
                        Aucun résultat pour "{headerSearchQuery}"
                      </div>
                    )}

                    {/* 1. Dossiers / Bons de commande */}
                    {headerSearchResults.sales.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
                          <span>📁</span> Bons de commande ({headerSearchResults.sales.length})
                        </p>
                        <div className="flex flex-col gap-1">
                          {headerSearchResults.sales.slice(0, 4).map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setHeaderSearchQuery('');
                                window.location.hash = `detail/${s.id}`;
                              }}
                              className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-100 transition-all text-xs font-semibold text-slate-700"
                            >
                              <div className="truncate pr-2">
                                <p className="font-bold text-slate-800 truncate">{s.clientName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{s.marque} {s.modele} • {s.plaque || 'Sans plaque'}</p>
                              </div>
                              <span className="shrink-0 text-[10px] bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-md">
                                N° {s.bdcNumber}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Stock Véhicules */}
                    {headerSearchResults.vehicles.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
                          <span>🚗</span> Véhicules en Stock ({headerSearchResults.vehicles.length})
                        </p>
                        <div className="flex flex-col gap-1">
                          {headerSearchResults.vehicles.slice(0, 4).map(v => (
                            <div
                              key={v.id}
                              onClick={() => {
                                setHeaderSearchQuery('');
                                setSelectedVehicleId(v.id);
                                window.location.hash = 'stock';
                              }}
                              className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-100 transition-all text-xs font-semibold text-slate-700"
                            >
                              <div className="truncate pr-2">
                                <p className="font-bold text-slate-800 truncate">{v.marque} {v.modele}</p>
                                <p className="text-[10px] text-slate-400 truncate">{v.immatriculation || 'Pas d\'immat'} • VIN: {v.vin || 'Pas de VIN'}</p>
                              </div>
                              <span className="shrink-0 text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600">
                                {v.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Clients */}
                    {headerSearchResults.clients.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
                          <span>👥</span> Clients ({headerSearchResults.clients.length})
                        </p>
                        <div className="flex flex-col gap-1">
                          {headerSearchResults.clients.slice(0, 4).map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setHeaderSearchQuery('');
                                setSelectedClientId(c.id);
                                window.location.hash = 'clients';
                              }}
                              className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-100 transition-all text-xs font-semibold text-slate-700"
                            >
                              <div className="truncate pr-2">
                                <p className="font-bold text-slate-800 truncate">{c.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{c.phone || 'Pas de tel'} • {c.email || 'Pas d\'email'}</p>
                              </div>
                              <span className="shrink-0 text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-0.5 rounded-md uppercase">
                                {c.type === 'client' ? 'Client' : 'Intermédiaire'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Livraisons */}
                    {headerSearchResults.deliveries.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
                          <span>📅</span> Livraisons Planifiées ({headerSearchResults.deliveries.length})
                        </p>
                        <div className="flex flex-col gap-1">
                          {headerSearchResults.deliveries.slice(0, 4).map(d => (
                            <div
                              key={d.id}
                              onClick={() => {
                                setHeaderSearchQuery('');
                                window.location.hash = 'delivery_calendar';
                              }}
                              className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-100 transition-all text-xs font-semibold text-slate-700"
                            >
                              <div className="truncate pr-2">
                                <p className="font-bold text-slate-800 truncate">{d.clientName}</p>
                                <p className="text-[10px] text-slate-400 truncate">Date: {d.deliveryDate} • {d.marque} {d.modele}</p>
                              </div>
                              <span className="shrink-0 text-[10px] bg-purple-50 text-purple-600 font-black px-2 py-0.5 rounded-md">
                                {d.deliverySlot || 'Journée'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right actions, Notifications, Language, and Profile in DashStack style */}
          <div className="flex items-center gap-6">

            {/* Notification Bell with red badge */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  setShowLanguageDropdown(false);
                  setShowProfileMenu(false);
                }}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer relative ${
                  showNotificationsDropdown 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Notifications"
              >
                <Bell size={18} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown menu */}
              {showNotificationsDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotificationsDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 shadow-2xl rounded-2xl p-4 z-50 text-xs text-slate-700 flex flex-col gap-3 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-800 text-sm">Notifications</span>
                      {notifications.filter(n => !n.read).length > 0 ? (
                        <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {notifications.filter(n => !n.read).length} nouvelles
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold">Aucune nouvelle</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            // Mark as read
                            handleMarkAsRead(notif.id);
                            setShowNotificationsDropdown(false);
                            if (notif.targetHash) {
                              window.location.hash = notif.targetHash;
                            }
                          }}
                          className={`p-2 hover:bg-slate-50 rounded-xl flex gap-2.5 items-start transition-all cursor-pointer relative ${
                            !notif.read ? 'bg-blue-50/20' : ''
                          }`}
                        >
                          <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            !notif.read ? 'bg-blue-600' : 'bg-slate-200'
                          }`}></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">{notif.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{notif.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setShowNotificationsDropdown(false);
                        window.location.hash = 'notifications';
                      }}
                      className="w-full text-center py-2.5 border-t border-slate-100 text-xs font-black text-blue-600 hover:text-blue-700 transition-all cursor-pointer mt-1 block"
                    >
                      Voir toutes les notifications
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Language Dropdown inspired by DashStack */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowLanguageDropdown(!showLanguageDropdown);
                  setShowNotificationsDropdown(false);
                  setShowProfileMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
              >
                <span>{currentLanguage.flag}</span>
                <span className="hidden sm:inline">{currentLanguage.name}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Languages Dropdown menu */}
              {showLanguageDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLanguageDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 shadow-xl rounded-2xl p-2 z-50 text-xs text-slate-700 flex flex-col gap-1 animate-fade-in">
                    <p className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select Language</p>
                    
                    {/* English (greyed out) */}
                    <div
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-400 opacity-60 rounded-lg text-left font-medium w-full select-none cursor-not-allowed"
                      title="Bientôt disponible"
                    >
                      <span>🇬🇧</span>
                      <span>English</span>
                      <span className="ml-auto text-[9px] font-bold bg-slate-100 text-slate-400 px-1 py-0.5 rounded uppercase">Bientôt</span>
                    </div>

                    {/* French (active) */}
                    <button
                      onClick={() => {
                        setCurrentLanguage({ code: 'fr', name: 'French', flag: '🇫🇷' });
                        setShowLanguageDropdown(false);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg text-left font-bold text-slate-700 w-full"
                    >
                      <span>🇫🇷</span>
                      <span>French</span>
                      {currentLanguage.code === 'fr' && <Check size={12} className="ml-auto text-blue-600" />}
                    </button>

                    {/* Spanish (greyed out) */}
                    <div
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-400 opacity-60 rounded-lg text-left font-medium w-full select-none cursor-not-allowed"
                      title="Bientôt disponible"
                    >
                      <span>🇪🇸</span>
                      <span>Spanish</span>
                      <span className="ml-auto text-[9px] font-bold bg-slate-100 text-slate-400 px-1 py-0.5 rounded uppercase">Bientôt</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Avatar & User Details dropdown trigger */}
            {userProfile && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfileMenu(!showProfileMenu);
                    setShowLanguageDropdown(false);
                    setShowNotificationsDropdown(false);
                  }}
                  className="flex items-center gap-3 text-left focus:outline-none cursor-pointer group"
                >
                  {userProfile.avatarUrl ? (
                    userProfile.avatarUrl.startsWith('data:image') ? (
                      <img 
                        src={userProfile.avatarUrl} 
                        alt="Profile Avatar" 
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm group-hover:ring-2 group-hover:ring-blue-100 transition-all"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-100 border border-slate-200 shadow-sm group-hover:ring-2 group-hover:ring-blue-100 transition-all">
                        {userProfile.avatarUrl}
                      </div>
                    )
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center font-black text-xs text-white shadow-md ring-2 ring-slate-100 group-hover:ring-blue-100 transition-all">
                      {userProfile.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden md:flex flex-col">
                    <span className="text-xs font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                      {userProfile.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      {userProfile.role === 'admin' ? 'Admin' : userProfile.role === 'park_manager' ? 'Park Manager' : 'Commercial'}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile menu dropdown (repositioned absolute to header) */}
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 z-50 animate-fade-in text-slate-900 flex flex-col gap-4">
                      {/* Header profile info */}
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                        {userProfile.avatarUrl ? (
                          userProfile.avatarUrl.startsWith('data:image') ? (
                            <img 
                              src={userProfile.avatarUrl} 
                              alt="Profile Avatar" 
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-100 border border-slate-200 shadow-sm">
                              {userProfile.avatarUrl}
                            </div>
                          )
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center font-black text-xs text-white">
                            {userProfile.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-slate-800 truncate">{userProfile.name}</span>
                          <span className="text-[10px] text-slate-400 truncate">{userProfile.email}</span>
                          <span className="text-[9px] uppercase bg-slate-100 text-slate-600 self-start px-1.5 py-0.5 rounded font-black mt-1">
                            {userProfile.role}
                          </span>
                        </div>
                      </div>

                      {/* Account actions */}
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Mon Espace</p>
                        
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false);
                            window.location.hash = 'my_account';
                          }}
                          className="flex items-center gap-2 px-2.5 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all text-left w-full cursor-pointer border border-slate-100/85 hover:border-blue-100"
                        >
                          <Users size={14} className="text-blue-500" />
                          <span>Mon Compte & Paramètres</span>
                        </button>
                      </div>

                      {/* Organization settings */}
                      <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Mon Entreprise</p>
                        
                        <div className="flex items-center justify-between px-2.5 py-1 text-slate-700">
                          <span className="text-xs font-bold text-slate-500">Nom actuel :</span>
                          <span className="text-xs font-black text-slate-800">{userProfile.companyId}</span>
                        </div>

                        {userProfile.role === 'admin' && (
                          <>
                            <button 
                              onClick={() => {
                                setShowProfileMenu(false);
                                window.location.hash = 'team_management';
                              }}
                              className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left w-full"
                            >
                              <Users size={14} className="text-slate-500" />
                              <span>Gérer l'équipe</span>
                            </button>

                            <button 
                              onClick={() => {
                                setShowProfileMenu(false);
                                window.location.hash = 'company_management';
                              }}
                              className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left w-full"
                            >
                              <Car size={14} className="text-slate-500" />
                              <span>Gestion des Entreprises</span>
                            </button>

                            <button 
                              onClick={() => {
                                setShowProfileMenu(false);
                                window.location.hash = 'pdf_templates';
                              }}
                              className="flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all text-left w-full"
                            >
                              <FileText size={14} className="text-slate-500" />
                              <span>Éditer modèles PDF</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Logout */}
                      <button 
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleLogout();
                        }}
                        className="flex items-center justify-center gap-2 w-full mt-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Se déconnecter</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {showSuperAdmin && <SuperAdmin onClose={() => setShowSuperAdmin(false)} onShowToast={showToast} />}

        {/* FLUID WORKSPACE (No boxed max-width restrictions!) */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {isDbLoading ? (
            <div className="text-center py-24">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48}/> 
              <p className="text-slate-500 font-bold text-lg">Chargement de votre espace sécurisé...</p>
            </div>
          ) : (
            <div className="w-full">
              {currentView === 'dashboard' && (
                <Dashboard 
                  onSelectSale={(id) => window.location.hash = `detail/${id}`} 
                  onProcessPdf={(f) => processPDFFile(f, sales, setDraftExtraction, (view) => window.location.hash = view, showToast, setIsLoading, userProfile)}
                  onManualEntry={() => {
                    setDraftExtraction({ isManual: true, bdcNumber: generateNextBdcNumber(), company: userProfile?.companyId || 'KDB AUTO', clientName: '', marque: '', modele: '', color: '', vin: '', plaque: '', mec: '', price: '', date: new Date().toISOString().split('T')[0], commercial: userProfile?.name || 'À assigner', phone: '', email: '', ref: '', address: '', zipCode: '', city: '', draftPayments: [] });
                    window.location.hash = 'pdf_validation';
                  }}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              )}
              {currentView === 'delivery_calendar' && (
                <DeliveryCalendar onShowToast={showToast} />
              )}
              {currentView === 'perf_dashboard' && (
                <AdminPerformanceDashboard onShowToast={showToast} />
              )}
              {currentView === 'detail' && selectedSaleId && (
                <SaleDetail 
                  saleId={selectedSaleId} 
                  onBack={() => window.location.hash = 'dashboard'} 
                  onEditSale={(sale) => {
                    setDraftExtraction({ ...sale, isManual: true, draftPayments: [] });
                    window.location.hash = 'pdf_validation';
                  }}
                  onShowToast={showToast}
                />
              )}
              {currentView === 'pdf_validation' && draftExtraction && (
                <PdfValidation 
                  draftExtraction={draftExtraction}
                  onCancel={() => {
                    setDraftExtraction(null);
                    window.location.hash = draftExtraction.id ? `detail/${draftExtraction.id}` : 'dashboard';
                  }}
                  onShowToast={showToast}
                  onSuccess={(saleId) => {
                    setDraftExtraction(null);
                    window.location.hash = `detail/${saleId}`;
                  }}
                />
              )}
              {currentView === 'team_management' && (
                <TeamManagement onShowToast={showToast} />
              )}
              {currentView === 'company_management' && (
                <CompanyManagement onClose={() => window.location.hash = 'dashboard'} onShowToast={showToast} />
              )}
              {currentView === 'stock' && (
                <StockView 
                  onShowToast={showToast}
                  onCreateBdc={(vehicle) => {
                    setDraftExtraction({
                      isManual: true,
                      bdcNumber: generateNextBdcNumber(),
                      company: vehicle.site || userProfile?.companyId || 'KDB AUTO',
                      clientName: '',
                      phone: '',
                      email: '',
                      marque: vehicle.marque || '',
                      modele: vehicle.modele || '',
                      color: vehicle.couleur || '',
                      vin: vehicle.vin || '',
                      plaque: vehicle.immatriculation || '',
                      mec: vehicle.mec || '',
                      kms: vehicle.kms || undefined,
                      garantie: vehicle.typeGarantie || '',
                      energie: vehicle.energie || '',
                      price: vehicle.prixParticulierTTC?.toString() || '',
                      date: new Date().toISOString().split('T')[0],
                      commercial: userProfile?.name || 'À assigner',
                      ref: vehicle.refInterne || '',
                      address: '',
                      zipCode: '',
                      city: '',
                      draftPayments: []
                    });
                    window.location.hash = 'pdf_validation';
                  }}
                />
              )}
               {currentView === 'clients' && (
                <ClientsView onShowToast={showToast} />
              )}
              {currentView === 'chat' && (
                <ChatView onShowToast={showToast} />
              )}
              {currentView === 'my_account' && (
                <MyAccount onBack={() => window.location.hash = 'dashboard'} onShowToast={showToast} />
              )}
              {currentView === 'pdf_templates' && (
                <PdfTemplatesEditor onBack={() => window.location.hash = 'dashboard'} onShowToast={showToast} />
              )}
              {currentView === 'notifications' && (
                <NotificationsView 
                  notifications={notifications}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                  onBack={() => window.location.hash = 'dashboard'}
                  onNavigate={(hash) => window.location.hash = hash}
                />
              )}
            </div>
          )}
        </main>

        {/* BOTTOM GLOBAL FOOTER */}
        <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-6 shrink-0 text-[10px] font-bold text-slate-400">
          <div>
            Sales Dygital © {new Date().getFullYear()}
          </div>
          <a 
            href="https://stats.uptimerobot.com/EjAcm5FoSR" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Statut du Système (UptimeRobot)
          </a>
        </footer>
      </div>

      {/* Floating Chat notification toasts */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2.5 z-50 select-none max-w-xs w-full">
        {chatToasts.map((toast) => (
          <div 
            key={toast.id}
            onClick={() => {
              window.location.hash = 'chat';
              setChatToasts(prev => prev.filter(t => t.id !== toast.id));
            }}
            className="bg-white hover:bg-slate-50 border border-slate-100 shadow-2xl rounded-2xl p-4 flex items-start gap-3 cursor-pointer transition-all hover:scale-102 duration-300 animate-slide-in-toast"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
              💬
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                {toast.sessionName}
              </span>
              <p className="text-xs font-black text-slate-800 truncate mt-0.5">
                {toast.senderName}
              </p>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 leading-normal">
                {toast.text}
              </p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setChatToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @keyframes slideInToast { from { opacity: 0; transform: translateY(30px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-slide-in-toast { animation: slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
};

export default function App() {
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash.startsWith('#reserve/')) {
        setBookingId(window.location.hash.split('#reserve/')[1]);
      } else {
        setBookingId(null);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (bookingId) {
    return <ClientBooking saleId={bookingId} onShowToast={(m, t) => console.log(m, t)} />;
  }

  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
