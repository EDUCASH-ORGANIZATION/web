/**
 * Téléphone béninois : préfixe +229 affiché (`.control__prefix`), saisie de 10 chiffres
 * (01 97 45 21 08). Les props restantes vont sur l'<input> (compatible `register()`).
 * @param {{ id: string, invalid?: boolean, disabled?: boolean } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export function PhoneInput({ id, invalid = false, disabled = false, className = "", ...rest }) {
  return (
    <div className={`control${invalid ? " is-error" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <span className="control__prefix">+229</span>
      <input
        name="phone"
        placeholder="01 97 45 21 08"
        {...rest}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={20}
        disabled={disabled}
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}
