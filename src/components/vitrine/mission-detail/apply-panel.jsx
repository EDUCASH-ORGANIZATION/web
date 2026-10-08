import Link from "next/link"
import { Icon } from "@/components/design/icon"

const PRIMARY_CLASS = {
  visitor: "btn btn--accent btn--lg btn--block",
  student: "btn btn--accent btn--lg btn--block",
  "student-applied": "btn btn--secondary btn--lg btn--block",
  client: "btn btn--primary btn--block",
  closed: "btn btn--secondary btn--block",
}

/** Classe du bouton principal selon le cas (partagée avec la barre mobile). */
export function primaryButtonClass(kind, { large = true } = {}) {
  const cls = PRIMARY_CLASS[kind] ?? PRIMARY_CLASS.closed
  return large ? cls : cls.replace(" btn--lg", "")
}

/**
 * Indication pour un étudiant non vérifié. Le lien Postuler reste actif :
 * la page étudiante décide de l'accès.
 */
export function VerifyHint() {
  return (
    <p className="caption">
      Ton compte n&apos;est pas encore vérifié.{" "}
      <Link className="link" href="/profile/verify">Envoie ta carte pour postuler</Link>
    </p>
  )
}

/**
 * Zone d'action de la colonne de candidature (bureau).
 * Rend l'objet `applyCta` : message, bouton principal et lien secondaire.
 * @param {{ cta: { kind: string, primary: {label: string, href: string}|null, secondary: {label: string, href: string}|null, message: string|null }, needsVerification?: boolean }} props
 */
export function ApplyPanel({ cta, needsVerification = false }) {
  const { kind, primary, secondary, message } = cta
  return (
    <div className="stack stack--3">
      {message && kind !== "closed" ? (
        <div className="banner banner--info" role="status">
          <Icon name="i-info" />
          <div className="banner__body">{message}</div>
        </div>
      ) : null}
      {primary ? (
        <Link className={primaryButtonClass(kind)} href={primary.href}>
          {primary.label}
        </Link>
      ) : null}
      {needsVerification ? <VerifyHint /> : null}
      {secondary ? (
        <Link className="btn btn--secondary btn--block" href={secondary.href}>
          {secondary.label}
        </Link>
      ) : null}
    </div>
  )
}
