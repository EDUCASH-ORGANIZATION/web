"use client"

import { useId, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Lines } from "@/components/app-ui/lines"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { useAppToast } from "@/components/app-ui/toast"
import { acceptApplication, rejectApplication } from "@/lib/actions/application.actions"
import { updateMissionStatus } from "@/lib/actions/mission.actions"
import { COMMISSION_RATE, missionTypeLabel } from "@/lib/constants/missions"
import { clientMissionHref } from "@/lib/app/client-routes"
import { formatAmount, formatShortDate } from "@/lib/app/format"
import { missionView } from "@/lib/client-space/mission-view"
import { MissionHeader } from "./mission-header"
import { CandidateList } from "./open/candidate-list"
import { CandidateDrawer } from "./open/candidate-drawer"
import { AcceptDialog } from "./open/accept-dialog"
import { RejectDialog } from "./open/reject-dialog"
import { CancelDialog } from "./open/cancel-dialog"
import { formatDay, formatWhen, plural } from "./open/candidate-row"

const cx = (...parts) => parts.filter(Boolean).join(" ")
const endSentence = (text) => (text.endsWith(".") ? text : `${text}.`)
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Rend le focus au déclencheur d'une boîte une fois celle-ci fermée (Safari ne focalise pas un bouton cliqué,
// et le déclencheur peut avoir disparu : candidature refusée). Repli sur `fallback`.
function restoreFocus(triggerRef, fallbackRef) {
  setTimeout(() => {
    const trigger = triggerRef.current
    if (trigger?.isConnected) trigger.focus()
    else fallbackRef?.current?.focus()
  }, 0)
}

function PublishedBanner() {
  return (
    <div className="banner banner--succes" role="status">
      <Icon name="i-check-circle" />
      <div className="banner__body">
        <div className="banner__title">Votre mission est publiée</div>
        Les étudiants peuvent désormais y candidater. Vous êtes prévenu par e-mail à chaque candidature.
      </div>
    </div>
  )
}

function EscrowCard({ view }) {
  const { split, receipt } = view
  const funded = receipt.reserved > 0
  return (
    <section className="card2" aria-label="Séquestre">
      <div className="sec2">
        <h2 className="sec2__title">Séquestre</h2>
        {funded ? <StatusBadge label="En séquestre" tone="neutre" icon="i-lock" /> : null}
      </div>
      <Lines
        rows={[
          { label: funded ? "Budget bloqué" : "Budget", value: split.total },
          { label: `Commission EduCash ${COMMISSION_PERCENT} %`, value: split.commission, sign: "debit" },
        ]}
        total={{ label: "Versé à l'étudiant", value: split.student }}
      />
      <p className="note2">
        <Icon name="i-lock" />
        <span>
          {funded && view.reservedAt ? `Bloqués à la publication le ${endSentence(formatDay(view.reservedAt))} ` : ""}
          Si vous annulez la mission, le séquestre revient sur votre portefeuille.
        </span>
      </p>
    </section>
  )
}

