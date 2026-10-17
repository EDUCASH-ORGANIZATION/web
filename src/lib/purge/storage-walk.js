import "server-only"
import { LIST_PAGE, REMOVE_BATCH } from "@/lib/purge/purge-rules"

/**
 * Adaptateur Storage de la purge : SEUL module qui parle à l'API Storage pour lister et
 * supprimer des fichiers. À remplacer lors de la migration vers Neon (autre stockage).
 * Aucune règle métier ici : les décisions (orphelin, délai de grâce...) sont dans `purge-rules.js`.
 *
 * Le client (service role) est injecté par l'appelant. Suppression uniquement par l'API
 * Storage (`remove`), jamais par du SQL sur `storage.objects`.
 * Les erreurs ne sont jamais levées : elles sont renvoyées sous la forme `{ error: true }`, et le
 * journal ne contient que le code d'erreur, jamais un chemin, un nom ou un identifiant.
 * Pas de "use server" : ces fonctions ne doivent pas devenir des actions appelables du navigateur.
 */

// Garde-fou contre une boucle de pagination sans fin (1000 pages = 1 million d'entrées).
const MAX_PAGES = 1000

// Fichier technique que Supabase pose dans les dossiers vides : jamais un candidat.
const PLACEHOLDER = ".emptyFolderPlaceholder"

/** Code d'erreur sûr à journaliser (statusCode ou code), "unknown" si absent ou suspect. */
function safeCode(error) {
  const raw = error?.statusCode ?? error?.code
  const code = raw == null ? "" : String(raw)
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown"
}

function logError(operation, error) {
  console.error("[purge] storage", operation, safeCode(error))
}

function expired(deadline) {
  return typeof deadline === "number" && Date.now() >= deadline
}

function join(prefix, name) {
  return prefix ? `${prefix}/${name}` : name
}

/**
 * Liste un dossier (un seul niveau) du compartiment, page par page.
 * Un dossier est une entrée sans `id` ; un fichier a un `id`.
 * Une erreur sur une page quelconque renvoie `{ error: true }` pour tout le dossier (jamais de liste partielle).
 * @param {object} service client Supabase (service role) injecté
 * @param {string} bucket
 * @param {string} prefix "" pour la racine, sinon "<dossier>" ou "<dossier>/<sous-dossier>"
 * @param {{ deadline?: number }} [options] échéance (Date.now) : au-delà, `{ error: true, timedOut: true }`
 * @returns {Promise<{ files: { name: string, createdAt: string | null }[], folders: string[] } | { error: true, timedOut?: true }>}
 *   `files[].name` est le chemin complet dans le compartiment ; `folders` contient les noms courts.
 */
export async function listFiles(service, bucket, prefix, { deadline } = {}) {
  const files = []
  const folders = []
  try {
    const store = service.storage.from(bucket)
    for (let page = 0; page < MAX_PAGES; page += 1) {
      if (expired(deadline)) return { error: true, timedOut: true }
      const { data, error } = await store.list(prefix, {
        limit: LIST_PAGE,
        offset: page * LIST_PAGE,
        sortBy: { column: "name", order: "asc" },
      })
      if (error || !Array.isArray(data)) {
        logError("list", error)
        return { error: true }
      }
      for (const entry of data) {
        if (!entry || typeof entry.name !== "string" || entry.name === "") continue
        if (entry.name === PLACEHOLDER) continue
        if (entry.id == null) folders.push(entry.name)
        else files.push({ name: join(prefix, entry.name), createdAt: entry.created_at ?? null })
      }
      if (data.length < LIST_PAGE) return { files, folders }
    }
    logError("list", { code: "too_many_pages" })
    return { error: true }
  } catch (error) {
    logError("list", error)
    return { error: true }
  }
}

/**
 * Liste les dossiers propriétaires (premier niveau) d'un compartiment.
 * @returns {Promise<{ folders: string[] } | { error: true, timedOut?: true }>}
 */
export async function listOwnerFolders(service, bucket, { deadline } = {}) {
  const result = await listFiles(service, bucket, "", { deadline })
  if (result.error) return result
  return { folders: result.folders }
}

/**
 * Liste tous les fichiers d'un déposant du compartiment `purchase-proofs`, sur deux niveaux :
 * `<ownerId>/<requestId>/<fichier>`. Les fichiers posés directement sous `<ownerId>/` sont
 * renvoyés avec `requestId: null`. Une erreur sur un sous-dossier renvoie `{ error: true }` pour tout le déposant.
 * @returns {Promise<{ files: { name: string, createdAt: string | null, requestId: string | null }[] } | { error: true, timedOut?: true }>}
 */
export async function listProofFiles(service, ownerId, { deadline } = {}) {
  const bucket = "purchase-proofs"
  const top = await listFiles(service, bucket, ownerId, { deadline })
  if (top.error) return top
  const files = top.files.map((file) => ({ ...file, requestId: null }))
  for (const requestId of top.folders) {
    const sub = await listFiles(service, bucket, join(ownerId, requestId), { deadline })
    if (sub.error) return sub
    for (const file of sub.files) files.push({ ...file, requestId })
  }
  return { files }
}

/**
 * Supprime des fichiers par paquets de 100 au plus via l'API Storage.
 * Simulation (`dryRun`) : aucun appel, `candidats` renseigné seulement.
 * Un paquet en erreur est compté dans `erreurs` et les suivants sont tentés. L'échéance est
 * vérifiée entre deux paquets (`arretBudget: true` si elle est atteinte).
 * `supprimes` compte les objets réellement renvoyés par le stockage (un fichier déjà absent n'est pas compté).
 * @param {object} service client Supabase (service role) injecté
 * @param {string} bucket
 * @param {string[]} paths chemins complets dans le compartiment
 * @param {{ dryRun?: boolean, deadline?: number }} [options]
 * @returns {Promise<{ candidats: number, supprimes: number, erreurs: number, ignores: number, arretBudget: boolean }>}
 */
export async function removePaths(service, bucket, paths, { dryRun = false, deadline } = {}) {
  const valid = [...new Set((Array.isArray(paths) ? paths : []).filter((p) => typeof p === "string" && p !== ""))]
  const result = {
    candidats: valid.length,
    supprimes: 0,
    erreurs: 0,
    ignores: (Array.isArray(paths) ? paths.length : 0) - valid.length,
    arretBudget: false,
  }
  if (dryRun) return result

  for (let start = 0; start < valid.length; start += REMOVE_BATCH) {
    if (expired(deadline)) {
      result.arretBudget = true
      break
    }
    const batch = valid.slice(start, start + REMOVE_BATCH)
    try {
      const { data, error } = await service.storage.from(bucket).remove(batch)
      if (error) {
        logError("remove", error)
        result.erreurs += batch.length
      } else {
        result.supprimes += Array.isArray(data) ? data.length : 0
      }
    } catch (error) {
      logError("remove", error)
      result.erreurs += batch.length
    }
  }
  return result
}
