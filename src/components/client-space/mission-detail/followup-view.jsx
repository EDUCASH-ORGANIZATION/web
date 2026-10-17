"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { MissionHeader } from "./mission-header"
import { SelectedStudent, STUDENT_FALLBACK } from "./followup/selected-student"
import { EscrowCard } from "./followup/escrow-card"
import { Timeline, buildTimeline, formatDay } from "./followup/timeline"
import { ConfirmEndDialog, ConfirmEndSuccess } from "./followup/confirm-end-dialog"
import { Receipt, DonePurchasesCard } from "./followup/receipt"
import { PurchasesCard, PaymentTodoCard, firstPendingRequest } from "./followup/purchases-card"
import { CancelledSummary } from "./followup/cancelled-summary"
import { COMPLETION_COPY } from "@/lib/missions/completion"
import { missionView } from "@/lib/client-space/mission-view"
import { firstName } from "@/lib/vitrine/public-name"
import { formatShortDate } from "@/lib/app/format"
import { purchasesEstimateOf } from "@/lib/app/purchases"
import {
  clientConversationHref,
  clientPublishHref,
  clientReviewHref,
} from "@/lib/app/client-routes"

const REPORT_HREF = "/contact?sujet=question"

function ReportLink({ muted = true }) {
  return (
    <Link className={muted ? "link2 link2--muted" : "link2"} href={REPORT_HREF}>
      <Icon name="i-flag" />
      Signaler un problème
    </Link>
  )
}

function ReviewCard({ review, studentName }) {
  return (
    <section className="card2 fup2__status" aria-label="Votre avis">
      <div className="sec2">
        <h2 className="sec2__title">Votre avis</h2>
      </div>
      <p className="fup2__rating">
        <Icon name="i-star" />
        <b>{review.rating}</b> / 5 pour {studentName}
      </p>
      {review.comment ? <blockquote className="fup2__quote">{review.comment}</blockquote> : null}
    </section>
  )
}

function DeclaredCard({ view, missionId, studentId, studentName, onConfirm, confirmTone = "dark" }) {
  const declaredOn = formatShortDate(view.completion.declaredAt)
  const lead = studentName.charAt(0).toUpperCase() + studentName.slice(1)
  return (
    <section className="card2 fup2__status fup2__status--todo" aria-label="À confirmer">
      <div className="status2">
        <span className="flag2">
          <Icon name="i-check-circle" />
          {COMPLETION_COPY.toConfirmBadge}
        </span>
        <div className="status2__title">{lead} a terminé la mission</div>
        <div className="status2__text">
          {declaredOn
            ? `${lead} indique avoir terminé le ${declaredOn}${declaredOn.endsWith(".") ? "" : "."}`
            : `${lead} indique avoir terminé.`}{" "}
          Vérifiez le travail, puis confirmez la fin pour verser le paiement à {studentName}.{" "}
          <b>
            {view.reservedAt
              ? "Les fonds restent en séquestre jusqu'à votre validation : rien n'est versé automatiquement."
              : "Le paiement n'est versé qu'après votre validation."}
          </b>
        </div>
        <div className="actions2">
          <button type="button" className={`btn btn--${confirmTone} fup2__desk`} onClick={onConfirm}>
            <Icon name="i-check-circle" />
            Confirmer la fin
          </button>
          <Link className="link2" href={REPORT_HREF}>Signaler un problème</Link>
        </div>
        <p className="status2__text">
          Un désaccord ?{" "}
          <Link className="link2" href={clientConversationHref(missionId, studentId)}>
            Écrivez à {studentName}
          </Link>
        </p>
      </div>
    </section>
  )
}

function RunningCard({ view, studentName }) {
  return (
    <section className="card2 fup2__status" aria-label="Mission en cours">
      <div className="status2">
        <span className="flag2 flag2--neutre">
          <Icon name="i-clock" />
          En cours
        </span>
        <div className="status2__title">Mission en cours avec {studentName}</div>
        <div className="status2__text">
          Quand le travail est terminé, vous confirmez la fin pour verser le paiement à {studentName}.{" "}
          <b>
            {view.reservedAt
              ? "Les fonds restent en séquestre jusqu'à votre validation."
              : "Le paiement n'est versé qu'après votre validation."}
          </b>
        </div>
        <p className="status2__text">
          Une annulation en cours de mission passe par notre équipe, qui étudie la situation avec vous.{" "}
          <Link className="link2" href={REPORT_HREF}>Signaler un problème</Link>
        </p>
      </div>
    </section>
  )
}

