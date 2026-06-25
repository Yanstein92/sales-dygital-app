# Sales Dygital — Plateforme SaaS de Gestion de Ventes Automobiles

Sales Dygital est une application de gestion (SaaS) robuste, performante et moderne conçue pour le suivi des bons de commande (BDC), des acomptes, et de l'état d'avancement de la livraison des véhicules.

## Fonctionnalités Principales

*   **Extraction de BDC Intelligente** : Analyse automatique des PDF pour préremplir instantanément les clients, coordonnées, véhicules, montants et acomptes.
*   **Suivi des Paiements & Reste à Payer** : Enregistrement des acomptes reçus par Virement, Espèces, Chèques ou Cartes Bancaires avec gestion optionnelle de la date d'encaissement.
*   **Filtres Avancés & Tris par Défaut** : Les dossiers sont filtrés par défaut en statut "En Parc", triés du plus récent au plus ancien, et ordonnés selon le reste à payer décroissant. Les dossiers soldés ou remboursés sont regroupés élégamment en fin de liste.
*   **Gestion Multi-utilisateurs & Équipe** : Attribution des dossiers aux commerciaux, rôles administrateurs et collaborateurs avec restriction de vue sécurisée.
*   **Statut de Livraison** : Gestion intuitive de l'état du véhicule (En Parc, Sortie Programmée, Sorti TPD, Sorti).

## Technologies Utilisées

*   **Frontend** : React, TypeScript, Tailwind CSS, Lucide Icons.
*   **Backend & Base de données** : Node.js, Express, Firestore Firebase (Base de données sécurisée NoSQL en temps réel).
*   **Analyse PDF** : pdfjs-dist pour l'extraction de texte.

## Installation et Lancement

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Configurez les variables d'environnement dans un fichier `.env` :
   ```env
   # Firebase configuration
   # Port d'écoute par défaut : 3000
   ```

3. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```

---
Développé par **Dygital**. Tous droits réservés.