function DetailsCard({ mission }) {
  const rows = [
    ["Type", missionTypeLabel(mission.type)],
    mission.city ? ["Lieu", mission.city] : null,
    mission.deadline ? ["Date limite", formatShortDate(mission.deadline)] : null,
    ["Urgence", mission.urgency === "high" ? "Urgent" : "Normale"],
  ].filter(Boolean)
  return (
    <section className="card2" aria-label="La mission">
      <div className="sec2">
        <h2 className="sec2__title">La mission</h2>
      </div>
      <div className="lines2">
        {rows.map(([label, value]) => (
          <div className="lines2__row" key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      {mission.description ? <p className="prof2__p open2__desc">{mission.description}</p> : null}
    </section>
  )
}

function TimelineCard({ mission, view, applications }) {
  const lastApplication = applications.reduce((last, a) => (String(a.createdAt) > String(last) ? a.createdAt : last), "")
  const count = applications.length
  return (
    <section className="card2" aria-label="Chronologie">
      <div className="sec2">
        <h2 className="sec2__title">Chronologie</h2>
      </div>
      <ol className="timeline">
        <li className="tl-item is-done">
          <span className="tl-item__dot">
            <Icon name="i-check" />
          </span>
          <div>
            <div className="tl-item__title">
              Publiée{view.receipt.reserved > 0 ? `, ${formatAmount(view.receipt.reserved)} en séquestre` : ""}
            </div>
            <div className="tl-item__meta">{formatWhen(mission.createdAt)}</div>
          </div>
        </li>
        <li className={cx("tl-item", count > 0 && "is-done")}>
          <span className="tl-item__dot">
            <Icon name="i-users" />
          </span>
          <div>
            <div className="tl-item__title">
              {count > 0 ? `${plural(count, "candidature reçue", "candidatures reçues")}` : "Aucune candidature pour l'instant"}
            </div>
            {count > 0 ? <div className="tl-item__meta">Dernière le {formatWhen(lastApplication)}</div> : null}
          </div>
        </li>
        <li className="tl-item is-current">
          <span className="tl-item__dot">
            <Icon name="i-user-check" />
          </span>
          <div>
            <div className="tl-item__title">Choisir un étudiant</div>
          </div>
        </li>
      </ol>
    </section>
  )
}

/**
 * Vue C04 (mission ouverte) avec le tiroir C05 et les boîtes d'acceptation, de refus et d'annulation (C07).
 * Composant pur côté données : `detail` et `candidate` viennent de la page (voir client-mission-detail.actions).
 * `flags` = { confirmer, publiee, paymentsEnabled, candidateError? } ; un drapeau d'URL n'exécute jamais
 * d'action (la bannière `publiee` est un simple affichage). Le tiroir est piloté par `?candidat=` : l'ouvrir
 * ou le fermer est une navigation, l'adresse reste partageable.
 */
export function MissionOpenView({ detail, candidate, flags }) {
  const { mission, applications } = detail
  const view = missionView(detail)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { success } = useAppToast()
  const tabsId = useId()

  const [tab, setTab] = useState("candidatures")
  const [order, setOrder] = useState("recent")
  const [dialog, setDialog] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const dialogTrigger = useRef(null)
  const profileTrigger = useRef(null)
  const listRef = useRef(null)

  const candidatId = searchParams?.get("candidat") || null

  const openDialog = (kind) => (applicant, element) => {
    dialogTrigger.current = element
    setDialog({ kind, applicant })
  }
  const closeDialog = () => {
    setDialog(null)
    restoreFocus(dialogTrigger, listRef)
  }

  // Fermer ou quitter le tiroir : même adresse sans `candidat`, les autres paramètres sont gardés.
  const leaveDrawer = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("candidat")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const closeDrawer = () => {
    leaveDrawer()
    restoreFocus(profileTrigger, listRef)
  }

  const acceptApplicant = async (applicant) => {
    const result = await acceptApplication({
      applicationId: applicant.id,
      studentId: applicant.studentId,
      missionId: mission.id,
    })
    if (result?.error) return { error: result.error }
    success("Candidature acceptée", "La mission est maintenant en cours.")
    router.replace(clientMissionHref(mission.id))
    router.refresh()
    return {}
  }

  const rejectApplicant = async (applicant) => {
    const result = await rejectApplication(applicant.id)
    if (result?.error) return { error: result.error }
    success("Candidature refusée")
    if (candidatId) leaveDrawer()
    router.refresh()
    return {}
  }

  const cancelMission = async () => {
    const result = await updateMissionStatus(mission.id, "cancelled")
    if (result?.error) return { error: result.error }
    success(
      "Mission annulée",
      view.receipt.reserved > 0
        ? `Les ${formatAmount(view.receipt.reserved)} ont été remboursés sur votre portefeuille.`
        : "Le séquestre a été remboursé sur votre portefeuille.",
    )
    router.refresh()
    return {}
  }

  const cancelAction = (
    <button
      type="button"
      className="link2 cand2__link cand2__link--muted"
      onClick={(e) => {
        dialogTrigger.current = e.currentTarget
        setCancelOpen(true)
      }}
    >
      <Icon name="i-x" />
      Annuler la mission
    </button>
  )

  return (
    <>
      <MissionHeader mission={mission} status={view.status} actions={view.actions.cancel ? cancelAction : null} />
      {flags?.publiee ? <PublishedBanner /> : null}
      {view.overdue ? (
        <p className="note2 note2--box">
          <Icon name="i-info" />
          <span>
            {"L'échéance est dépassée. "}
            <b>Rien ne se passe automatiquement</b>
            {" : examinez les candidatures ou annulez la mission pour récupérer le séquestre."}
          </span>
        </p>
      ) : null}

      <div className="tabs ds-mob-only" role="tablist" aria-label="Sections de la mission">
        {[
          ["candidatures", "Candidatures", view.counts.total],
          ["details", "Détails", 0],
        ].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${tabsId}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${tabsId}-${key}`}
            className={cx("tab", tab === key && "is-active")}
            onClick={() => setTab(key)}
          >
            {label}
            {count > 0 ? <span className="count">{count}</span> : null}
          </button>
        ))}
      </div>

      <div className="split2">
        <div
          className={cx("col2", tab !== "candidatures" && "open2__panel--off")}
          role="tabpanel"
          id={`${tabsId}-candidatures`}
          aria-labelledby={`${tabsId}-candidatures-tab`}
        >
          <CandidateList
            missionId={mission.id}
            applications={applications}
            counts={view.counts}
            order={order}
            onOrderChange={setOrder}
            profileFlags={{ publiee: flags?.publiee }}
            onProfileOpen={(element) => {
              profileTrigger.current = element
            }}
            onAccept={openDialog("accept")}
            onReject={openDialog("reject")}
            listRef={listRef}
          />
        </div>
        <div
          className={cx("col2", tab !== "details" && "open2__panel--off")}
          role="tabpanel"
          id={`${tabsId}-details`}
          aria-labelledby={`${tabsId}-details-tab`}
        >
          <EscrowCard view={view} />
          <DetailsCard mission={mission} />
          <TimelineCard mission={mission} view={view} applications={applications} />
        </div>
      </div>

      <CandidateDrawer
        open={Boolean(candidatId)}
        candidate={candidate}
        error={Boolean(flags?.candidateError)}
        missionId={mission.id}
        onClose={closeDrawer}
        onRetry={() => router.refresh()}
        onAccept={openDialog("accept")}
        onReject={openDialog("reject")}
      />
      <AcceptDialog
        open={dialog?.kind === "accept"}
        applicant={dialog?.applicant}
        mission={mission}
        split={view.split}
        onClose={closeDialog}
        onConfirm={() => acceptApplicant(dialog.applicant)}
      />
      <RejectDialog
        open={dialog?.kind === "reject"}
        applicant={dialog?.applicant}
        onClose={closeDialog}
        onConfirm={() => rejectApplicant(dialog.applicant)}
      />
      <CancelDialog
        open={cancelOpen}
        mission={mission}
        refundAmount={view.receipt.reserved}
        onClose={() => {
          setCancelOpen(false)
          restoreFocus(dialogTrigger, listRef)
        }}
        onConfirm={cancelMission}
      />
    </>
  )
}

export default MissionOpenView
