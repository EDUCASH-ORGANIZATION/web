/**
 * Checklist des règles de mot de passe, annoncée en direct.
 * @param {{
 *   rules: { key?: string, id?: string, label: string, test: (value: string) => boolean }[],
 *   value?: string,
 *   showErrors?: boolean,
 *   id?: string,
 * }} props `showErrors` : marque en erreur les règles non remplies (après un envoi).
 */
export function PasswordChecklist({ rules, value = "", showErrors = false, id }) {
  return (
    <ul className="checklist" id={id} aria-live="polite">
      {rules.map((rule) => {
        const ok = value ? rule.test(value) : false
        const state = ok ? "is-ok" : showErrors ? "is-ko" : ""
        return (
          <li key={rule.key ?? rule.id ?? rule.label} className={state || undefined}>
            {rule.label}
            <span className="sr-only">{ok ? " : respecté" : " : manquant"}</span>
          </li>
        )
      })}
    </ul>
  )
}
