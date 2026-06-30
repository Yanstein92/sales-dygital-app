import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, Car, Shield, Euro, User, Calendar, FileText } from 'lucide-react';

interface ClientPaymentProofProps {
  saleId: string;
  onShowToast: (m: string, t: 'success' | 'error') => void;
}

export const ClientPaymentProof: React.FC<ClientPaymentProofProps> = ({ saleId, onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Loaded data
  const [sale, setSale] = useState<any>(null);

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // File states
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/virement/${saleId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Erreur de chargement du dossier");
        }
        const data = await res.json();
        setSale(data.sale);
        if (data.sale?.clientName) {
          setSenderName(data.sale.clientName);
        }
      } catch (e: any) {
        setError(e.message || "Impossible de charger le dossier.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [saleId]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 1000px
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Export as compressed image/jpeg base64 with quality 0.6
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
            resolve(compressedBase64);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error("Erreur de chargement de l'image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const type = selectedFile.type;
    const isImage = type.startsWith('image/');
    const isPdf = type === 'application/pdf';

    if (!isImage && !isPdf) {
      onShowToast("Seuls les formats JPEG, PNG et PDF sont acceptés.", "error");
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileType(type);

    try {
      setCompressing(true);
      if (isImage) {
        // Compress images to save space in base64
        const compressedBase64 = await compressImage(selectedFile);
        setFileData(compressedBase64);
      } else {
        // Read PDF directly as Base64
        const reader = new FileReader();
        reader.onload = (event) => {
          setFileData(event.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      }
    } catch (err: any) {
      onShowToast("Erreur lors de la préparation du fichier", "error");
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      onShowToast("Veuillez saisir un montant de virement valide.", "error");
      return;
    }
    if (!senderName.trim()) {
      onShowToast("Veuillez saisir le nom complet du compte émetteur.", "error");
      return;
    }
    if (!fileData) {
      onShowToast("Veuillez joindre une preuve de virement (image ou PDF).", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/virement/${saleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          senderName: senderName.trim(),
          date,
          fileData,
          fileName,
          fileType
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur de transmission");
      }

      setSuccess(true);
      onShowToast("Preuve de virement transmise avec succès !", "success");
    } catch (err: any) {
      onShowToast(err.message || "Erreur réseau lors de l'envoi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={36} />
        <p className="text-slate-500 font-bold text-sm">Chargement du dossier...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-red-50 text-red-800 p-6 rounded-2xl border border-red-200 max-w-md shadow-sm">
          <AlertCircle className="mx-auto text-red-600 mb-3" size={36} />
          <h2 className="text-lg font-extrabold mb-1">Erreur de chargement</h2>
          <p className="text-sm text-red-700/85 mb-4">{error || "Dossier introuvable ou expiré."}</p>
          <div className="text-xs text-slate-400">Si le problème persiste, veuillez contacter votre conseiller commercial.</div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white rounded-3xl border border-slate-200/60 p-8 max-w-md shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Preuve reçue !</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Votre preuve de virement de <span className="font-extrabold text-slate-800">{parseFloat(amount).toLocaleString('fr-FR')} €</span> a été transmise à votre conseiller commercial.
          </p>
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mt-6 text-left space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Récapitulatif</div>
            <div className="text-xs text-slate-700">
              <strong>Compte émetteur :</strong> {senderName}
            </div>
            <div className="text-xs text-slate-700">
              <strong>Date du virement :</strong> {new Date(date).toLocaleDateString('fr-FR')}
            </div>
            <div className="text-xs text-slate-700 truncate">
              <strong>Fichier :</strong> {fileName}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-6 leading-relaxed">
            Une notification a été envoyée à notre équipe pour valider le virement. Vous recevrez une confirmation dès validation. Merci pour votre confiance !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white font-black px-4 py-2 rounded-xl mb-4 text-sm shadow-md">
            <Shield size={16} className="text-blue-400" /> {sale.company}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dépôt de preuve de virement</h1>
          <p className="text-slate-500 mt-2 text-sm">Bonjour <span className="font-bold text-slate-800">{sale.clientName}</span>, veuillez transmettre la preuve de virement pour valider votre commande.</p>
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

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md border border-slate-200/60 p-6 space-y-6">
          <div className="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
            <Euro className="text-blue-600 animate-pulse" size={18} /> Remplir les informations du virement
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Euro size={12} className="text-slate-400" /> Montant complet (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="Ex: 14500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <User size={12} className="text-slate-400" /> Compte émetteur (Nom complet) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: M. Jean DUPONT"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" /> Date d'émission du virement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-800 transition-all"
              />
            </div>
          </div>

          {/* Drag & Drop File Upload Area */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1">
              <FileText size={12} className="text-slate-400" /> Preuve de virement (JPEG, PNG ou PDF) <span className="text-red-500">*</span>
            </label>
            <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl bg-slate-50/50 hover:bg-slate-50/80 transition-all p-8 text-center cursor-pointer group">
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Upload size={22} />
                </div>
                {file ? (
                  <div className="text-xs font-extrabold text-slate-800 max-w-xs truncate">
                    {fileName} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-extrabold text-slate-700">Déposez votre fichier ici ou cliquez pour choisir</div>
                    <div className="text-[10px] font-bold text-slate-400">Formats acceptés : PDF, JPEG, PNG (Max 5Mo)</div>
                  </>
                )}
              </div>
            </div>
            {compressing && (
              <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 font-bold">
                <Loader2 className="animate-spin" size={12} /> Compression de l'image en cours...
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || compressing || !fileData}
            className={`w-full font-black py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              fileData 
                ? 'bg-slate-900 hover:bg-slate-800 text-white hover:translate-y-[-1px]' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Transmission en cours...
              </>
            ) : (
              <>
                Envoyer la preuve de virement
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
