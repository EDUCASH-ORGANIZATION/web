// Exemptions vertes par module. Un fichier ne figure que dans un seul module.
// Les modules client et emails sont vidés et supprimés : seul l'existant non porté reste.
import { REMAINING_GREEN } from "./remaining.js"
import { STUDENT_DASHBOARD_GREEN } from "./student-dashboard.js"
import { STUDENT_MISSIONS_GREEN } from "./student-missions.js"
import { STUDENT_APPLICATIONS_GREEN } from "./student-applications.js"
import { STUDENT_MESSAGES_GREEN } from "./student-messages.js"
import { STUDENT_WALLET_GREEN } from "./student-wallet.js"
import { STUDENT_PROFILE_GREEN } from "./student-profile.js"
import { STUDENT_REVIEW_GREEN } from "./student-review.js"
import { STUDENT_SHELL_GREEN } from "./student-shell.js"

export const GREEN_MODULES = {
  "remaining": REMAINING_GREEN,
  "student-dashboard": STUDENT_DASHBOARD_GREEN,
  "student-missions": STUDENT_MISSIONS_GREEN,
  "student-applications": STUDENT_APPLICATIONS_GREEN,
  "student-messages": STUDENT_MESSAGES_GREEN,
  "student-wallet": STUDENT_WALLET_GREEN,
  "student-profile": STUDENT_PROFILE_GREEN,
  "student-review": STUDENT_REVIEW_GREEN,
  "student-shell": STUDENT_SHELL_GREEN,
}

export const EXEMPT_GREEN = Object.values(GREEN_MODULES).flat()
