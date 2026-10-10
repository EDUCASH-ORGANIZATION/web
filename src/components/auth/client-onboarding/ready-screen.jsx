import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { logout } from "@/lib/actions/auth.actions"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { MIN_DEPOSIT_AMOUNT } from "@/lib/supabase/database.constants"
import { formatFcfa } from "@/lib/vitrine/format"
import { dashboardFor } from "@/lib/auth/destinations"
import { resumePublishHref } from "@/lib/utils/publish-prefill"

const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

/** Panneau de marque de l'onboarding client (props `brand` de `AuthShell`). */
export const CLIENT_ONBOARDING_BRAND = {
  lines: ["2 étapes.", "Puis votre"],
  highlight: "1re mission.",
  points: [
    { icon: "i-wallet", title: "Rechargez une fois,", text: "publiez autant de missions que votre solde le permet." },
    { icon: "i-lock", title: "Fonds en séquestre.", text: "Versés à l'étudiant seulement quand vous confirmez la fin." },
    { icon: "i-shield", title: "Étudiants vérifiés.", text: "Carte étudiante contrôlée par l'équipe." },
  ],
}

const STEPS = [
  {
    title: "Rechargez votre portefeuille",
    text: `Par MTN MoMo, Moov Money ou Celtiis Cash, dès ${formatFcfa(MIN_DEPOSIT_AMOUNT)}.`,
  },
  { title: "Publiez une mission", text: "Le budget est bloqué en séquestre, pas débité." },
  { title: "Choisissez un étudiant", text: "Comparez les profils vérifiés, discutez avant de retenir." },
  {
    title: "Validez la fin",
    text: `L'étudiant reçoit ${100 - COMMISSION_PERCENT} %, EduCash garde ${COMMISSION_PERCENT} %.`,
  },
]

/**
 * Écran final : checklist de démarrage. Si `destination` est une publication de mission
 * (besoin, ville, type intacts), l'action principale la reprend.
 * @param {{ destination: string }} props destination renvoyée par `completeClientOnboarding`
 */
export function ReadyScreen({ destination }) {
  const resumeHref = resumePublishHref(destination)
  return (
    <div className="auth__form">
      <div className="stack stack--3 a-center">
        <span className="sticker sticker--round">
          <Icon name="i-sparkles" />
        </span>
        <h1 className="display display--m a-display--accent">
          Votre compte
          <br />
          <span className="hl-bleu">est prêt.</span>
        </h1>
        <p className="muted">Voici comment se passe une mission, du début à la fin.</p>
      </div>
      <ol className="a-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <span className="ds-grow">
              <b>{step.title}</b>
              <span>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link className="btn btn--accent btn--lg btn--block" href={destination}>
        {resumeHref ? "Continuer ma mission" : "Aller à mon tableau de bord"}
        <span className="btn__dot">
          <Icon name="i-arrow-right" />
        </span>
      </Link>
      <Link className="btn btn--secondary btn--block" href="/client/wallet">
        <Icon name="i-plus" />
        Recharger mon portefeuille
      </Link>
      <p className="caption a-ta-center">Vous pouvez rédiger sans solde : il n&apos;est vérifié qu&apos;au moment de publier.</p>
    </div>
  )
}

const ROLE_LABELS = { student: "étudiant", admin: "administrateur" }

/**
 * Session incorrecte (connecté avec un autre rôle), compte suspendu ou profil illisible
 * (`error`) : explication et sorties.
 * @param {{ status: "wrong_role" | "suspended" | "error", role?: string | null, email?: string | null }} props
 */
export function WrongSessionScreen({ status, role, email }) {
  const roleLabel = ROLE_LABELS[role]
  const home = dashboardFor(role) ?? "/"

  return (
    <div className="auth__form">
      <div className="stack stack--3 a-center">
        <div className="empty__art">
          <span className="ic-sq ic-sq--alerte">
            <Icon name="i-user-check" />
          </span>
        </div>
        {status === "error" ? (
          <>
            <h1 className="ds-h2">Profil indisponible</h1>
            <p className="muted body-s">{"Nous n'avons pas pu charger votre profil. Rechargez la page dans un instant."}</p>
          </>
        ) : status === "suspended" ? (
          <>
            <h1 className="ds-h2">Votre compte est suspendu</h1>
            <p className="muted body-s">Vous ne pouvez pas publier de missions pour le moment. Contactez-nous pour en savoir plus.</p>
          </>
        ) : (
          <>
            <h1 className="ds-h2">
              {roleLabel ? `Vous êtes connecté avec un compte ${roleLabel}` : "Vous n'êtes pas connecté avec un compte client"}
            </h1>
            <p className="muted body-s">
              {email ? `${email} n'est pas un compte client. ` : "Ce compte n'est pas un compte client. "}
              Un même compte ne peut pas être étudiant et client. Pour publier des missions, créez un compte client avec une autre adresse.
            </p>
          </>
        )}
      </div>
      {status === "error" ? null : status === "suspended" ? (
        <Link className="btn btn--primary btn--block" href="/contact">
          Nous contacter
        </Link>
      ) : (
        <Link className="btn btn--primary btn--block" href={home}>
          {role === "student" ? "Retour à mon espace étudiant" : "Retour à mon espace"}
        </Link>
      )}
      <form action={logout}>
        <button className="btn btn--secondary btn--block" type="submit">
          <Icon name="i-logout" />
          Me déconnecter
        </button>
      </form>
    </div>
  )
}
