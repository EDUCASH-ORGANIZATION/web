// @ds-screen RD-STUDENT-01
"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useSupabase } from "@/components/shared/supabase-provider"
import { saveStudentCardUrl } from "@/lib/actions/profile.actions"
import { CARD_UPLOAD_INSTRUCTIONS } from "@/lib/supabase/database.constants"
import { studentMissionsHref } from "@/lib/app/student-routes"
import { CARD_TYPES, cardStoragePath, cardUploadUnique } from "@/lib/storage/card-paths"

export { CARD_TYPES, cardStoragePath }

export const MAX_CARD_BYTES = 10 * 1024 * 1024
const ACCEPT = Object.keys(CARD_TYPES).join(",")

const REFUSALS = {
  format: { badge: "Format non accepté", meta: "Envoyez un JPG, un PNG ou un PDF" },
  size: { badge: "Trop lourd", meta: "10 Mo maximum : réduisez la taille ou prenez une photo" },
  empty: { badge: "Fichier vide", meta: "Choisissez un fichier qui contient votre carte" },
}

const ERR_PICK = "Choisissez d'abord un fichier."
const ERR_SESSION = "Votre session a expiré. Reconnectez-vous puis réessayez."
const ERR_UPLOAD = "L'envoi de la carte a échoué. Réessayez."
const ERR_AI = "Ce fichier ne semble pas être une carte étudiante. Envoyez une photo lisible de votre carte."
const ERR_UNEXPECTED = "Une erreur inattendue est survenue. Réessayez."

/**
 * Contrôle d'un fichier avant tout envoi : type (JPG, PNG, PDF) puis poids (10 Mo) puis fichier vide.
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {{ ok: true } | { ok: false, reason: "format" | "size" | "empty" }}
 */
export function checkCardFile(file) {
  if (!file || !Object.hasOwn(CARD_TYPES, file.type)) return { ok: false, reason: "format" }
  if (!(file.size > 0)) return { ok: false, reason: "empty" }
  if (file.size > MAX_CARD_BYTES) return { ok: false, reason: "size" }
  return { ok: true }
}

