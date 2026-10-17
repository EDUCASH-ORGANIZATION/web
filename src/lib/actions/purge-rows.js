import "server-only"
import {
  CLOSED_REPORT_STATUSES,
  REPORT_RETENTION_MONTHS,
  JOURNAL_RETENTION_DAYS,
  ROW_BATCH,
  addCount,
  addStop,
  cutoffDate,
  emptySummary,
  isClosedReportExpired,
  isJournalEntryExpired,
} from "@/lib/purge/purge-rules"

/**
 * Purge des lignes (RD-PURGE-01) : journal de détection `message_contact_events` (plus de 180 jours) et
 * signalements `reports` clôturés depuis plus de 12 mois. SEULES ces deux tables reçoivent un `delete`.
 *
 * Le client (service role) est injecté par l'appelant : aucune création de client ici. Pas de "use server" :
 * ces fonctions ne doivent jamais devenir des actions appelables du navigateur.
 * Journal par compteurs seulement (jamais d'identifiant) ; les erreurs ne journalisent que leur code.
 * Parcours par curseur sur `id` : la simulation et le mode réel lisent les mêmes lots, et une ligne relue puis
 * jugée non purgeable n'est jamais relue en boucle.
 */

const MISSING_TABLE_CODES = ["42P01", "PGRST205"]

function isMissingTable(error) {
  return MISSING_TABLE_CODES.includes(error?.code)
}

function safeCode(error) {
  const raw = error?.code ?? error?.statusCode
  const code = raw == null ? "" : String(raw)
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown"
}

function validId(id) {
  return typeof id === "string" && id !== ""
}

function expiredDeadline(deadline) {
  return typeof deadline === "number" && Date.now() >= deadline
}

function fail(summary, category, operation, error) {
  console.error("[purge] rows", category, operation, safeCode(error))
  addCount(summary, category, "erreurs", 1)
  addStop(summary, category, "error")
}

/**
 * Boucle commune. `buildSelect(cursor)` renvoie la requête de lecture d'un lot ; `isPurgeable(row)` est la
 * revérification ligne à ligne ; `buildDelete(ids)` renvoie la requête de suppression conditionnelle.
 */
async function purgeTable(service, { category, mode, deadline, summary, buildSelect, isPurgeable, buildDelete }) {
  let cursor = null
  for (;;) {
    if (expiredDeadline(deadline)) {
      addStop(summary, category, "deadline")
      return summary
    }
    let read
    try {
      read = await buildSelect(cursor)
    } catch (error) {
      fail(summary, category, "select", error)
      return summary
    }
    if (read?.error) {
      if (isMissingTable(read.error)) {
        addCount(summary, category, "ignores", 1)
        return summary
      }
      fail(summary, category, "select", read.error)
      return summary
    }
    if (!Array.isArray(read?.data)) {
      fail(summary, category, "select", null)
      return summary
    }
    const rows = read.data
    if (rows.length === 0) return summary
    addCount(summary, category, "examines", rows.length)

    const ids = rows.filter((row) => row && validId(row.id) && isPurgeable(row)).map((row) => row.id)
    addCount(summary, category, "candidats", ids.length)

    if (mode === "real" && ids.length > 0) {
      let removed
      try {
        removed = await buildDelete(ids)
      } catch (error) {
        fail(summary, category, "delete", error)
        return summary
      }
      if (removed?.error) {
        if (isMissingTable(removed.error)) {
          addCount(summary, category, "ignores", 1)
          return summary
        }
        fail(summary, category, "delete", removed.error)
        return summary
      }
      addCount(summary, category, "supprimes", Array.isArray(removed?.data) ? removed.data.length : 0)
    }

    const last = rows[rows.length - 1]
    if (rows.length < ROW_BATCH || !last || !validId(last.id)) return summary
    cursor = last.id
  }
}

/**
 * Supprime les lignes du journal de détection de plus de 180 jours.
 * @param {object} service client Supabase (service role) injecté
 * @param {{ now?: Date | number | string, mode?: "dry" | "real", deadline?: number, summary?: ReturnType<typeof emptySummary> }} [options]
 *   `summary` : résumé partagé à compléter (par défaut un résumé neuf). Renvoie le résumé.
 */
export async function purgeContactEvents(service, { now = new Date(), mode = "dry", deadline, summary } = {}) {
  const result = summary ?? emptySummary(mode)
  const category = "contact_events"
  const cutoff = cutoffDate(now, { days: JOURNAL_RETENTION_DAYS })
  if (!cutoff) {
    fail(result, category, "cutoff", null)
    return result
  }
  const limit = cutoff.toISOString()
  return purgeTable(service, {
    category,
    mode: mode === "real" ? "real" : "dry",
    deadline,
    summary: result,
    buildSelect: (cursor) => {
      let query = service.from("message_contact_events").select("id, created_at").lt("created_at", limit)
      if (cursor !== null) query = query.gt("id", cursor)
      return query.order("id", { ascending: true }).limit(ROW_BATCH)
    },
    isPurgeable: (row) => isJournalEntryExpired(row.created_at, now),
    buildDelete: (ids) =>
      service.from("message_contact_events").delete().in("id", ids).lt("created_at", limit).select("id"),
  })
}

/**
 * Supprime les signalements `resolved` ou `dismissed` clos depuis plus de 12 mois. Le statut est revérifié sur
 * chaque ligne lue, puis la suppression elle-même est conditionnelle sur l'identifiant, le statut et la date
 * (un signalement rouvert entre la lecture et la suppression n'est pas supprimé).
 * @param {object} service client Supabase (service role) injecté
 * @param {{ now?: Date | number | string, mode?: "dry" | "real", deadline?: number, summary?: ReturnType<typeof emptySummary> }} [options]
 */
export async function purgeClosedReports(service, { now = new Date(), mode = "dry", deadline, summary } = {}) {
  const result = summary ?? emptySummary(mode)
  const category = "closed_reports"
  const cutoff = cutoffDate(now, { months: REPORT_RETENTION_MONTHS })
  if (!cutoff) {
    fail(result, category, "cutoff", null)
    return result
  }
  const limit = cutoff.toISOString()
  const expiry = `handled_at.lt.${limit},and(handled_at.is.null,updated_at.lt.${limit})`
  return purgeTable(service, {
    category,
    mode: mode === "real" ? "real" : "dry",
    deadline,
    summary: result,
    buildSelect: (cursor) => {
      let query = service
        .from("reports")
        .select("id, status, handled_at, updated_at")
        .in("status", CLOSED_REPORT_STATUSES)
        .or(expiry)
      if (cursor !== null) query = query.gt("id", cursor)
      return query.order("id", { ascending: true }).limit(ROW_BATCH)
    },
    isPurgeable: (row) => isClosedReportExpired(row, now),
    buildDelete: (ids) =>
      service.from("reports").delete().in("id", ids).in("status", CLOSED_REPORT_STATUSES).or(expiry).select("id"),
  })
}
