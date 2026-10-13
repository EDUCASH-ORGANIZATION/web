// Union des exemptions vertes par lot. Un fichier ne figure que dans un seul module.
import { CLIENT_DASHBOARD_GREEN } from "./client-dashboard.js"
import { CLIENT_MISSIONS_GREEN } from "./client-missions.js"
import { CLIENT_MISSION_DETAIL_GREEN } from "./client-mission-detail.js"
import { CLIENT_PROFILE_GREEN } from "./client-profile.js"
import { EMAILS_GREEN } from "./emails.js"
import { REMAINING_GREEN } from "./remaining.js"

export const GREEN_MODULES = {
  "client-dashboard": CLIENT_DASHBOARD_GREEN,
  "client-missions": CLIENT_MISSIONS_GREEN,
  "client-mission-detail": CLIENT_MISSION_DETAIL_GREEN,
  "client-profile": CLIENT_PROFILE_GREEN,
  "emails": EMAILS_GREEN,
  "remaining": REMAINING_GREEN,
}

export const EXEMPT_GREEN = Object.values(GREEN_MODULES).flat()
