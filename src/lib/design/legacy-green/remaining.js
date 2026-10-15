// Exemptions de la famille verte historique : composants partagés encore non portés, vitrine du lot B.
// Les exemptions admin sont réparties par lot dans admin-*.js (RD-ADMIN-01).
// Aucun fichier de l'espace étudiant n'est exempté du vert (RD-STUDENT-01).
// Vider cette liste quand le fichier est migré (le garde-fou refuse une entrée inutile).
export const REMAINING_GREEN = [
  "src/app/not-found.js",
  "src/components/auth/card-upload-zone.js",
  "src/components/shared/mission-card.js",
  "src/components/shared/navbar.jsx",
  "src/components/shared/offline-page.js",
  "src/components/shared/verified-avatar.js",
  "src/components/ui/button.jsx",
  "src/components/ui/input.jsx",
]
