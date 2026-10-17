import Link from "next/link"
import { fmtInt } from "@/lib/vitrine/format"
import { primaryButtonClass, VerifyHint } from "./apply-panel"

/**
 * Barre de candidature fixe sur mobile : même objet `applyCta` que la colonne bureau.
 * Structure de la maquette V03 (.action-bar) : bloc prix + légende à gauche, bouton dans une
 * cellule souple à droite. Le bouton ne porte jamais sa largeur de 100 % sur la barre elle-même,
 * sinon il recouvre le prix (RD-FIX-18).
 * @param {{ cta: { kind: string, primary: {label: string, href: string}|null, message: string|null }, budget: number, caption?: string|null, needsVerification?: boolean }} props
 */
export function ApplyBar({ cta, budget, caption = null, needsVerification = false }) {
  const { kind, primary } = cta
  return (
    <div className={needsVerification ? "v03-applybar v03-applybar--hint ds-mob-only" : "v03-applybar ds-mob-only"}>
      <div className="v03-applybar__info">
        <div className="amount amount--s">{fmtInt(budget)}&#8239;<small>FCFA</small></div>
        {needsVerification ? <VerifyHint /> : caption ? <div className="caption">{caption}</div> : null}
      </div>
      {primary ? (
        <div className="ds-grow v03-applybar__cta">
          <Link className={primaryButtonClass(kind, { large: false })} href={primary.href}>
            {primary.label}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
