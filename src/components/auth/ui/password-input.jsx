"use client"

import { useState } from "react"
import { Icon } from "@/components/design/icon"

const LABELS = {
  student: { show: "Afficher ton mot de passe", hide: "Masquer ton mot de passe" },
  client: { show: "Afficher votre mot de passe", hide: "Masquer votre mot de passe" },
}

/**
 * Champ mot de passe avec bouton œil (`.control`). Les props restantes vont sur l'<input>
 * (compatible `register()` de react-hook-form, `ref` inclus).
 * @param {{ id: string, audience?: "student" | "client", invalid?: boolean, disabled?: boolean } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export function PasswordInput({ id, audience = "student", invalid = false, disabled = false, className = "", ...rest }) {
  const [visible, setVisible] = useState(false)
  const labels = LABELS[audience === "client" ? "client" : "student"]

  return (
    <div className={`control${invalid ? " is-error" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <Icon name="i-key" />
      <input
        {...rest}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        aria-invalid={invalid || undefined}
      />
      <button
        className="control__btn"
        type="button"
        aria-label={visible ? labels.hide : labels.show}
        aria-controls={id}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon name={visible ? "i-eye-off" : "i-eye"} className="ic ic--20" />
      </button>
    </div>
  )
}
