import { jsPDF } from 'jspdf';
import { Sale, UserProfile } from '../types';

interface RefundPDFData {
  amount: string;
  date: string;
  method: string;
  details: string;
}

interface DeliveryDischargeForm {
  recipientType: 'client' | 'mandataire';
  recipientName: string;
  recipientId?: string;
  checkedItems: {
    FACTURE: boolean;
    CPI: boolean;
    CARTE_GRISE: boolean;
    COC: boolean;
    PASSEPORT: boolean;
    DOUBLE_DE_CLE: boolean;
    CESSION: boolean;
    CHAINE_DE_PROPRIETE: boolean;
    AUTRE: boolean;
  };
  autreCommentaire?: string;
}

// Safe async image loader that bypasses CORS or resolves to null if failed
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Helper to sanitize filename for easy archiving and recognition
function sanitizeFilename(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9]/g, '_') // replace special characters with underscore
    .replace(/__+/g, '_') // reduce multiple underscores
    .toUpperCase();
}

// Helper to add 1 year to a date string
function getOneYearLaterDate(dateStr: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('fr-FR');
  } catch (e) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('fr-FR');
  }
}

// Robust French price formatter avoiding Unicode narrow non-breaking spaces that break jsPDF spacing
function formatFrenchPrice(amount: number): string {
  const parts = amount.toString().split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimalPart = parts[1] ? `,${parts[1]}` : '';
  return `${integerPart}${decimalPart} €`;
}

