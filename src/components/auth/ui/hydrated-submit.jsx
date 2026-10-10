"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/** Faux côté serveur et pendant l'hydratation, vrai ensuite. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

/**
 * Bouton d'envoi inactif tant que la page n'est pas hydratée (aucun envoi natif possible
 * avant que le JavaScript soit prêt). `pending` : état de chargement, le bouton reste
 * actif visuellement mais ignore les clics.
 * @param {{ pending?: boolean, disabled?: boolean, className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function HydratedSubmit({
  children,
  pending = false,
  disabled = false,
  className = "btn btn--primary btn--lg btn--block",
  onClick,
  ...rest
}) {
  const hydrated = useHydrated()

  function handleClick(event) {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      {...rest}
      type="submit"
      className={`${className}${pending ? " is-loading" : ""}`}
      disabled={!hydrated || disabled}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      <span>{children}</span>
    </button>
  )
}
