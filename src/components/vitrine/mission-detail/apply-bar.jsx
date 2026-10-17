import Link from "next/link"
import { fmtInt } from "@/lib/vitrine/format"
import { primaryButtonClass, VerifyHint } from "./apply-panel"

// Seul « Postuler » (étudiant) est assez court pour tenir dans une cellule à côté du prix. Tout autre libellé de
// applyCta (« Se connecter pour postuler », « Publier une mission similaire », « Voir des missions similaires »,
// « Voir ma candidature ») est empilé par défaut, comme primaryButtonClass traite un kind inconnu en « closed ».
const SIDE_BY_SIDE_KINDS = new Set(["student"])

/**
 * Barre de candidature fixe sur mobile : même objet `applyCta` que la colonne bureau.
 * Structure de la maquette V03 (.action-bar) : bloc prix + légende à gauche, bouton dans une
 * cellule souple à droite. Le bouton ne porte jamais sa largeur de 100 % sur la barre elle-même,
 * sinon il recouvre le prix (RD-FIX-18). Sous 600 px, tout bouton autre que « Postuler » (visiteur, mission
 * fermée, client, étudiant ayant postulé, kind inconnu) et l'étudiant non vérifié passent en barre empilée : prix et
 * légende, puis bouton pleine largeur. De 600 à 1023 px la classe --stack reste posée sans effet (côte à côte).
 * Sans bouton (admin), le bloc prix reste seul et n'est pas empilé.
 * @param {{ cta: { kind: string, primary: {label: string, href: string}|null, message: string|null }, budget: number, caption?: string|null, needsVerification?: boolean }} props
 */
export function ApplyBar({ cta, budget, caption = null, needsVerification = false }) {
  const { kind, primary } = cta
  const stacked = primary && !SIDE_BY_SIDE_KINDS.has(kind)
  const layout = needsVerification ? " v03-applybar--hint" : stacked ? " v03-applybar--stack" : ""
  return (
    <div className={`v03-applybar${layout} ds-mob-only`}>
      <div className="v03-applybar__info">
        <div className="amount amount--s">{fmtInt(budget)}&#8239;<small>FCFA</small></div>
        {needsVerification ? <VerifyHint /> : caption ? <div className="caption">{caption}</div> : null}
      </div>
      {primary ? (
        <div className="v03-applybar__cta">
          <Link className={primaryButtonClass(kind, { large: false })} href={primary.href}>
            {primary.label}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
