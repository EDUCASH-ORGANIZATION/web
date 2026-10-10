import { Icon } from "@/components/design/icon"
import { Select } from "@/components/design/select"
import { FieldError } from "@/components/auth/ui/field-error"
import { PhoneInput } from "@/components/auth/ui/phone-input"
import { CITIES } from "@/lib/supabase/database.constants"
import { CLIENT_TYPE_OPTIONS } from "./step-type"

const CITY_OPTIONS = CITIES.map((city) => ({ value: city, label: city }))

// Libellés de l'étape 2 selon le type : le nom saisi est celui du client ou de sa structure.
export const IDENTITY_COPY = {
  particulier: { name: "Nom complet", placeholder: "Ex. Rosine Houngbédji", visual: "Photo", add: "Ajouter une photo", emptyIcon: "i-user" },
  pme: { name: "Nom de l'entreprise", placeholder: "Ex. Boutique Mawuena", visual: "Logo", add: "Ajouter un logo", emptyIcon: "i-building" },
  association: { name: "Nom de l'association", placeholder: "Ex. Association Espoir", visual: "Logo", add: "Ajouter un logo", emptyIcon: "i-users" },
}

/**
 * Étape 2 : identité adaptée au type choisi, logo facultatif, ville et téléphone.
 * @param {{
 *   type: string,
 *   values: { name: string, city: string, phone: string },
 *   errors: Record<string, string>,
 *   logoPreview?: string,
 *   logoInputRef?: React.Ref<HTMLInputElement>,
 *   onChange: (field: "name" | "city" | "phone", value: string) => void,
 *   onChangeType: () => void,
 *   onPickLogo: () => void,
 *   onLogoChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   onRemoveLogo: () => void,
 * }} props
 */
export function StepIdentity({
  type,
  values,
  errors,
  logoPreview,
  logoInputRef,
  onChange,
  onChangeType,
  onPickLogo,
  onLogoChange,
  onRemoveLogo,
}) {
  const copy = IDENTITY_COPY[type] ?? IDENTITY_COPY.particulier
  const option = CLIENT_TYPE_OPTIONS.find((item) => item.value === type) ?? CLIENT_TYPE_OPTIONS[0]

  return (
    <>
      <div className="row">
        <span className="badge badge--contour">
          <Icon name={option.icon} />
          {option.title}
        </span>
        <button className="link body-s" type="button" onClick={onChangeType}>
          Changer
        </button>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="co-name">
          {copy.name} <span className="req">*</span>
        </label>
        <input
          className={`input${errors.name ? " is-error" : ""}`}
          id="co-name"
          name="name"
          autoComplete="organization"
          placeholder={copy.placeholder}
          value={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "co-name-error" : undefined}
          onChange={(event) => onChange("name", event.target.value)}
        />
        <FieldError id="co-name-error" message={errors.name} />
      </div>

      <div className="field">
        <span className="field__label">
          {copy.visual} <span className="opt">facultatif</span>
        </span>
        <div className="a-photo">
          <span className="avatar avatar--lg avatar--empty">
            {logoPreview ? (
              // Aperçu local (blob) : next/image ne s'applique pas.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="h-full w-full rounded-full object-cover" src={logoPreview} alt="Aperçu" />
            ) : (
              <Icon name={copy.emptyIcon} />
            )}
          </span>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onPickLogo}>
            <Icon name="i-image" />
            {copy.add}
          </button>
          {logoPreview && (
            <button className="link body-s" type="button" onClick={onRemoveLogo}>
              Retirer
            </button>
          )}
          <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onLogoChange} />
        </div>
        <FieldError id="co-logo-error" message={errors.avatarUrl} />
      </div>

      <div className="field">
        <label className="field__label" id="co-city-label" htmlFor="co-city">
          Ville <span className="req">*</span>
        </label>
        <Select
          id="co-city"
          name="city"
          options={CITY_OPTIONS}
          value={values.city}
          onChange={(value) => onChange("city", value)}
          placeholder="Choisir une ville"
          aria-labelledby="co-city-label"
          aria-describedby={errors.city ? "co-city-error" : undefined}
          invalid={Boolean(errors.city)}
          required
        />
        <FieldError id="co-city-error" message={errors.city} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="co-phone">
          Téléphone <span className="req">*</span>
        </label>
        <PhoneInput
          id="co-phone"
          value={values.phone}
          invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "co-phone-error" : "co-phone-help"}
          onChange={(event) => onChange("phone", event.target.value)}
        />
        {errors.phone ? (
          <FieldError id="co-phone-error" message={errors.phone} />
        ) : (
          <span className="field__help" id="co-phone-help">
            10 chiffres, commence par 01. Visible seulement par l&apos;étudiant retenu.
          </span>
        )}
      </div>
    </>
  )
}
