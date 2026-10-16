"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { ContactWarning } from "@/components/messaging/contact-warning"
import { MESSAGE_MAX_LENGTH, fileProblem, imageExtensionOf } from "@/lib/client-space/conversations"
import { ImageDialog } from "./image-dialog"
import { LocationDialog } from "./location-dialog"

const MAX_RECORDING_SECONDS = 120
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
const ERR_MICROPHONE = "Impossible d'accéder au microphone. Vérifiez les autorisations de votre appareil."
const ERR_EMPTY_RECORDING = "L'enregistrement est vide. Veuillez réessayer."

export function clockText(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

// Extension et type de base d'un enregistrement (Safari produit du mp4, Chrome du webm).
function recordingFormat(mimeType) {
  const base = (mimeType || "audio/webm").split(";")[0]
  if (base.includes("mp4")) return { type: "audio/mp4", ext: "mp4" }
  if (base.includes("ogg")) return { type: "audio/ogg", ext: "ogg" }
  return { type: "audio/webm", ext: "webm" }
}

/** Zone de saisie verrouillée : mission terminée, annulée ou candidature refusée. */
export function LockedComposer({ text }) {
  return (
    <div className="mbar2 mbar2--chat">
      <div className="composer is-locked" role="note">
        <Icon name="i-lock" />
        {text}
      </div>
    </div>
  )
}

/** Un texte est envoyable s'il contient autre chose que des blancs. */
export const hasSendableText = (text) => text.trim().length > 0

/**
 * Bouton à droite du champ : l'envoi dès qu'il y a du texte, sinon le micro (message vocal).
 * @param {{ hasText: boolean, onRecord: () => void }} props
 */
export function SendOrMic({ hasText, onRecord }) {
  if (hasText) {
    return (
      <button type="submit" className="composer__send" aria-label="Envoyer">
        <Icon name="i-send" />
      </button>
    )
  }
  return (
    <button type="button" className="btn-icon btn-icon--plain" aria-label="Enregistrer un message vocal" onClick={onRecord}>
      <Icon name="i-mic" />
    </button>
  )
}

/**
 * Zone de saisie : texte, image, message vocal, position. `onSend(payload)` reçoit
 * `{ type: "text", content }`, `{ type: "image"|"voice", file, ext }` ou `{ type: "location", lat, lng }` ;
 * l'envoi, les échecs et les reprises sont gérés par la conversation (bulle « non envoyé » avec Réessayer).
 */
export function Composer({ onSend }) {
  const [text, setText] = useState("")
  const [problem, setProblem] = useState("")
  const [preview, setPreview] = useState(null)
  const [locating, setLocating] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const imageInput = useRef(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const stopRef = useRef(null)
  const elapsed = useRef(0)

  useEffect(
    () => () => {
      clearInterval(timer.current)
      const rec = recorder.current
      if (rec) {
        rec.ondataavailable = null
        rec.onstop = null
        if (rec.state !== "inactive") rec.stop()
        rec.stream?.getTracks().forEach((t) => t.stop())
      }
    },
    [],
  )

  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  function submitText(event) {
    event.preventDefault()
    const content = text.trim()
    if (!content) return
    setProblem("")
    setText("")
    onSend({ type: "text", content })
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault()
      submitText(event)
    }
  }

  function pickImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const issue = fileProblem(file, "image")
    if (issue) {
      setProblem(issue)
      return
    }
    setProblem("")
    setPreview({ file, url: URL.createObjectURL(file) })
  }

  function confirmImage() {
    const { file } = preview
    setPreview(null)
    onSend({ type: "image", file, ext: imageExtensionOf(file) })
  }

  async function startRecording() {
    setProblem("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunks.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      recorder.current = rec
      rec.start(100)
      setRecording(true)
      elapsed.current = 0
      setSeconds(0)
      timer.current = setInterval(() => {
        elapsed.current += 1
        setSeconds(elapsed.current)
        if (elapsed.current >= MAX_RECORDING_SECONDS) stopRef.current?.()
      }, 1000)
    } catch {
      setProblem(ERR_MICROPHONE)
    }
  }

  function releaseRecorder() {
    clearInterval(timer.current)
    recorder.current?.stream?.getTracks().forEach((t) => t.stop())
    recorder.current = null
    setRecording(false)
    elapsed.current = 0
    setSeconds(0)
  }

  function cancelRecording() {
    const rec = recorder.current
    if (rec) {
      rec.ondataavailable = null
      rec.onstop = null
      if (rec.state !== "inactive") rec.stop()
    }
    chunks.current = []
    releaseRecorder()
  }

  async function stopRecording() {
    const rec = recorder.current
    if (!rec) return
    clearInterval(timer.current)
    await new Promise((resolve) => {
      rec.onstop = resolve
      if (rec.state !== "inactive") rec.stop()
      else resolve()
    })
    const { type, ext } = recordingFormat(rec.mimeType)
    const blob = new Blob(chunks.current, { type })
    chunks.current = []
    releaseRecorder()
    const issue = blob.size === 0 ? ERR_EMPTY_RECORDING : fileProblem(blob, "voice")
    if (issue) {
      setProblem(issue)
      return
    }
    onSend({ type: "voice", file: blob, ext })
  }

  useEffect(() => {
    stopRef.current = stopRecording
  })

  if (recording) {
    return (
      <div className="mbar2 mbar2--chat">
        <div className="composer is-recording" role="group" aria-label="Enregistrement en cours">
          <button type="button" className="btn-icon btn-icon--plain" aria-label="Annuler l'enregistrement" onClick={cancelRecording}>
            <Icon name="i-x" />
          </button>
          <div className="composer__field">
            <span className="rec-dot" aria-hidden="true" />
            <span className="composer__timer2">Enregistrement {clockText(seconds)}</span>
          </div>
          <button type="button" className="composer__send" aria-label="Envoyer le message vocal" onClick={stopRecording}>
            <Icon name="i-send" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mbar2 mbar2--chat">
        {problem ? (
          <p className="composer__error2" role="alert">
            {problem}
          </p>
        ) : null}
        <ContactWarning text={text} />
        <form className="composer" onSubmit={submitText}>
          <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={pickImage} />
          <div className="composer__tools">
            <button type="button" className="btn-icon btn-icon--plain" aria-label="Joindre une image" onClick={() => imageInput.current?.click()}>
              <Icon name="i-image" />
            </button>
            <button type="button" className="btn-icon btn-icon--plain" aria-label="Partager une position" onClick={() => setLocating(true)}>
              <Icon name="i-map-pin" />
            </button>
          </div>
          <label className="composer__field">
            <span className="sr-only">Votre message</span>
            <textarea
              className="composer__input2"
              value={text}
              rows={1}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="Écrivez un message…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>
          <SendOrMic hasText={hasSendableText(text)} onRecord={startRecording} />
        </form>
      </div>
      {preview ? <ImageDialog file={preview.file} previewUrl={preview.url} onConfirm={confirmImage} onCancel={() => setPreview(null)} /> : null}
      {locating ? (
        <LocationDialog
          onClose={() => setLocating(false)}
          onConfirm={(lat, lng) => {
            setLocating(false)
            onSend({ type: "location", lat, lng })
          }}
        />
      ) : null}
    </>
  )
}

export default Composer
