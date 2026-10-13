"use client"

import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { EmptyState } from "@/components/app-ui/empty-state"
import { sortApplications } from "@/lib/client-space/mission-view"
import { clientConversationHref, clientMissionHref } from "@/lib/app/client-routes"
import { CandidateRow } from "./candidate-row"

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récentes" },
  { value: "rated", label: "Mieux notés" },
]

// En attente d'abord (triées selon le choix), puis les candidatures déjà traitées, les plus récentes d'abord.
export function orderApplications(applications, order) {
  const pending = applications.filter((a) => a.status === "pending")
  const others = applications.filter((a) => a.status !== "pending")
  return [...sortApplications(pending, order), ...sortApplications(others, "recent")]
}

/**
 * Liste blanche des candidatures (C04). `counts` vient de missionView ; `profileFlags` ({ publiee }) garde
 * les paramètres d'URL de la page quand le tiroir s'ouvre. `listRef` reçoit le focus quand le déclencheur
 * d'une action a disparu (candidature refusée).
 */
export function CandidateList({ missionId, applications, counts, order, onOrderChange, profileFlags, onProfileOpen, onAccept, onReject, listRef }) {
  const ordered = orderApplications(applications, order)
  return (
    <section ref={listRef} tabIndex={-1} className="list2 cand2__list" aria-label="Candidatures">
      <div className="list2__head">
        <h2 className="list2__title">
          Candidatures
          <span>{counts.total}</span>
          {counts.pending > 0 ? (
            <span className="flag2">
              <Icon name="i-zap" />
              {counts.pending} à examiner
            </span>
          ) : null}
        </h2>
        {counts.total > 1 ? (
          <Select
            variant="chip"
            size="sm"
            icon="i-sort"
            options={SORT_OPTIONS}
            value={order}
            onChange={onOrderChange}
            aria-label="Trier les candidatures"
          />
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <EmptyState
          compact
          icon="i-users"
          title="Aucune candidature pour l'instant"
          text="Votre mission est visible des étudiants. Les candidatures apparaîtront ici dès qu'un étudiant postule."
        />
      ) : (
        <div role="list">
          {ordered.map((application) => (
            <CandidateRow
              key={application.id}
              application={application}
              profileHref={clientMissionHref(missionId, { candidat: application.studentId, publiee: profileFlags?.publiee })}
              chatHref={clientConversationHref(missionId, application.studentId)}
              onProfileOpen={onProfileOpen}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default CandidateList
