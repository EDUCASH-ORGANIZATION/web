"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import {
  INSTALL_SNOOZE_MS,
  INSTALL_STORAGE_KEY,
  decideInstallPrompt,
  installCopy,
  isIosSafariAgent,
  parseInstallState,
  remainingSessionDelay,
} from "./install-prompt-logic"

const VISIT_FLAG = "educash:install-prompt:visit-counted"

function readState() {
  return parseInstallState(window.localStorage.getItem(INSTALL_STORAGE_KEY))
}

function writeState(patch) {
  const next = { ...readState(), ...patch }
  window.localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(next))
  return next
}

function countVisitOnce() {
  if (window.sessionStorage.getItem(VISIT_FLAG)) return
  window.sessionStorage.setItem(VISIT_FLAG, "1")
  writeState({ visits: readState().visits + 1 })
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
}

function isMobileDevice() {
  return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1023px)").matches
}

// Invitation discrète, rendue dans le flux de la page (jamais en superposition)
// pour ne masquer ni la barre de navigation mobile ni les boutons d'action.
export function PwaInstallBanner({ space }) {
  const [mode, setMode] = useState(null)
  const promptRef = useRef(null)
  const startRef = useRef(0)

  useEffect(() => {
    startRef.current = Date.now()
    let timer = null
    let disposed = false

    const evaluate = () => {
      if (disposed) return
      try {
        const decision = decideInstallPrompt({
          space,
          isMobile: isMobileDevice(),
          standalone: isStandalone(),
          hasNativePrompt: promptRef.current !== null,
          isIosSafari: isIosSafariAgent(window.navigator.userAgent),
          state: readState(),
          sessionMs: Date.now() - startRef.current,
        })
        setMode(decision.show ? decision.mode : null)
      } catch {
        setMode(null)
      }
    }

    try {
      countVisitOnce()
    } catch {
      // stockage indisponible : l'invitation reste simplement masquée
      return undefined
    }

    const onPrompt = (event) => {
      event.preventDefault()
      promptRef.current = event
      evaluate()
    }
    const onInstalled = () => {
      promptRef.current = null
      try {
        writeState({ installed: true })
      } catch {
        // sans importance
      }
      setMode(null)
    }

    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    evaluate()
    const delay = remainingSessionDelay(0)
    if (delay > 0) timer = window.setTimeout(evaluate, delay)

    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [space])

  const copy = installCopy(space)
  if (!mode || !copy) return null

  const handleInstall = async () => {
    const prompt = promptRef.current
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    promptRef.current = null
    if (outcome === "accepted") {
      writeState({ installed: true })
    }
    setMode(null)
  }

  const handleLater = () => {
    writeState({ snoozedUntil: Date.now() + INSTALL_SNOOZE_MS })
    setMode(null)
  }

  const handleClose = () => {
    writeState({ dismissed: true })
    setMode(null)
  }

  return (
    <section className="card card--sm card--soft ds-install" aria-label={copy.title}>
      <span className="toast__icon ds-install__icon">
        <Icon name="i-download" className="ic" />
      </span>
      <div className="ds-install__body">
        <p className="ds-install__title">{copy.title}</p>
        <p className="ds-install__text">{mode === "ios" ? copy.ios : copy.native}</p>
        <div className="ds-install__actions">
          {mode === "native" && (
            <button type="button" className="btn btn--primary btn--sm" onClick={handleInstall}>
              {copy.install}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLater}>
            {copy.later}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="btn-icon btn-icon--sm btn-icon--plain ds-install__close"
        onClick={handleClose}
        aria-label={copy.close}
      >
        <Icon name="i-x" className="ic" />
      </button>
    </section>
  )
}
