import { Icon } from "@/components/design/icon"

/**
 * Message d'erreur sous un champ (`.field__error`). Ne rend rien sans message.
 * @param {{ id?: string, message?: string }} props
 */
export function FieldError({ id, message }) {
  if (!message) return null
  return (
    <span className="field__error" id={id} role="alert">
      <Icon name="i-alert-circle" />
      {message}
    </span>
  )
}
