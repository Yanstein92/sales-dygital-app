export interface Note {
  id: string;
  text: string;
  date: string;
}

export interface Payment {
  id: string;
  saleId: string;
  type: string; // VIR, ESP, CHQ, CB, AUTRES
  payer: string;
  date: string; // Used as Date de Virement / Emission
  encaissementDate?: string; // Date d'encaissement effective
  amount: number;
  addedBy?: string; // Nom de l'utilisateur qui l'a ajouté
}

export interface DeliveryLogEntry {
  user: string;
  action: string;
  timestamp: string;
}

export interface Sale {
  id: string;
  bdcNumber: string;
  company: string;
  clientName: string;
  phone: string;
  email: string;
  marque: string;
  modele: string;
  color: string;
  vin: string;
  plaque: string;
  mec?: string;
  price: number;
  transport?: number;
  date: string;
  commercial: string;
  ref: string;
  notes?: Note[];
  welcomeEmailSent?: boolean;
  
  // Nouveaux champs demandés :
  factureStatus?: 'non_facture' | 'facture' | 'a_rembourser' | 'rembourse' | 'solde';
  releaseStatus?: 'non_sorti' | 'programmee' | 'sorti' | 'sorti_tpd';
  
  refundAmount?: number;
  refundDate?: string;
  refundMethod?: string;
  refundDetails?: string;

  // Adresse et localisation
  address?: string;
  zipCode?: string;
  city?: string;

  // Champs de livraison & calendrier
  deliveryDate?: string; // YYYY-MM-DD
  deliverySlot?: string; // ex: "10:00 - 11:00"
  deliveryStatus?: 'non_programmee' | 'programmee' | 'livre' | 'annule';
  deliveryLog?: DeliveryLogEntry[];
}

export interface CompanyDetails {
  name: string;
  siret?: string;
  address?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  companyId: string; // "KDB AUTO", "DJ CAR", etc. or a real ID
  adminUid?: string;
  role: 'admin' | 'commercial' | 'park_manager';
  name: string;
  testMode?: boolean;
  maxClients?: number;
  companiesList?: string[];
  companiesDetails?: CompanyDetails[];
}

export interface AppState {
  user: UserProfile | null;
  sales: Sale[];
  payments: Payment[];
  isDbLoading: boolean;
}
