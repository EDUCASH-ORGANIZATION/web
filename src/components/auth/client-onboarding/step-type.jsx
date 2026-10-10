import { ChoiceCard } from "@/components/auth/ui/choice-card"
import { FieldError } from "@/components/auth/ui/field-error"

/** Types de client proposés à l'étape 1 (valeurs de `CLIENT_TYPES`). */
export const CLIENT_TYPE_OPTIONS = [
  { value: "particulier", title: "Particulier", sub: "Un besoin ponctuel à la maison", icon: "i-user", tone: "" },
  { value: "pme", title: "PME ou entreprise", sub: "Des missions pour votre activité", icon: "i-building", tone: "menthe" },
  { value: "association", title: "Association", sub: "Des projets associatifs ou solidaires", icon: "i-users", tone: "lavande" },
]

/**
 * Étape 1 : type de compte (groupe radio).
 * @param {{ value: string, error?: string, onChange: (value: string) => void }} props
 */
export function StepType({ value, error, onChange }) {
  return (
    <div className="field" role="radiogroup" aria-label="Type de compte" aria-describedby={error ? "co-type-error" : undefined}>
      <span className="field__label">
        Vous êtes <span className="req">*</span>
      </span>
      <div className="stack stack--3">
        {CLIENT_TYPE_OPTIONS.map((option) => (
          <ChoiceCard
            key={option.value}
            title={option.title}
            sub={option.sub}
            icon={option.icon}
            tone={option.tone}
            selected={value === option.value}
            invalid={Boolean(error)}
            onSelect={() => onChange(option.value)}
          />
        ))}
      </div>
      <FieldError id="co-type-error" message={error} />
    </div>
  )
}
