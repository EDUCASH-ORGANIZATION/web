"use client"

import { useEffect, useState } from "react"

/** 58 -> "0:58", 292 -> "4:52". */
export function formatCountdown(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * Bouton de renvoi avec compte à rebours. Au clic : appelle `onClick` puis bloque le bouton
 * pendant `seconds`. Le temps restant est annoncé aux lecteurs d'écran toutes les 15 s.
 * @param {{
 *   seconds?: number,
 *   label: string,
 *   runningLabel?: (formatted: string) => string,
 *   onClick?: () => (void | Promise<void>),
 *   autoStart?: boolean,
 *   restartKey?: string | number,
 *   disabled?: boolean,
 *   className?: string,
 * }} props `restartKey` : relance le compte à rebours quand la valeur change.
 */
export function CountdownButton({
  seconds = 60,
  label,
  runningLabel = (formatted) => `Renvoyer dans ${formatted}`,
  onClick,
  autoStart = false,
  restartKey,
  disabled = false,
  className = "btn btn--secondary btn--sm",
}) {
  const [remaining, setRemaining] = useState(autoStart ? seconds : 0)
  const [busy, setBusy] = useState(false)
  const [startKey, setStartKey] = useState(restartKey)

  if (restartKey !== startKey) {
    setStartKey(restartKey)
    setRemaining(seconds)
  }

  useEffect(() => {
    if (remaining <= 0) return undefined
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  async function handleClick() {
    if (busy || remaining > 0) return
    setBusy(true)
    try {
      await onClick?.()
    } finally {
      setBusy(false)
      setRemaining(seconds)
    }
  }

  const running = remaining > 0
  const announce = running && remaining % 15 === 0 ? runningLabel(formatCountdown(remaining)) : ""

  return (
    <>
      <button className={className} type="button" disabled={disabled || running || busy} onClick={handleClick}>
        {running ? runningLabel(formatCountdown(remaining)) : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </>
  )
}