export async function generateRefundPDF(sale: Sale, refund: RefundPDFData, userProfile?: UserProfile) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isAvoir = refund.method?.toLowerCase().includes('avoir');
  const refundDateFormatted = refund.date ? new Date(refund.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  const validUntilDate = getOneYearLaterDate(refund.date);

  // 1. Resolve Company Details (KDB AUTO is default fallback)
  const companyName = sale.company || userProfile?.companyId || 'KDB AUTO';
  const compDetail = userProfile?.companiesDetails?.find(
    c => c.name.toUpperCase() === companyName.toUpperCase()
  );

  const compNameStr = compDetail?.name || companyName || 'KDB AUTO';
  const compAddress = compDetail?.address || '119 B RUE DE COLOMBES, 92600 ASNIERES-SUR-SEINE';
  const compSiret = compDetail?.siret || '91820927100033';
  const compEmail = compDetail?.email || 'contact@kdbauto.fr';
  const compPhone = compDetail?.phone || '';

  // Colors & Styles (Minimalist, modern, low-color, high-contrast slate theme)
  const primaryColor = [15, 23, 42]; // Slate 900
  const secondaryColor = [71, 85, 105]; // Slate 600
  const lightGray = [148, 163, 184]; // Slate 400
  const bgLight = [248, 250, 252]; // Slate 50
  const borderLight = [226, 232, 240]; // Slate 200

  // Load Logo image
  const logoImg = await loadImage(compDetail?.logoUrl || '');

  // Coordinates
  let y = 15;
  const topY = 15;
  let compDetailsStartX = 15;

  // --- HEADER SECTION ---
  if (logoImg) {
    const maxWidth = 15;
    const maxHeight = 15;
    let finalWidth = maxWidth;
    let finalHeight = maxHeight;

    if (logoImg.width && logoImg.height) {
      const ratio = logoImg.width / logoImg.height;
      if (ratio > maxWidth / maxHeight) {
        finalWidth = maxWidth;
        finalHeight = maxWidth / ratio;
      } else {
        finalHeight = maxHeight;
        finalWidth = maxHeight * ratio;
      }
    }
    
    const logoY = topY + (maxHeight - finalHeight) / 2;
    doc.addImage(logoImg, 'PNG', 15, logoY, finalWidth, finalHeight);

    // Vertical divider
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.35);
    doc.line(44, topY, 44, topY + 15);

    compDetailsStartX = 10;
  }

  // Draw Company Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(compNameStr.toUpperCase(), compDetailsStartX, topY + 2);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  let currentHeaderY = topY + 5.5;
  const maxAddrWidth = logoImg ? 75 : 85;
  const addrLines = doc.splitTextToSize(compAddress, maxAddrWidth);
  addrLines.forEach((line: string) => {
    doc.text(line, compDetailsStartX, currentHeaderY);
    currentHeaderY += 3.2;
  });
  
  doc.text(`SIRET : ${compSiret}`, compDetailsStartX, currentHeaderY);
  currentHeaderY += 3.2;
  doc.text(`Email : ${compEmail}`, compDetailsStartX, currentHeaderY);
  if (compPhone) {
    currentHeaderY += 3.2;
    doc.text(`Tél : ${compPhone}`, compDetailsStartX, currentHeaderY);
  }

  // Determine exact Title based on payment method
  let docTitle = "DÉCHARGE DE REMBOURSEMENT";
  if (isAvoir) {
    docTitle = "ATTRIBUTION D'UN AVOIR";
  } else if (refund.method?.toLowerCase().includes('virement')) {
    docTitle = "DÉCHARGE DE REMBOURSEMENT";
  } else if (refund.method?.toLowerCase().includes('espece')) {
    docTitle = "REÇU DE REMBOURSEMENT";
  }

  // Top Right: Document Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(docTitle, 195, topY + 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`N° Bon de Commande : ${sale.bdcNumber || 'N/A'}`, 195, topY + 7.5, { align: 'right' });
  
  const dateLabel = isAvoir ? "Date d'attribution" : "Date de remboursement";
  doc.text(`${dateLabel} : ${refundDateFormatted}`, 195, topY + 11, { align: 'right' });

  if (isAvoir) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Avoir valable jusqu'au : ${validUntilDate}`, 195, topY + 14.5, { align: 'right' });
  } else if (refund.method) {
    doc.text(`Mode de versement : ${refund.method}`, 195, topY + 14.5, { align: 'right' });
  }

  // Horizontal divider line
  y = Math.max(currentHeaderY + 4, topY + 18);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.4);
  doc.line(15, y, 195, y);
  y += 7;

  // --- SECTION 1: VEHICLE INFORMATION ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INFORMATIONS VÉHICULE', 15, y);
  y += 3;

  // Draw a SINGLE unified full-width rounded rectangle
  const boxWidth = 180;
  const boxHeight = 26;
  const boxX = 15;

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, y, boxWidth, boxHeight, 2, 2, 'FD');

  const contentY = y + 5;
  // Left Column (X = 20)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('MARQUE / MODÈLE', 20, contentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${sale.marque || ''} ${sale.modele || ''}`, 20, contentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('TEINTE / COULEUR', 20, contentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.color || 'Non renseignée', 20, contentY + 16);

  // Right Column (X = 110)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('N° DE CHÂSSIS (VIN)', 110, contentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.vin || 'Non renseigné', 110, contentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('IMMATRICULATION', 110, contentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.plaque || 'Non renseignée', 110, contentY + 16);

  y += boxHeight + 6;

  // --- SECTION 2: DESTINATAIRE / MANDATAIRE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DESTINATAIRE / MANDATAIRE', 15, y);
  y += 3;

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, y, 180, 15, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  const destLabel = isAvoir ? "BÉNÉFICIAIRE DE L'AVOIR" : "BÉNÉFICIAIRE DU REMBOURSEMENT";
  doc.text(destLabel, 20, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Acheteur d'origine : ${sale.clientName || 'Inconnu'}`, 20, y + 10);
  
  y += 21;

  // --- SECTION 3: ATTESTATION / DISCHARGE CLAUSE (With solid left border strip) ---
  const clauseHeader = isAvoir ? "ATTESTATION D'AVOIR COMMERCIAL" : "ATTESTATION DE REMBOURSEMENT & CONFORMITÉ";
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(clauseHeader, 15, y);
  y += 3;

  // Format amount safely using our custom robust formatter to avoid jsPDF spacing explosions
  const formattedAmount = formatFrenchPrice(Number(refund.amount) || 0);

  // Draft the attestation paragraph text depending on refund method
  let attestationText = "";
  if (isAvoir) {
    attestationText = `Je soussigné(e), ${sale.clientName || 'Inconnu(e)'}, certifie accepter l'attribution d'un avoir commercial nominatif d'un montant de ${formattedAmount} de la part de l'établissement ${compNameStr}, consécutivement à l'annulation de l'achat du véhicule mentionné ci-dessus. Cet avoir est utilisable pendant une durée de un (1) an à compter de la date d'attribution (soit jusqu'au ${validUntilDate}) pour l'achat de tout véhicule ou prestation auprès de notre établissement. Cet avoir est nominatif, non transférable et non remboursable en espèces.`;
  } else if (refund.method?.toLowerCase().includes('virement')) {
    attestationText = `Je soussigné(e), ${sale.clientName || 'Inconnu(e)'}, certifie avoir pris connaissance du versement de la somme de ${formattedAmount} effectué par virement bancaire de la part de l'établissement ${compNameStr}, représentant le remboursement complet de l'achat du véhicule mentionné ci-dessus. Par la présente, je donne décharge entière, définitive et sans réserve à la société ${compNameStr} et renonce à tout recours ultérieur.`;
  } else if (refund.method?.toLowerCase().includes('espece')) {
    attestationText = `Je soussigné(e), ${sale.clientName || 'Inconnu(e)'}, certifie avoir reçu ce jour la somme en espèces de ${formattedAmount} de la part de l'établissement ${compNameStr}, représentant le remboursement complet de l'achat du véhicule mentionné ci-dessus. Par la présente, je donne décharge entière, définitive et sans réserve à la société ${compNameStr} pour cette transaction de remboursement.`;
  } else {
    attestationText = `Je soussigné(e), ${sale.clientName || 'Inconnu(e)'}, certifie avoir reçu ou être en cours de réception de la somme de ${formattedAmount} au titre de remboursement par ${refund.method || 'virement'} de la part de l'établissement ${compNameStr} pour le véhicule désigné ci-dessus. Par la présente, je donne décharge entière, définitive et sans réserve à la société ${compNameStr} pour ce dossier.`;
  }

  // Sanitize text of non-breaking spaces
  attestationText = attestationText.replace(/[\u202f\u00a0]/g, ' ');

  const wrappedClauseText = doc.splitTextToSize(attestationText, 172);
  const clauseHeight = Math.max(16, wrappedClauseText.length * 4.2 + 4);

  // Background and left accent line
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(15, y, 180, clauseHeight, 'F');
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, y, 1.2, clauseHeight, 'F');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  let textDrawY = y + 4.5;
  wrappedClauseText.forEach((line: string) => {
    doc.text(line, 19, textDrawY);
    textDrawY += 4.2;
  });

  y += clauseHeight + 6;

  // --- SECTION 4: REASON & OPERATION DETAILS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DÉTAILS & MOTIF DE L\'OPÉRATION', 15, y);
  y += 3;

  // Single full-width rounded rectangle containing both amount/method and details
  const operationHeight = 24;
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, y, 180, operationHeight, 2, 2, 'FD');

  // Left column inside box (Amount and Transfer method)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('MONTANT DE L\'OPÉRATION', 20, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Normal slate black for transaction amount
  doc.text(formattedAmount, 20, y + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('MODE DE TRANSFERT', 20, y + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(refund.method || 'Non renseigné', 20, y + 19.5);

  // Right column inside box (Details and Comments)
  const reasonX = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('MOTIF DU REMBOURSEMENT / DE L\'AVOIR', reasonX, y + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  const wrappedReasonText = doc.splitTextToSize(refund.details || 'Aucun motif renseigné.', 80);
  let reasonDrawY = y + 9.5;
  wrappedReasonText.slice(0, 3).forEach((line: string) => { // Limit to 3 lines inside the box
    doc.text(line, reasonX, reasonDrawY);
    reasonDrawY += 4.2;
  });

  y += operationHeight + 6;

  // --- SECTION 5: SIGNATURES (Dotted rectangular containers side-by-side) ---
  const sigBoxHeight = 32;
  const leftSigX = 15;
  const rightSigX = 108;
  const sigBoxWidth = 87;

  doc.setLineWidth(0.35);
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setLineDashPattern([2, 2], 0); // Dotted line pattern
  doc.roundedRect(leftSigX, y, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'D');
  doc.roundedRect(rightSigX, y, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'D');
  doc.setLineDashPattern([], 0); // Reset to solid line

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Signature du client / mandataire', leftSigX + sigBoxWidth / 2, y + 6, { align: 'center' });
  doc.text(`Le concessionnaire (${compNameStr})`, rightSigX + sigBoxWidth / 2, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  const signatureMention = isAvoir ? 'Mention manuscrite "Bon pour accord d\'avoir"' : 'Mention manuscrite "Bon pour accord et décharge"';
  doc.text(signatureMention, leftSigX + sigBoxWidth / 2, y + sigBoxHeight - 4, { align: 'center' });
  doc.text('Nom, date et signature du responsable', rightSigX + sigBoxWidth / 2, y + sigBoxHeight - 4, { align: 'center' });

  y += sigBoxHeight + 6;

  // --- GDPR COMPLIANCE FOOTNOTE ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  const gdprText = 
    "Protection des données (RGPD) : Les informations recueillies sur ce document sont requises pour la gestion administrative, comptable et fiscale de cette opération d'avoir ou de remboursement. Vos données sont conservées pour la durée de prescription légale requise. Vous disposez d'un droit d'accès, de rectification et de limitation du traitement auprès de notre service administratif.";
  const wrappedGdpr = doc.splitTextToSize(gdprText, 180);
  let gdprY = y;
  wrappedGdpr.forEach((line: string) => {
    doc.text(line, 15, gdprY);
    gdprY += 3;
  });

  // --- FOOTER LINE & TEXT ---
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(15, 280, 195, 280);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text(`Document généré numériquement par ${compNameStr}. Fait à la date du ${refundDateFormatted}.`, 105, 285, { align: 'center' });

  // Save PDF using exact same standardized nomenclature
  const cleanClient = sanitizeFilename(sale.clientName || 'CLIENT_INCONNU');
  const cleanBrand = sanitizeFilename(sale.marque || 'VEHICULE');
  const cleanModel = sanitizeFilename(sale.modele || 'SANS_MODELE');
  const bdcId = sale.bdcNumber || sale.id;
  const cleanMethod = sanitizeFilename(refund.method || 'OPERATION');
  const cleanDate = refund.date ? refund.date.replace(/-/g, '_') : 'SANS_DATE';

  const typePrefix = isAvoir ? 'AVOIR' : `REMBOURSEMENT_${cleanMethod}`;
  const fileName = `${typePrefix}_BDC_${bdcId}_${cleanClient}_${cleanBrand}_${cleanModel}_${cleanDate}.pdf`;

  doc.save(fileName);
}

export async function generateDeliveryPDF(sale: Sale, dischargeForm: DeliveryDischargeForm, userProfile?: UserProfile, config?: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const docDateFormatted = new Date().toLocaleDateString('fr-FR');

  // 1. Resolve Company Details (KDB AUTO is default fallback)
  const companyName = sale.company || userProfile?.companyId || 'KDB AUTO';
  const compDetail = userProfile?.companiesDetails?.find(
    c => c.name.toUpperCase() === companyName.toUpperCase()
  );

  const compNameStr = compDetail?.name || companyName || 'KDB AUTO';
  const compAddress = compDetail?.address || '119 B RUE DE COLOMBES, 92600 ASNIERES-SUR-SEINE';
  const compSiret = compDetail?.siret || '91820927100033';
  const compEmail = compDetail?.email || 'contact@kdbauto.fr';
  const compPhone = compDetail?.phone || '';

  // Colors & Styles (Minimalist, modern, low-color, high-contrast slate theme)
  const primaryColor = [15, 23, 42]; // Slate 900
  const secondaryColor = [71, 85, 105]; // Slate 600
  const lightGray = [148, 163, 184]; // Slate 400
  const bgLight = [248, 250, 252]; // Slate 50
  const borderLight = [226, 232, 240]; // Slate 200

  // Load Logo image
  const logoImg = await loadImage(compDetail?.logoUrl || '');

  // Coordinates
  let y = 15;
  const topY = 15;
  let compDetailsStartX = 15;

  // --- HEADER SECTION ---
  if (logoImg) {
    const maxWidth = 25;
    const maxHeight = 15;
    let finalWidth = maxWidth;
    let finalHeight = maxHeight;

    if (logoImg.width && logoImg.height) {
      const ratio = logoImg.width / logoImg.height;
      if (ratio > maxWidth / maxHeight) {
        finalWidth = maxWidth;
        finalHeight = maxWidth / ratio;
      } else {
        finalHeight = maxHeight;
        finalWidth = maxHeight * ratio;
      }
    }
    
    const logoY = topY + (maxHeight - finalHeight) / 2;
    doc.addImage(logoImg, 'PNG', 15, logoY, finalWidth, finalHeight);

    // Vertical divider
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.35);
    doc.line(44, topY, 44, topY + 15);

    compDetailsStartX = 48;
  }

  // Draw Company Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(compNameStr.toUpperCase(), compDetailsStartX, topY + 2);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  let currentHeaderY = topY + 5.5;
  const maxAddrWidth = logoImg ? 75 : 85;
  const addrLines = doc.splitTextToSize(compAddress, maxAddrWidth);
  addrLines.forEach((line: string) => {
    doc.text(line, compDetailsStartX, currentHeaderY);
    currentHeaderY += 3.2;
  });
  
  doc.text(`SIRET : ${compSiret}`, compDetailsStartX, currentHeaderY);
  currentHeaderY += 3.2;
  doc.text(`Email : ${compEmail}`, compDetailsStartX, currentHeaderY);
  if (compPhone) {
    currentHeaderY += 3.2;
    doc.text(`Tél : ${compPhone}`, compDetailsStartX, currentHeaderY);
  }

  // Top Right: Document Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("DÉCHARGE DE SORTIE & LIVRAISON", 195, topY + 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`N° Bon de Commande : ${sale.bdcNumber || 'N/A'}`, 195, topY + 7.5, { align: 'right' });
  doc.text(`Date de sortie : ${docDateFormatted}`, 195, topY + 11, { align: 'right' });

  // Horizontal divider line
  y = Math.max(currentHeaderY + 4, topY + 18);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.4);
  doc.line(15, y, 195, y);
  y += 7;

  // --- SECTION 1: VEHICLE INFORMATION ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INFORMATIONS VÉHICULE', 15, y);
  y += 3;

  // Draw a SINGLE unified full-width rounded rectangle
  const boxWidth = 180;
  const boxHeight = 26;
  const boxX = 15;

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, y, boxWidth, boxHeight, 2, 2, 'FD');

  const contentY = y + 5;
  // Left Column (X = 20)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('MARQUE / MODÈLE', 20, contentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${sale.marque || ''} ${sale.modele || ''}`, 20, contentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('TEINTE / COULEUR', 20, contentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.color || 'Non renseignée', 20, contentY + 16);

  // Right Column (X = 110)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('N° DE CHÂSSIS (VIN)', 110, contentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.vin || 'Non renseigné', 110, contentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('IMMATRICULATION', 110, contentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(sale.plaque || 'Non renseignée', 110, contentY + 16);

  y += boxHeight + 6;

  // --- SECTION 2: DESTINATAIRE / MANDATAIRE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DESTINATAIRE / MANDATAIRE', 15, y);
  y += 3;

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, y, 180, 15, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("BÉNÉFICIAIRE DE LA SORTIE", 20, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  const recipientLine = dischargeForm.recipientType === 'client' 
    ? `Acheteur d'origine : ${sale.clientName}`
    : `Mandataire / Récupérateur : ${dischargeForm.recipientName} (Pièce d'identité : ${dischargeForm.recipientId || 'N/A'})`;

  doc.text(recipientLine, 20, y + 10);
  
  y += 21;

  // --- SECTION 3: ATTESTATION / DISCHARGE CLAUSE (With solid left border strip) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("ATTESTATION DE SORTIE & CONFORMITÉ", 15, y);
  y += 3;

  // Draft the attestation paragraph text depending on the configuration text or fallback
  let attestationText = "";
  if (config?.dischargeText) {
    let rawText = config.dischargeText;
    rawText = rawText.replace(/\[Client\]/g, sale.clientName || "Client");
    rawText = rawText.replace(/\[Marque\]/g, sale.marque || "");
    rawText = rawText.replace(/\[Modèle\]/g, sale.modele || "");
    rawText = rawText.replace(/\[Plaque\]/g, sale.plaque || "Non immatriculé");
    rawText = rawText.replace(/\[VIN\]/g, sale.vin || "");
    rawText = rawText.replace(/\[Entreprise\]/g, compNameStr || "Concessionnaire");
    attestationText = rawText;
  } else {
    attestationText = `Je soussigné(e), ${sale.clientName || 'Inconnu(e)'}, certifie avoir pris livraison du véhicule ${sale.marque || ''} ${sale.modele || ''} immatriculé ${sale.plaque || "Non immatriculé"} (N° VIN : ${sale.vin || ''}) en parfait état et muni de tous ses documents administratifs. Par la présente, je donne décharge entière, définitive et sans réserve à la société ${compNameStr} et renonce à tout recours ultérieur.`;
  }

  // Remove any non-breaking spaces or other bad layout triggers
  attestationText = attestationText.replace(/[\u202f\u00a0]/g, ' ');

  const wrappedClauseText = doc.splitTextToSize(attestationText, 172);
  const clauseHeight = Math.max(16, wrappedClauseText.length * 4.2 + 4);

  // Background and left accent line
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(15, y, 180, clauseHeight, 'F');
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, y, 1.2, clauseHeight, 'F');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  let textDrawY = y + 4.5;
  wrappedClauseText.forEach((line: string) => {
    doc.text(line, 19, textDrawY);
    textDrawY += 4.2;
  });

  y += clauseHeight + 6;

  // --- SECTION 4: DOCUMENTS ET ÉLÉMENTS REMIS (Harmonized, clean grid) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DOCUMENTS ET ÉLÉMENTS REMIS', 15, y);
  y += 3;

  // Single full-width rounded rectangle for checkboxes
  const checkContainerHeight = 28;
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, y, 180, checkContainerHeight, 2, 2, 'FD');

  // Checkboxes list definitions
  const col1X = 20;
  const col2X = 110;
  
  // Row 1
  drawCheckbox(doc, col1X, y + 5.5, "FACTURE D'ACHAT", !!dischargeForm.checkedItems.FACTURE, primaryColor, secondaryColor);
  drawCheckbox(doc, col2X, y + 5.5, "PASSEPORT / PIECE D'IDENTITE", !!dischargeForm.checkedItems.PASSEPORT, primaryColor, secondaryColor);
  
  // Row 2
  drawCheckbox(doc, col1X, y + 10.5, "CPI (Certificat Provisoire)", !!dischargeForm.checkedItems.CPI, primaryColor, secondaryColor);
  drawCheckbox(doc, col2X, y + 10.5, "DOUBLE DE CLE", !!dischargeForm.checkedItems.DOUBLE_DE_CLE, primaryColor, secondaryColor);
  
  // Row 3
  drawCheckbox(doc, col1X, y + 15.5, "CARTE GRISE / TITRE ETRANGER", !!dischargeForm.checkedItems.CARTE_GRISE, primaryColor, secondaryColor);
  drawCheckbox(doc, col2X, y + 15.5, "CERTIFICAT DE CESSION", !!dischargeForm.checkedItems.CESSION, primaryColor, secondaryColor);

  // Row 4
  drawCheckbox(doc, col1X, y + 20.5, "COC (Certificat de Conformite)", !!dischargeForm.checkedItems.COC, primaryColor, secondaryColor);
  drawCheckbox(doc, col2X, y + 20.5, "CHAINE DE PROPRIETE", !!dischargeForm.checkedItems.CHAINE_DE_PROPRIETE, primaryColor, secondaryColor);

  // Bottom Custom "Autre" mention if checked
  if (dischargeForm.checkedItems.AUTRE && dischargeForm.autreCommentaire) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Autre : ${dischargeForm.autreCommentaire}`, 20, y + 25);
  }

  y += checkContainerHeight + 6;

  // --- SECTION 5: SIGNATURES ---
  const sigBoxHeight = 32;
  const leftSigX = 15;
  const rightSigX = 108;
  const sigBoxWidth = 87;

  doc.setLineWidth(0.35);
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setLineDashPattern([2, 2], 0); // Dotted line pattern
  doc.roundedRect(leftSigX, y, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'D');
  doc.roundedRect(rightSigX, y, sigBoxWidth, sigBoxHeight, 1.5, 1.5, 'D');
  doc.setLineDashPattern([], 0); // Reset to solid line

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Signature du client / mandataire', leftSigX + sigBoxWidth / 2, y + 6, { align: 'center' });
  doc.text(`Le concessionnaire (${compNameStr})`, rightSigX + sigBoxWidth / 2, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text('Mention manuscrite "Bon pour décharge de sortie"', leftSigX + sigBoxWidth / 2, y + sigBoxHeight - 4, { align: 'center' });
  doc.text('Nom, date et signature du préparateur', rightSigX + sigBoxWidth / 2, y + sigBoxHeight - 4, { align: 'center' });

  y += sigBoxHeight + 6;

  // --- GDPR COMPLIANCE FOOTNOTE ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  const gdprText = 
    "Protection des données (RGPD) : Les informations recueillies sur ce document sont requises pour la gestion administrative, logistique et de livraison de ce véhicule. Vos données sont conservées pour la durée de prescription légale requise. Vous disposez d'un droit d'accès, de rectification et de limitation du traitement auprès de notre service administratif.";
  const wrappedGdpr = doc.splitTextToSize(gdprText, 180);
  let gdprY = y;
  wrappedGdpr.forEach((line: string) => {
    doc.text(line, 15, gdprY);
    gdprY += 3;
  });

  // --- FOOTER LINE & TEXT ---
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.3);
  doc.line(15, 280, 195, 280);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text(`Document généré numériquement par ${compNameStr}. Fait à la date du ${docDateFormatted}.`, 105, 285, { align: 'center' });

  // Standardized Nomenclature
  const cleanClient = sanitizeFilename(sale.clientName || 'CLIENT_INCONNU');
  const cleanBrand = sanitizeFilename(sale.marque || 'VEHICULE');
  const cleanModel = sanitizeFilename(sale.modele || 'SANS_MODELE');
  const bdcId = sale.bdcNumber || sale.id;
  const cleanDate = docDateFormatted.replace(/\//g, '_');

  const fileName = `DECHARGE_LIVRAISON_BDC_${bdcId}_${cleanClient}_${cleanBrand}_${cleanModel}_${cleanDate}.pdf`;

  doc.save(fileName);
}

function drawCheckbox(doc: jsPDF, x: number, y: number, label: string, isChecked: boolean, primaryColor: number[], secondaryColor: number[]) {
  // Draw a clean box for the checkbox
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y - 3, 3.2, 3.2, 0.5, 0.5, 'FD');

  if (isChecked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('X', x + 0.8, y - 0.5); // clean 'X' check
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(label, x + 5.5, y - 0.5);
}
