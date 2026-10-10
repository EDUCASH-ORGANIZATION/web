// Logique pure des étapes de l'onboarding étudiant, sans "use client" : la page serveur
// l'appelle. Une fonction exportée par un module "use client" n'est, côté serveur, qu'une
// référence client : l'appeler lève une erreur et fait tomber la page en 500.

export const LAST_STEP = 3

/** Étape demandée dans l'URL (`?etape=`), bornée à 1-3 ; toute valeur invalide donne 1. */
export function parseStep(raw) {
  const value = Number.parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  return Number.isInteger(value) && value >= 1 && value <= LAST_STEP ? value : 1
}