function InProgress({ detail, view, studentName, onConfirm }) {
  const { mission, selectedStudent } = detail
  const estimate = purchasesEstimateOf(mission.purchasesEstimate)
  const declared = view.completion.state === "declared"
  // Une demande de paiement en attente : « Ouvrir la demande » est l'unique bouton encre du cadre, « Confirmer la fin »
  // passe en contour sans jamais être désactivé (aucune action d'argent depuis cet écran).
  const pendingRequest = firstPendingRequest(detail.purchases)
  const pendingOthers = pendingRequest
    ? detail.purchases.requests.filter((r) => r.status === "pending").length - 1
    : 0
  const confirmTone = pendingRequest ? "soft" : "dark"
  const student = <SelectedStudent title="Étudiant retenu" student={selectedStudent} missionId={mission.id} />
  return (
    <>
      <div className="split2 fup2__split">
        <div className="col2">
          {pendingRequest ? (
            <PaymentTodoCard
              request={pendingRequest}
              others={pendingOthers}
              studentName={studentName}
              href={clientConversationHref(mission.id, selectedStudent?.id, { demande: pendingRequest.id })}
            />
          ) : null}
          {declared ? (
            <DeclaredCard
              view={view}
              missionId={mission.id}
              studentId={selectedStudent?.id}
              studentName={studentName}
              onConfirm={onConfirm}
              confirmTone={confirmTone}
            />
          ) : pendingRequest ? null : (
            <RunningCard view={view} studentName={studentName} />
          )}
          {estimate === null ? (
            student
          ) : (
            <PurchasesCard estimate={estimate} escrowed={Boolean(view.reservedAt)} purchases={detail.purchases} />
          )}
          <section className="card2 fup2__timeline" aria-label="Chronologie">
            <div className="sec2">
              <h2 className="sec2__title">Chronologie</h2>
            </div>
            <Timeline items={buildTimeline(detail, view, studentName)} />
          </section>
        </div>
        <div className="col2">
          {estimate === null ? null : student}
          <EscrowCard
            split={view.split}
            studentName={studentName}
            onConfirm={declared ? undefined : onConfirm}
            confirmTone={confirmTone}
            withPurchases={estimate !== null}
            since={view.reservedAt ? formatDay(view.reservedAt) : ""}
          />
        </div>
      </div>
      <div className="mbar2">
        <div className="mbar2__row">
          <Link className="btn btn--soft" href={clientConversationHref(mission.id, selectedStudent?.id)}>
            <Icon name="i-message" />
            Discuter
          </Link>
          <button type="button" className={`btn btn--${confirmTone}`} onClick={onConfirm}>
            <Icon name="i-check-circle" />
            Confirmer la fin
          </button>
        </div>
      </div>
    </>
  )
}

