// Exemptions vertes de l'espace étudiant : E08, E09 Portefeuille et retrait.
// La page est portée. Restent les anciens composants jusqu'à leur suppression (ST-17) : `wallet-shell.js`,
// `withdraw-modal.js`, et `shared/wallet-card.js` que seul `wallet-shell.js` importe encore.
// Vider cette liste quand les fichiers sont supprimés (le garde-fou refuse une entrée inutile).
export const STUDENT_WALLET_GREEN = [
  "src/components/student/wallet-shell.js",
  "src/components/student/withdraw-modal.js",
  "src/components/shared/wallet-card.js",
]
