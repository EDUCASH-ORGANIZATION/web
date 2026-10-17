"use client"

// @ds-screen RD-STUDENT-01
// Éléments communs des vues de demande de paiement d'achats (RD-ACHATS-01 ST-05) : vignette de preuve, zone de
// prise de photo du formulaire, bandeau d'erreur. Vues pures : aucune donnée lue ici.
import { useId, useRef } from "react"
import { Icon } from "@/components/design/icon"
import { Enlargeable } from "@/components/messaging/image-viewer"
import { PROOF_MIME_TYPES } from "@/lib/purchases/proofs"

export const PROOF_ACCEPT = PROOF_MIME_TYPES.join(",")

const cx = (...parts) => parts.filter(Boolean).join(" ")

/** Vignette d'une preuve : la photo (adresse signée fournie par la page, agrandie au clic) ou, à défaut, l'icône de sa nature. */
export function Thumb({ url, icon, caption, noun, kind, variant, tag, onPhotoError }) {
  return (
    <figure className="e-thumb">
      <span className={cx("e-thumb__img", variant && `e-thumb__img--${variant}`)}>
        {url ? (
          <Enlargeable url={url} caption={caption} label={`Agrandir la photo ${noun}`} onError={onPhotoError && (() => onPhotoError(kind))}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="e2-07-pic" src={url} alt="" loading="lazy" onError={onPhotoError && (() => onPhotoError(kind))} />
          </Enlargeable>
        ) : (
          <Icon name={icon} />
        )}
        {tag ? <span className="e-thumb__tag">{tag}</span> : null}
      </span>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

/**
 * Zone de prise de photo. `photo` : { name, previewUrl } une fois la photo envoyée, `uploading` pendant l'envoi,
 * `error` sous la zone. `onPick(file)` reçoit le fichier choisi (le contrôle de taille et de format est fait par
 * la fenêtre).
 */
export function PhotoShot({ label, placeholderTitle, placeholderHelp, icon, thumbVariant, photo, uploading, error, disabled, onPick }) {
  const uid = useId()
  const labelId = `${uid}-label`
  const errorId = error ? `${uid}-error` : undefined
  const input = useRef(null)
  const done = Boolean(photo) && !uploading
  const action = done ? "Reprendre" : "Photo"

  return (
    <div className="field" role="group" aria-labelledby={labelId} aria-describedby={errorId}>
      <span className="field__label" id={labelId}>
        {label}
        <span className="req" aria-hidden="true">*</span>
      </span>
      <div className={cx("e-shot e2-07-shot", done && "e-shot--ok", error && "e-shot--error")}>
        {done ? (
          <span className={cx("e-thumb__img", thumbVariant && `e-thumb__img--${thumbVariant}`)}>
            {photo.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="e2-07-pic" src={photo.previewUrl} alt="" />
            ) : (
              <Icon name={icon} />
            )}
          </span>
        ) : (
          <span className="e2-07-ic">
            <Icon name="i-image" />
          </span>
        )}
        <div className="e-shot__txt">
          {uploading ? (
            <b role="status">Envoi de la photo en cours...</b>
          ) : done ? (
            <b>{photo.name || "Photo ajoutée"}</b>
          ) : (
            <>
              <b>{placeholderTitle}</b>
              {placeholderHelp}
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn--soft btn--sm"
          disabled={disabled || uploading}
          aria-label={`${action} : ${label}`}
          onClick={() => input.current?.click()}
        >
          {done ? null : <Icon name="i-image" />}
          {action}
        </button>
        <input
          ref={input}
          type="file"
          accept={PROOF_ACCEPT}
          hidden
          tabIndex={-1}
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onPick(file)
          }}
        />
      </div>
      {error ? (
        <div id={errorId} className="field__error" role="alert">
          <Icon name="i-alert-circle" />
          {error}
        </div>
      ) : null}
    </div>
  )
}

/** Bandeau d'erreur d'une fenêtre (échec d'envoi). */
export function ErrorBanner({ title, children }) {
  return (
    <div className="banner banner--erreur" role="alert">
      <Icon name="i-alert-triangle" />
      <div className="banner__body">
        <div className="banner__title">{title}</div>
        {children}
      </div>
    </div>
  )
}
