// Exemptions vertes par module. Un fichier ne figure que dans un seul module.
// Les modules client, emails et étudiant sont vidés et supprimés : seul l'existant non porté reste (voir remaining.js).
// Les modules admin-* se vident écran par écran au fil de RD-ADMIN-01.
import { ADMIN_DASHBOARD_GREEN } from "./admin-dashboard.js"
import { ADMIN_MISSIONS_GREEN } from "./admin-missions.js"
import { ADMIN_SHELL_GREEN } from "./admin-shell.js"
import { ADMIN_USERS_GREEN } from "./admin-users.js"
import { ADMIN_VERIFICATIONS_GREEN } from "./admin-verifications.js"
import { ADMIN_WALLETS_GREEN } from "./admin-wallets.js"
import { REMAINING_GREEN } from "./remaining.js"

export const GREEN_MODULES = {
  "admin-shell": ADMIN_SHELL_GREEN,
  "admin-verifications": ADMIN_VERIFICATIONS_GREEN,
  "admin-dashboard": ADMIN_DASHBOARD_GREEN,
  "admin-users": ADMIN_USERS_GREEN,
  "admin-missions": ADMIN_MISSIONS_GREEN,
  "admin-wallets": ADMIN_WALLETS_GREEN,
  "remaining": REMAINING_GREEN,
}

export const EXEMPT_GREEN = Object.values(GREEN_MODULES).flat()
