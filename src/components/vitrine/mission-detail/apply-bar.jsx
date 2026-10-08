import Link from "next/link"
import { fmtInt } from "@/lib/vitrine/format"
import { primaryButtonClass, VerifyHint } from "./apply-panel"

/**
 * Barre de candidature fixe sur mobile : même objet `applyCta` que la colonne bureau.
 * @param {{ cta: { kind: string, primary: {label: string, href: string}|null, message: string|null }, budget: number, caption?: string|null, needsVerification?: boolean }} props
 */
export function ApplyBar({ cta, budget, caption = null, needsVerification = false }) {
  const { kind, primary } = cta
  return (
    <div className="v03-applybar ds-mob-only">
      <div className="ds-grow">
        <div className="amount amount--s">{fmtInt(budget)}&#8239;<small>FCFA</small></div>
        {needsVerification ? <VerifyHint /> : caption ? <div className="caption">{caption}</div> : null}
      </div>
      {primary ? (
        <Link className={primaryButtonClass(kind, { large: false })} href={primary.href}>
          {primary.label}
        </Link>
      ) : null}
    </div>
  )
}