function Done({ detail, view, studentName }) {
  const { mission, selectedStudent, ledger, review } = detail
  const estimate = purchasesEstimateOf(mission.purchasesEstimate)
  const rateHref = clientReviewHref(mission.id)
  return (
    <>
      <div className={`split2 fup2__split fup2__split--done${estimate === null ? "" : " fup2__split--purchases"}`}>
        <div className="col2">
          {view.actions.rate ? (
            <section className="card2 fup2__status fup2__status--todo" aria-label="Votre avis">
              <div className="status2">
                <span className="flag2">
                  <Icon name="i-star" />
                  À faire
                </span>
                <div className="status2__title">Comment s&apos;est passée la mission avec {studentName} ?</div>
                <div className="status2__text">Votre avis compte pour sa réputation. Une minute suffit.</div>
                <div className="actions2">
                  <Link className="btn btn--dark" href={rateHref}>
                    <Icon name="i-star" />
                    Noter {studentName}
                  </Link>
                </div>
              </div>
            </section>
          ) : review ? (
            <ReviewCard review={review} studentName={studentName} />
          ) : null}
          {estimate === null ? null : <DonePurchasesCard estimate={estimate} escrowed={Boolean(view.reservedAt)} purchases={detail.purchases} />}
          <section className="card2 fup2__timeline" aria-label="Chronologie">
            <div className="sec2">
              <h2 className="sec2__title">Chronologie</h2>
            </div>
            <Timeline items={buildTimeline(detail, view, studentName)} />
          </section>
        </div>
        <div className="col2">
          {estimate === null ? <SelectedStudent title="Réalisée par" student={selectedStudent} missionId={mission.id} /> : null}
          <Receipt view={view} ledger={ledger} studentName={studentName} withPurchases={estimate !== null} purchases={detail.purchases} />
          {estimate === null ? null : <SelectedStudent title="Réalisée par" student={selectedStudent} missionId={mission.id} />}
        </div>
      </div>
      {view.actions.rate ? (
        <div className="mbar2">
          <div className="mbar2__row">
            <Link className="btn btn--dark" href={rateHref}>
              <Icon name="i-star" />
              Noter {studentName}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Cancelled({ detail, view, studentName }) {
  const { mission, applications } = detail
  const duplicateHref = clientPublishHref({ duplicate: mission.id })
  return (
    <>
      <div className="split2">
        <div className="col2">
          <section className="card2" aria-label="Mission annulée">
            <div className="status2">
              <div className="status2__title">
                {view.refund ? `Cette mission a été annulée le ${formatShortDate(view.refund.date)}` : "Cette mission a été annulée"}
              </div>
              <div className="status2__text">
                {view.refund
                  ? "Le séquestre a été remboursé sur votre portefeuille. Vous pouvez repartir de cette mission pour en publier une nouvelle."
                  : "Vous pouvez repartir de cette mission pour en publier une nouvelle."}
              </div>
              <div className="actions2">
                <Link className="btn btn--dark btn--sm" href={duplicateHref}>
                  <Icon name="i-copy" />
                  Dupliquer la mission
                </Link>
              </div>
            </div>
          </section>
          <section className="card2" aria-label="Chronologie">
            <div className="sec2">
              <h2 className="sec2__title">Chronologie</h2>
            </div>
            <Timeline items={buildTimeline(detail, view, studentName)} />
          </section>
        </div>
        <div className="col2">
          <CancelledSummary mission={mission} view={view} applicationsCount={applications.length} purchases={detail.purchases} />
        </div>
      </div>
      <div className="mbar2">
        <div className="mbar2__row">
          <Link className="btn btn--dark" href={duplicateHref}>
            <Icon name="i-copy" />
            Dupliquer la mission
          </Link>
        </div>
      </div>
    </>
  )
}

/**
 * Détail d'une mission en cours (C08), terminée ou annulée (C11), avec la confirmation de fin (C09).
 * `flags.confirmer` ouvre la modale à l'arrivée ; le paiement n'est JAMAIS exécuté sans clic sur
 * « Libérer le paiement ». Aucune annulation n'est proposée au client pour une mission en cours.
 * @param {{ detail: import("@/lib/actions/client-mission-detail.actions").ClientMissionDetail,
 *   flags: { confirmer?: boolean, publiee?: boolean } }} props
 */
export function MissionFollowupView({ detail, flags }) {
  const view = missionView(detail)
  const { mission, selectedStudent } = detail
  const studentName = selectedStudent
    ? firstName(selectedStudent.fullName, { fallback: STUDENT_FALLBACK })
    : STUDENT_FALLBACK
  const [dialogOpen, setDialogOpen] = useState(Boolean(flags?.confirmer) && view.actions.confirmEnd)
  const [paid, setPaid] = useState(null)
  const router = useRouter()

  if (paid !== null) {
    return (
      <div className="fup2">
        <PageHead date={mission.title} title="Mission terminée" />
        <ConfirmEndSuccess
          missionId={mission.id}
          studentName={studentName}
          split={view.split}
          paid={paid}
          onBack={() => {
            setPaid(null)
            router.refresh()
          }}
        />
      </div>
    )
  }

  const headerActions =
    mission.status === "in_progress" ? (
      <ReportLink />
    ) : mission.status === "done" ? (
      <Link className="link2" href={clientPublishHref({ duplicate: mission.id })}>
        <Icon name="i-copy" />
        Republier une mission similaire
      </Link>
    ) : null

  return (
    <div className="fup2">
      <MissionHeader
        mission={mission}
        status={view.status}
        actions={headerActions}
        purchasesLine={mission.status === "cancelled"}
      />
      {mission.status === "in_progress" ? (
        <InProgress
          detail={detail}
          view={view}
          studentName={studentName}
          onConfirm={() => setDialogOpen(true)}
        />
      ) : mission.status === "done" ? (
        <Done detail={detail} view={view} studentName={studentName} />
      ) : (
        <Cancelled detail={detail} view={view} studentName={studentName} />
      )}
      <ConfirmEndDialog
        open={dialogOpen && view.actions.confirmEnd}
        missionId={mission.id}
        title={mission.title}
        studentName={studentName}
        split={view.split}
        since={view.reservedAt ? formatShortDate(view.reservedAt) : ""}
        purchases={detail.purchases}
        onClose={() => setDialogOpen(false)}
        onPaid={(amount) => {
          setDialogOpen(false)
          setPaid(amount)
        }}
      />
    </div>
  )
}

export default MissionFollowupView
