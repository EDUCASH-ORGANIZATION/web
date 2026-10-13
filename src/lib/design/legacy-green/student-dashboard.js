// Exemptions vertes de l'espace étudiant : E01 Tableau de bord.
// La page est portée. Reste `wallet-card.js` : il n'est plus importé par E01 mais l'est encore par
// `student/wallet-shell.js` (E08) ; ST-09 ou ST-17 le déplace vers `student-wallet.js` puis le retire.
export const STUDENT_DASHBOARD_GREEN = [
  "src/components/shared/wallet-card.js",
]
