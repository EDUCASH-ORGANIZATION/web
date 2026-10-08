import Link from "next/link"
import { Icon } from "@/components/design/icon"

// Bandeau de l'étudiant qui consulte son propre profil (tutoiement).
export function OwnerBanner() {
  return (
    <div className="v04-own">
      <span>Voici ce que voient les clients sur ton profil.</span>
      <Link className="btn btn--secondary btn--sm" href="/profile/edit">Modifier</Link>
    </div>
  )
}

function ActionCard({ firstName, children }) {
  return (
    <div className="v04-act">
      <span className="eyebrow eyebrow--bleu">Vous avez une mission ?</span>
      <div className="ds-h3">
        Proposez-la à {firstName}, le budget reste bloqué jusqu&apos;à votre validation.
      </div>
      {children}
    </div>
  )
}

// Colonne d'action selon le visiteur : visiteur, client, étudiant ou admin.
export function TalentActions({ talentId, firstName, role, commonMissionId, missionsDone, ratingText }) {
  const loginHref = `/auth/login?next=${encodeURIComponent(`/talents/${talentId}`)}`

  return (
    <div className="v04-side">
      {role === "client" ? (
        <ActionCard firstName={firstName}>
          <Link className="btn btn--accent btn--lg btn--block" href="/client/missions/new">
            Publier une mission
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
          {commonMissionId ? (
            <Link
              className="btn btn--secondary btn--block"
              href={`/client/messages/${commonMissionId}?studentId=${talentId}`}
            >
              Discuter
            </Link>
          ) : null}
        </ActionCard>
      ) : null}
      {role === null ? (
        <ActionCard firstName={firstName}>
          <Link className="btn btn--accent btn--lg btn--block" href="/auth/register?role=client">
            Créer un compte client
            <span className="btn__dot"><Icon name="i-arrow-right" /></span>
          </Link>
          <p className="caption muted">
            Déjà client ? <Link className="link" href={loginHref}>Se connecter</Link>. Vous reviendrez sur ce profil.
          </p>
        </ActionCard>
      ) : null}
      <div className="card card--sm">
        <div className="recap">
          <div className="recap__line"><span>Missions terminées</span><b>{missionsDone}</b></div>
          <div className="recap__line"><span>Note moyenne</span><b>{ratingText}</b></div>
        </div>
      </div>
      <Link className="link body-s ds-self-start" href={`/contact?sujet=signalement&ref=${encodeURIComponent(`/talents/${talentId}`)}`}>
        <Icon name="i-flag" className="ic ic--16" />
        Signaler ce profil
      </Link>
    </div>
  )
}
