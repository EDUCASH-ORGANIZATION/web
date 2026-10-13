// Modèle de la barre mobile de l'espace étudiant : réexporté depuis STUDENT_NAV (source unique de la coquille).
// Objet pur et sérialisable. Le profil n'y figure pas : l'avatar de l'en-tête y mène sur tous les écrans.
import { STUDENT_NAV } from "../student-space/shell/student-nav.js"

export const STUDENT_MOBILE_NAV = Object.freeze({
  mobile: Object.freeze(STUDENT_NAV.mobile.map((item) => Object.freeze({ ...item }))),
  mobileHideBelow: Object.freeze([...STUDENT_NAV.mobileHideBelow]),
})
