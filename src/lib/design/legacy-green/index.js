// Exemptions vertes par module. Un fichier ne figure que dans un seul module.
// Les modules client, emails et étudiant sont vidés et supprimés : seul l'existant non porté reste (voir remaining.js).
import { REMAINING_GREEN } from "./remaining.js"

export const GREEN_MODULES = {
  "remaining": REMAINING_GREEN,
}

export const EXEMPT_GREEN = Object.values(GREEN_MODULES).flat()
