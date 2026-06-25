import React, { useState } from 'react';
import { User, Lock, Loader2, AlertTriangle, Info, X, Send, Building, UserPlus } from 'lucide-react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, db, setDoc, doc, getUserDocPath } from '../lib/firebase';
import { CustomLogo } from './CustomLogo';

interface LoginProps {
  onShowToast: (msg: string, type: 'success'|'error') => void;
}

export const Login: React.FC<LoginProps> = ({ onShowToast }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' }); 

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        const user = userCredential.user;
        // Generate user document
        await setDoc(doc(db, getUserDocPath(user.uid)), {
          uid: user.uid,
          email: user.email,
          name: nameInput || user.email?.split('@')[0],
          companyId: companyInput || 'test_mode',
          role: 'admin',
          testMode: true, // Default to test mode
          maxClients: 4
        });
        onShowToast("Compte créé avec succès !", "success");
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        onShowToast("Connexion réussie !", "success");
      }
    } catch (err: any) {
      if (isRegistering) {
        setAuthError(err.code === 'auth/email-already-in-use' ? 'Cet email est déjà utilisé.' : "Erreur lors de la création du compte.");
      } else {
        console.error("Login detail err:", err);
        setAuthError(`Erreur: ${err.message || "Email ou mot de passe incorrect."}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowContactPopup(false);
      onShowToast("Votre message a été envoyé à Yaniskhelifi92@gmail.com !", "success");
      setContactForm({ name: '', email: '', message: '' });
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      
      {showContactPopup && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Info size={24} />
                <h2 className="text-xl font-black">Nous contacter</h2>
              </div>
              <button onClick={() => setShowContactPopup(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Vous souhaitez en savoir plus sur notre solution Sales - Dygital ou équiper votre entreprise ? Envoyez-nous un message !
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Votre Nom / Entreprise</label>
                <input type="text" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="Ex: Garage Dupont" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Votre Email</label>
                <input type="email" required value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="contact@entreprise.fr" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Message</label>
                <textarea required rows={4} value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" placeholder="Comment pouvons-nous vous aider ?"></textarea>
              </div>
              <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-lg font-black transition-all mt-4 disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />} Envoyer le message
              </button>
              <div className="text-center mt-3">
                <a href="mailto:Yaniskhelifi92@gmail.com?subject=Demande de contact - Dygital" className="text-xs text-blue-600 hover:underline font-bold">Ou envoyez directement un email à Yaniskhelifi92@gmail.com</a>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Éléments de design d'arrière-plan */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      
      <div className="bg-white/10 backdrop-blur-xl p-8 sm:p-12 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md z-10 mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg mb-4">
            <CustomLogo className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Sales - Dygital</h1>
          <p className="text-slate-300 font-medium mt-2">Espace de gestion multi-entreprises</p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl">
          <button 
            type="button"
            onClick={() => { setIsRegistering(false); setAuthError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isRegistering ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >Connexion</button>
          <button 
            type="button"
            onClick={() => { setIsRegistering(true); setAuthError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${isRegistering ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >Nouveau Client</button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {authError && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{authError}</p>
            </div>
          )}

          {isRegistering && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Votre Nom / Prénom</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserPlus size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-sm" 
                    placeholder="Jean Dupont" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nom de l'entreprise</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={companyInput}
                    onChange={(e) => setCompanyInput(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-sm" 
                    placeholder="Mon Garage Auto" 
                  />
                </div>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Adresse Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-slate-400" />
              </div>
              <input 
                type="email" 
                required 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-sm" 
                placeholder="contact@entreprise.fr" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Mot de passe</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400" />
              </div>
              <input 
                type="password" 
                required 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-xl leading-5 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-sm" 
                placeholder={isRegistering ? "Minimum 6 caractères" : "••••••••"} 
                minLength={6}
              />
            </div>
          </div>

          {!isRegistering && (
            <div className="flex items-center justify-between mt-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                Se souvenir de moi
              </label>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white p-3 rounded-xl font-black text-lg transition-all shadow-lg hover:shadow-blue-500/25 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Créer mon compte' : 'Connexion')}
          </button>
        </form>
        
        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <p className="text-xs text-slate-400 mb-2">Application propulsée par <span className="font-bold text-slate-300">Dygital</span></p>
          <button onClick={() => setShowContactPopup(true)} className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline transition-colors block mx-auto">
            Intéressé ? En savoir plus ou nous contacter
          </button>
          
          <a 
            href="https://stats.uptimerobot.com/EjAcm5FoSR" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Statut du service (Uptime)
          </a>
        </div>
      </div>
    </div>
  );
};
