import React, { useState, useEffect } from 'react';
import { useApp } from '../lib/context';
import { FileText, Check, Loader2, ArrowLeft } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, getUserDocPath } from '../lib/firebase';

interface PdfTemplatesEditorProps {
  onBack: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PdfTemplatesEditor: React.FC<PdfTemplatesEditorProps> = ({ onBack, onShowToast }) => {
  const { databaseUid, userProfile } = useApp();

  const [selectedTemplate, setSelectedTemplate] = useState<'bdc' | 'discharge'>('bdc');
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [templatesConfig, setTemplatesConfig] = useState({
    bdcTitle: 'BON DE COMMANDE',
    bdcClientSigMention: 'Lu et approuvé',
    bdcFooterNote: '',
    
    dischargeTitle: 'DÉCHARGE DE RESPONSABILITÉ & REMISE DES CLÉS',
    dischargeText: 'Je soussigné(e), [Client], certifie avoir pris livraison du véhicule [Marque] [Modèle] immatriculé [Plaque] (N° VIN : [VIN]) en parfait état et muni de tous ses documents administratifs. Par la présente, je donne décharge entière, définitive et sans réserve à la société [Entreprise] et renonce à tout recours ultérieur.',
    dischargeSigMention: 'Bon pour décharge de sortie',
    dischargeFooterNote: ''
  });

  useEffect(() => {
    const fetchTemplatesConfig = async () => {
      if (!databaseUid) return;
      try {
        const docRef = doc(db, getUserDocPath(databaseUid) + '/settings/pdf_templates_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setTemplatesConfig(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        console.error("Error fetching pdf templates config:", error);
      }
    };
    fetchTemplatesConfig();
  }, [databaseUid]);

  const handleSaveTemplates = async () => {
    if (!databaseUid) return;
    try {
      setIsSavingTemplates(true);
      const docRef = doc(db, getUserDocPath(databaseUid) + '/settings/pdf_templates_config');
      await setDoc(docRef, templatesConfig, { merge: true });
      onShowToast("Modèles PDF enregistrés avec succès !", "success");
    } catch (error) {
      console.error("Error saving PDF templates:", error);
      onShowToast("Erreur lors de la sauvegarde du modèle.", "error");
    } finally {
      setIsSavingTemplates(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
        <p className="text-slate-500 font-bold">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft size={14} /> Retour
        </button>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">Configuration de l'entreprise</h1>
      </div>

      {/* PDF Templates Editor Form */}
      <div className="bg-white rounded-2xl border border-slate-100/90 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText size={18} className="text-indigo-600" />
          <div>
            <p className="text-sm uppercase font-extrabold text-slate-800 tracking-wider">Éditer modèles PDF</p>
            <p className="text-xs text-slate-400">Configurez le contenu, les clauses légales et les signatures des documents PDF</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-slate-50 p-1 rounded-xl border border-slate-150">
          <button
            type="button"
            onClick={() => setSelectedTemplate('bdc')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTemplate === 'bdc'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📝 Bon de Commande
          </button>
          <button
            type="button"
            onClick={() => setSelectedTemplate('discharge')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTemplate === 'discharge'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🚚 Décharge de Livraison
          </button>
        </div>

        <div className="space-y-4">
          {selectedTemplate === 'bdc' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Titre du document PDF</label>
                <input
                  type="text"
                  value={templatesConfig.bdcTitle}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, bdcTitle: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Mention manuscrite requise (Signature Client)</label>
                <input
                  type="text"
                  value={templatesConfig.bdcClientSigMention}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, bdcClientSigMention: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                  placeholder="Ex: Lu et approuvé"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Note de bas de page (ex: fait le...)</label>
                <textarea
                  rows={3}
                  value={templatesConfig.bdcFooterNote}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, bdcFooterNote: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                  placeholder="Laissez vide pour la note par défaut (Document généré numériquement...)"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Titre du document PDF</label>
                <input
                  type="text"
                  value={templatesConfig.dischargeTitle}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, dischargeTitle: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                  <label className="text-xs font-bold text-slate-500">Clause légale / Attestation de conformité</label>
                  <span className="text-[9px] text-indigo-600 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded">Variables: [Client], [Marque], [Modèle], [Plaque], [VIN], [Entreprise]</span>
                </div>
                <textarea
                  rows={6}
                  value={templatesConfig.dischargeText}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, dischargeText: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 leading-relaxed font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Mention manuscrite requise (Signature)</label>
                <input
                  type="text"
                  value={templatesConfig.dischargeSigMention}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, dischargeSigMention: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                  placeholder="Ex: Bon pour décharge de sortie"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Note de bas de page / Métadonnées</label>
                <textarea
                  rows={3}
                  value={templatesConfig.dischargeFooterNote}
                  onChange={(e) => setTemplatesConfig({ ...templatesConfig, dischargeFooterNote: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                  placeholder="Laissez vide pour la note par défaut (Document généré numériquement...)"
                />
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveTemplates}
              disabled={isSavingTemplates}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
            >
              {isSavingTemplates ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Enregistrer ce modèle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
