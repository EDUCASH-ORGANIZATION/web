import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { SectionCard } from "@/components/app-ui/section-card"
import { ErrorState } from "@/components/app-ui/state-block"
import { CloseAccountForm } from "@/components/app-ui/close-account-form"
import { CLOSURE_GRACE_DAYS } from "@/lib/account-closure/closure-rules"
import {
  CLOSURE_CONTACT_EMAIL,
  blockerPresentation,
  closeAccountHref,
  closeProfileHref,
  graceTimeline,
} from "@/lib/app/closure-screen"

const ERASED = ["Votre nom", "Votre numéro de téléphone", "Votre adresse email", "Votre photo de profil"]
const ERASED_STUDENT = [...ERASED, "Votre carte étudiante"]
const KEPT = [
  "Vos transactions, conservées 10 ans (obligation légale)",
  "Vos achats",
  "Vos messages",
  "Vos avis",
]

/**
 * Point d'entrée « Fermer mon compte » (T08, bas des profils C17 et E10). Un lien : rien ne se ferme à ce stade.
 * @param {{ space: "client"|"student" }} props
 */
export function CloseAccountCard({ space }) {
  return (
    <section className="card2" aria-label="Fermer mon compte">
      <div className="sec2">
        <h2 className="sec2__title">Fermer mon compte</h2>
      </div>
      <p className="note2">
        <Icon name="i-info" />
        <span>
          {`Votre accès est coupé tout de suite. Vous disposez de ${CLOSURE_GRACE_DAYS} jours pour changer d'avis : sur simple demande, nous réactivons votre compte. Passé ce délai, vos données personnelles sont effacées.`}
        </span>
      </p>
      <div className="actions2">
        <Link className="btn btn--danger-outline btn--sm" href={closeAccountHref(space)}>
          <Icon name="i-logout" />
          Fermer mon compte
        </Link>
      </div>
    </section>
  )
}

function BlockedState({ blockers, space }) {
  return (
    <div className="split2 split2--wide">
      <div className="col2">
        <SectionCard title="Points à régler" count={blockers.length}>
          <p className="note2">
            <Icon name="i-info" />
            <span>
              Nous ne pouvons pas fermer un compte tant que de l&apos;argent, une mission, un achat ou un signalement
              est en cours. Chaque point ci-dessous indique ce qu&apos;il reste à faire.
            </span>
          </p>
          <div className="lines2">
            {blockers.map((blocker) => {
              const { icon, title, action } = blockerPresentation(blocker.code, space)
              return (
                <div className="lines2__row" key={blocker.code}>
                  <span className="note2">
                    <Icon name={icon} />
                    <span>
                      <b>{title}</b>
                      <br />
                      {blocker.message}
                    </span>
                  </span>
                  {action ? (
                    <Link className="link2" href={action.href}>
                      {action.label}
                      <Icon name="i-arrow-right" />
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>
      <div className="col2">
        <SectionCard title="Et ensuite ?">
          <p className="note2">
            <Icon name="i-refresh" />
            <span>
              Réglez ces points, puis revenez sur cette page : la vérification est refaite à chaque tentative. Aucune
              donnée n&apos;est modifiée tant que vous n&apos;avez pas confirmé.
            </span>
          </p>
          <div className="actions2">
            <Link className="btn btn--dark btn--sm" href={closeProfileHref(space)}>
              Revenir à mon profil
            </Link>
            <button className="btn btn--soft btn--sm" type="button" disabled>
              Continuer
            </button>
          </div>
          <a className="link2" href={`mailto:${CLOSURE_CONTACT_EMAIL}`}>
            <Icon name="i-mail" />
            Besoin d&apos;aide ? {CLOSURE_CONTACT_EMAIL}
          </a>
        </SectionCard>
      </div>
    </div>
  )
}

function ConfirmState({ dueAt, space, closeAction }) {
  const erased = space === "student" ? ERASED_STUDENT : ERASED
  return (
    <div className="split2 split2--wide">
      <div className="col2">
        <SectionCard title={`Un délai de ${CLOSURE_GRACE_DAYS} jours pour changer d'avis`}>
          <div className="lines2">
            {graceTimeline(dueAt).map((row) => (
              <div className="lines2__row" key={row.label}>
                <span>{row.label}</span>
                <b>{row.value}</b>
              </div>
            ))}
          </div>
          <p className="note2">
            <Icon name="i-mail" />
            <span>
              Pour réactiver votre compte pendant le délai, écrivez à <b>{CLOSURE_CONTACT_EMAIL}</b>{" "}
              depuis l&apos;adresse de votre compte. Passé ce délai, la réactivation n&apos;est plus possible.
            </span>
          </p>
        </SectionCard>
        <SectionCard title="Ce qui sera effacé">
          <ul className="checklist">
            {erased.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Ce qui sera gardé">
          <ul className="checklist">
            {KEPT.map((item) => (
              <li className="is-ok" key={item}>
                {item}
              </li>
            ))}
          </ul>
          <p className="note2">
            <Icon name="i-user" />
            <span>
              Ces éléments restent visibles, au nom de <b>« Compte clôturé »</b>. Ils ne permettent plus de vous
              identifier.
            </span>
          </p>
        </SectionCard>
      </div>
      <div className="col2">
        <SectionCard title="Confirmer la fermeture">
          <CloseAccountForm closeAction={closeAction} cancelHref={closeProfileHref(space)} />
        </SectionCard>
      </div>
    </div>
  )
}

/**
 * Page « Fermer mon compte » (T08). Vue sans accès aux données : `preview` vient de `getMyClosurePreview`
 * (`{ blockers, dueAt }` ou `{ error }`), `closeAction` est la server action `closeMyAccount`. Blocages non vides :
 * liste avec action proposée, « Continuer » désactivé ; sinon confirmation (FERMER et mot de passe).
 * @param {{
 *   space: "client"|"student",
 *   preview?: { blockers?: { code: string, message: string }[], dueAt?: string|null, error?: string },
 *   closeAction: (prev: unknown, formData: FormData) => Promise<unknown>,
 * }} props
 */
export function CloseAccountView({ space, preview, closeAction }) {
  if (!preview || preview.error || !Array.isArray(preview.blockers)) {
    return (
      <div className="page2">
        <ErrorState
          titleAs="h1"
          title="Impossible de vérifier votre compte"
          text="Nous n'avons pas pu vérifier l'état de votre compte. Rien n'a été modifié."
        />
      </div>
    )
  }
  const blocked = preview.blockers.length > 0
  return (
    <div className="page2">
      <PageHead date={blocked ? "Avant de continuer" : "Dernière étape"} title="Fermer mon compte" />
      {blocked ? (
        <BlockedState blockers={preview.blockers} space={space} />
      ) : (
        <ConfirmState dueAt={preview.dueAt} space={space} closeAction={closeAction} />
      )}
    </div>
  )
}

export default CloseAccountView