// Contrôle de lisibilité côté serveur : le module (client IA) n'est évalué qu'au moment d'un envoi.
const checkReadable = async (path) => (await import("@/lib/actions/verify-card.actions")).verifyStudentCardWithAI(path)

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`

// Les conseils viennent de CARD_UPLOAD_INSTRUCTIONS ; la ligne des formats est déjà dans la zone d'envoi.
const TIPS = CARD_UPLOAD_INSTRUCTIONS.filter((tip) => !/^formats? accept/i.test(tip))

/**
 * Envoi complet : session, dépôt dans `student-cards/<userId>/`, contrôle de lisibilité, enregistrement serveur
 * (qui revalide le chemin). Un fichier refusé au contrôle de lisibilité est retiré du dossier. Une fois l'enregistrement
 * lancé, le fichier n'est plus jamais retiré : `saveStudentCardUrl` peut avoir écrit `card_url` avant d'échouer, et
 * supprimer le fichier laisserait une carte qui pointe dans le vide. Ne lève jamais.
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function sendCardFile({ file, supabase, verifyCard, saveCard, onPhase = () => {}, unique }) {
  if (!checkCardFile(file).ok) return { error: ERR_PICK }
  let path = null
  try {
    const { data } = await supabase.auth.getUser()
    if (!data?.user) return { error: ERR_SESSION }
    path = cardStoragePath(data.user.id, file.type, unique ?? cardUploadUnique())
    onPhase("upload")
    const { error: uploadError } = await supabase.storage
      .from("student-cards")
      .upload(path, file, { upsert: false, contentType: file.type })
    if (uploadError) {
      path = null
      return { error: ERR_UPLOAD }
    }

    onPhase("check")
    const ai = await verifyCard(path)
    if (!ai?.valid) throw new Error(ERR_AI)

    onPhase("save")
    // À partir d'ici le chemin peut être déjà enregistré : plus de nettoyage possible sans risque.
    const savedPath = path
    path = null
    const saved = await saveCard(savedPath)
    if (saved?.error) throw new Error(saved.error)
    return { success: true }
  } catch (err) {
    if (path) await Promise.resolve(supabase.storage.from("student-cards").remove([path])).catch(() => {})
    return { error: err instanceof Error && err.message ? err.message : ERR_UNEXPECTED }
  }
}

function FileRow({ file, refusal, onClear, disabled }) {
  const refused = Boolean(refusal)
  return (
    <div className={refused ? "file file--error e2-12-file" : "file e2-12-file"}>
      <span className="file__thumb">
        <Icon name={refused ? "i-alert-triangle" : file.type === "application/pdf" ? "i-file" : "i-image"} className="ic ic--20" />
      </span>
      <div className="e2-12-file__main">
        {refused ? <span className="badge badge--erreur badge--sm">{REFUSALS[refusal.reason].badge}</span> : null}
        <div className="file__name">{refused ? refusal.name : file.name}</div>
        <div className="file__meta">{refused ? REFUSALS[refusal.reason].meta : megabytes(file.size)}</div>
      </div>
      {!refused && !disabled ? (
        <button type="button" className="iconbtn2" aria-label="Retirer le fichier" onClick={onClear}>
          <Icon name="i-x" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Zone d'envoi de la carte (E12) : choix ou dépôt du fichier, contrôle du type et du poids AVANT envoi, dépôt
 * navigateur vers `student-cards/<userId>/...`, contrôle de lisibilité, puis `saveStudentCardUrl` (le serveur
 * revalide le chemin). Un seul envoi à la fois.
 * @param {{ actionLabel: string, title?: string }} props
 */
export function CardDropzone({ actionLabel, title = "Envoyer ma carte étudiante" }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const formId = useId()
  const fileRef = useRef(null)
  const photoRef = useRef(null)
  const lock = useRef(false)

  const [file, setFile] = useState(null)
  const [refusal, setRefusal] = useState(null)
  const [error, setError] = useState("")
  const [phase, setPhase] = useState("idle") // idle | upload | check | save | done
  const [dragging, setDragging] = useState(false)

  const busy = phase === "upload" || phase === "check" || phase === "save"

  function take(picked) {
    if (busy || !picked) return
    setError("")
    const verdict = checkCardFile(picked)
    if (!verdict.ok) {
      setFile(null)
      setRefusal({ reason: verdict.reason, name: picked.name })
      return
    }
    setRefusal(null)
    setFile(picked)
  }

  function onPick(event) {
    take(event.target.files?.[0])
    event.target.value = ""
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer?.files?.[0])
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    if (!file) {
      setError(ERR_PICK)
      return
    }
    // Contrôle refait au moment de l'envoi : la zone ne dépend pas de l'état précédent.
    if (!checkCardFile(file).ok) return
    lock.current = true
    setError("")
    setPhase("upload")
    const outcome = await sendCardFile({
      file,
      supabase,
      verifyCard: checkReadable,
      saveCard: saveStudentCardUrl,
      onPhase: setPhase,
    })
    lock.current = false
    if (outcome.error) {
      setError(outcome.error)
      setPhase("idle")
      return
    }
    setFile(null)
    setPhase("done")
  }

  if (phase === "done") {
    return (
      <section className="e2-sec" aria-label="Carte envoyée">
        <div className="e2-empty" role="status">
          <span className="e2-empty__ic">
            <Icon name="i-check" />
          </span>
          <div className="e2-empty__title">Carte envoyée</div>
          <p className="e2-empty__text">
            Votre carte est en cours d&apos;examen. Vous pouvez postuler dès maintenant : les clients voient « En cours d&apos;examen ».
          </p>
          <div className="e2-empty__actions">
            <Link className="btn btn--dark" href={studentMissionsHref()}>
              Explorer les missions
            </Link>
            <button type="button" className="btn btn--soft btn--sm" onClick={() => router.refresh()}>
              Voir mon statut
            </button>
          </div>
        </div>
      </section>
    )
  }

  const label = busy ? "Envoi en cours" : actionLabel
  const busyText = phase === "check" ? "Vérification de votre carte" : "Envoi de votre carte"

  return (
    <>
      <section className="e2-sec" aria-label={title}>
        <div className="e2-sec__head">
          <h2 className="e2-sec__title">{title}</h2>
        </div>
        <form id={formId} className="e2-sec__body" onSubmit={submit} noValidate aria-busy={busy}>
          <div
            className={busy ? "upload e2-12-upload is-disabled" : dragging ? "upload e2-12-upload is-drag" : "upload e2-12-upload"}
            onDragOver={(e) => {
              e.preventDefault()
              if (!busy) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="e2-empty__ic">
              <Icon name="i-id-card" />
            </span>
            <span className="upload__title">Déposez votre carte étudiante ici</span>
            <span className="upload__hint">ou choisissez un fichier · JPG, PNG, PDF · 10 Mo max</span>
            <div className="e2-12-pick">
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="i-upload" />
                Choisir un fichier
              </button>
              <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => photoRef.current?.click()}>
                <Icon name="i-image" />
                Prendre une photo
              </button>
            </div>
            <input ref={fileRef} type="file" hidden accept={ACCEPT} onChange={onPick} aria-label="Choisir un fichier" tabIndex={-1} />
            <input ref={photoRef} type="file" hidden accept="image/jpeg,image/png" capture="environment" onChange={onPick} aria-label="Prendre une photo" tabIndex={-1} />
          </div>

          {file || refusal ? <FileRow file={file} refusal={refusal} onClear={() => setFile(null)} disabled={busy} /> : null}
          {busy ? (
            <p className="e2-12-busy" role="status">
              {busyText}. Ne fermez pas la page pendant l&apos;envoi.
            </p>
          ) : null}
          {error ? (
            <div className="field__error" role="alert">
              <Icon name="i-alert-circle" />
              {error}
            </div>
          ) : null}

          <p className="e2-12-tips__title">Pour qu&apos;elle soit acceptée du premier coup</p>
          <ul className="e2-12-tips">
            {TIPS.map((tip) => (
              <li key={tip}>
                <Icon name="i-check" />
                {tip}
              </li>
            ))}
          </ul>
          <div className="e2-12-actions ds-desk-only">
            <button type="submit" className="btn btn--dark" disabled={busy}>
              <Icon name="i-upload" />
              {label}
            </button>
          </div>
        </form>
      </section>
      <div className="e2-mbar">
        <button type="submit" form={formId} className="btn btn--dark btn--block" disabled={busy}>
          <Icon name="i-upload" />
          {label}
        </button>
      </div>
    </>
  )
}

export default CardDropzone
