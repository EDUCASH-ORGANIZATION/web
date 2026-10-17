import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { FormBanner } from "@/components/auth/ui/form-banner"
import { CLOSURE_GRACE_DAYS } from "@/lib/account-closure/closure-rules"
import { CLOSURE_CONTACT_EMAIL } from "@/lib/app/closure-screen"
import { safeDateFr } from "@/lib/app/format"

/**
 * Page publique « fermeture enregistrée » (T08). Aucune action, aucune donnée personnelle : la date limite
 * (`deadline`, déjà validée par la page) est la seule information affichée ; sans elle, le texte parle de durée.
 * @param {{ deadline?: Date|null }} props
 */
export function ClosedAccountPanel({ deadline = null }) {
  const date = deadline ? safeDateFr(deadline) : ""
  return (
    <div className="auth__form">
      <span className="ic-sq ic-sq--bleu">
        <Icon name="i-check" />
      </span>
      <div>
        <h1 className="ds-h1">Votre compte est fermé</h1>
        <p className="muted a-lead">Vous avez été déconnecté. Un email de confirmation vous a été envoyé.</p>
      </div>
      {date ? (
        <div className="recap">
          <div className="recap__line">
            <span>Réactivable jusqu&apos;au</span>
            <b>{date}</b>
          </div>
        </div>
      ) : null}
      <FormBanner tone="info" icon="i-mail">
        Vous avez changé d&apos;avis ? Écrivez à <b>{CLOSURE_CONTACT_EMAIL}</b>{" "}
        {date ? "avant cette date" : `dans les ${CLOSURE_GRACE_DAYS} jours qui suivent la fermeture`}, depuis
        l&apos;adresse de votre compte. Après, vos données personnelles sont effacées et la réactivation n&apos;est plus
        possible.
      </FormBanner>
      <Link className="btn btn--primary btn--lg btn--block" href="/">
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}

export default ClosedAccountPanel
