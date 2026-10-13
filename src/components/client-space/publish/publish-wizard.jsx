"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { PageHead } from "@/components/app-ui/page-head"
import { ErrorState } from "@/components/app-ui/state-block"
import { ResumePublishBanner } from "@/components/client-space/wallet/resume-publish-banner"
import { createMission } from "@/lib/actions/mission.actions"
import { clientMissionHref, clientMissionsHref, clientPublishHref } from "@/lib/app/client-routes"
import { formatAmount } from "@/lib/app/format"
import { PUBLISH_RESUME_KEY } from "@/lib/utils/publish-prefill"
import { STEPS, validatePublish, validateStep } from "@/lib/client-space/publish-schema"
import { BudgetAside, StepBudget, StepDetails, StepNeed, TipsAside } from "./steps"
import { PreviewCard, RecapBody, WalletImpact } from "./publish-recap"
import { InsufficientDialog } from "./insufficient-dialog"

const ERR_NETWORK =
  "La connexion a été interrompue. Avant de réessayer, vérifiez dans Mes missions si votre mission a bien été publiée."

const ERR_FUNDS = "Votre solde ne permet pas de publier cette mission. Rechargez votre portefeuille, puis réessayez."

const LAST_STEP = STEPS.length

/**
 * Publie une mission, avec verrou contre le double envoi. Fonction à dépendances injectées : `create` est
 * `createMission`, `lock` un objet `{ current: boolean }` (une ref). Le verrou reste pris après un succès
 * (la page change) et se libère après un refus, pour permettre de réessayer.
 * Résultats : `busy` (une publication est déjà en cours), `invalid`, `insufficient`, `error`, `success`.
 * @param {{ values: object, today: string, create: (data: object) => Promise<object>, lock: { current: boolean } }} input
 */
export async function runPublish({ values, today, create, lock }) {
  if (lock.current) return { kind: "busy" }
  const check = validatePublish(values, today)
  if (!check.ok) return { kind: "invalid", errors: check.errors, step: check.firstStep }
  lock.current = true
  try {
    const result = await create(check.data)
    if (typeof result?.id === "string" && result.id) return { kind: "success", id: result.id }
    lock.current = false
    if (result?.error === "wallet_insufficient") {
      const shortfall = Math.ceil(Number(result.shortfall))
      if (Number.isFinite(shortfall) && shortfall > 0) {
        const available = Number(result.available)
        return {
          kind: "insufficient",
          shortfall,
          available: Number.isFinite(available) ? available : null,
          required: check.data.budget,
        }
      }
      return { kind: "error", error: ERR_FUNDS }
    }
    return { kind: "error", error: typeof result?.error === "string" && result.error ? result.error : ERR_NETWORK }
  } catch {
    lock.current = false
    return { kind: "error", error: ERR_NETWORK }
  }
}

// La publication a abouti : le lien de reprise mémorisé n'a plus d'objet.
function forgetResume() {
  try {
    window.sessionStorage.removeItem(PUBLISH_RESUME_KEY)
  } catch {
    // stockage indisponible : rien à oublier
  }
}

function visible(node) {
  return Boolean(node) && node.getClientRects().length > 0
}

function Stepper({ step }) {
  return (
    <div className="stepper wizard2__stepper" role="group" aria-label={`Étape ${step} sur ${LAST_STEP}`}>
      {STEPS.map((s, index) => {
        const state = s.id < step ? "is-done" : s.id === step ? "is-current" : ""
        return (
          <Fragment key={s.id}>
            <div className={`step ${state}`} aria-current={s.id === step ? "step" : undefined}>
              <span className="step__dot">{s.id < step ? <Icon name="i-check" /> : s.id}</span>
              <span className="step__label">{s.label}</span>
            </div>
            {index < STEPS.length - 1 ? <span className={s.id < step ? "step__line is-done" : "step__line"} /> : null}
          </Fragment>
        )
      })}
    </div>
  )
}

function StepBar({ step }) {
  return (
    <div className="mstep2">
      <span>
        Étape {step} sur {LAST_STEP} · {STEPS[step - 1].label}
      </span>
      <div className="progress" role="presentation">
        <i className="wizard2__progress" data-step={step} />
      </div>
    </div>
  )
}

/**
 * Vue pure de l'assistant : tout l'état vient de l'extérieur (étape, valeurs, erreurs, envoi, solde insuffisant).
 * `errors` : erreurs de champ de l'étape affichée ; `serverError` : refus du serveur, la saisie est conservée.
 */
export function PublishWizardView({
  step, values, errors, available, today, pending, serverError, insufficient, resumeHref, formId,
  formRef, footRef, barRef, onChange, onSubmit, onBack, onEdit, onCloseInsufficient,
}) {
  const publishLabel = values.budget ? `Publier et bloquer ${formatAmount(values.budget)}` : "Publier"
  const primaryLabel = step < LAST_STEP ? "Continuer" : pending ? "Publication en cours" : publishLabel
  const primaryIcon = step < LAST_STEP ? "i-arrow-right" : pending ? null : "i-arrow-right"

  const primary = (ref) => (
    <button
      key={`primary-${step}`}
      ref={ref}
      type="submit"
      form={formId}
      className="btn btn--dark"
      disabled={pending}
      aria-busy={pending ? "true" : undefined}
    >
      {primaryLabel}
      {primaryIcon ? <Icon name={primaryIcon} /> : null}
    </button>
  )
  const back = (
    <button key={`back-${step}`} type="button" className="btn btn--soft" onClick={onBack} disabled={pending}>
      <Icon name="i-arrow-left" />
      Retour
    </button>
  )

  return (
    <div className="wizard2">
      {insufficient ? <ResumePublishBanner mode="store" href={resumeHref} /> : null}
      <PageHead
        date="Rien n'est bloqué avant la publication"
        title="Publier une mission"
        actions={
          <Link className="link2" href={clientMissionsHref()}>
            Quitter sans publier
          </Link>
        }
      />
      <Stepper step={step} />
      <StepBar step={step} />
      <div className="split2">
        <form
          id={formId}
          ref={formRef}
          className="card2 form2"
          aria-label={STEPS[step - 1].label}
          tabIndex={-1}
          noValidate
          onSubmit={onSubmit}
        >
          {step === 1 ? <StepNeed values={values} errors={errors} onChange={onChange} /> : null}
          {step === 2 ? <StepDetails values={values} errors={errors} onChange={onChange} /> : null}
          {step === 3 ? <StepBudget values={values} errors={errors} today={today} onChange={onChange} /> : null}
          {step === LAST_STEP ? <RecapBody values={values} onEdit={onEdit} disabled={pending} /> : null}
          {serverError ? (
            <div className="banner banner--erreur" role="alert">
              <Icon name="i-alert-circle" />
              <div className="banner__body">{serverError}</div>
            </div>
          ) : null}
          <div className="form2__foot form2__foot--split">
            {step > 1 ? back : <span />}
            {primary(footRef)}
          </div>
        </form>
        <div className="col2">
          {step <= 2 ? <TipsAside step={step} /> : null}
          {step === 3 ? <BudgetAside budget={values.budget} /> : null}
          {step === LAST_STEP ? (
            <>
              <PreviewCard values={values} />
              <WalletImpact available={available} budget={values.budget} />
            </>
          ) : null}
        </div>
      </div>
      <div className="mbar2">
        <div className="mbar2__row">
          {step > 1 ? back : null}
          {primary(barRef)}
        </div>
      </div>
      <InsufficientDialog
        open={Boolean(insufficient)}
        shortfall={insufficient?.shortfall ?? 0}
        available={insufficient?.available ?? null}
        required={insufficient?.required ?? 0}
        onClose={onCloseInsufficient}
      />
    </div>
  )
}
/**
 * Assistant de publication en quatre étapes (C03). Le brouillon n'est pas enregistré : on rédige sans solde,
 * le solde n'est vérifié qu'à la publication (`createMission`, qui reste l'autorité côté serveur).
 * N'existe que si les paiements sont ouverts : la page rend `PublishPausedView` sinon.
 * @param {{
 *   initial: import("@/lib/client-space/publish-schema").PublishValues,
 *   duplicateId?: string,
 *   available: number|null,
 *   today: string,
 *   error?: string,
 * }} props
 */
export function PublishWizard({ initial, duplicateId = "", available, today, error: loadError }) {
  const router = useRouter()
  const formId = useId()
  const formRef = useRef(null)
  const footRef = useRef(null)
  const barRef = useRef(null)
  const focusRequest = useRef(null)
  const lock = useRef(false)

  const [values, setValues] = useState(initial)
  const [step, setStep] = useState(1)
  const [attempted, setAttempted] = useState([])
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [insufficient, setInsufficient] = useState(null)

  // Après un changement d'étape ou une tentative refusée : le focus va sur le premier champ en erreur
  // ou sur la carte de l'étape (annoncée par son nom).
  useEffect(() => {
    const request = focusRequest.current
    if (!request) return
    focusRequest.current = null
    const form = formRef.current
    if (request === "invalid") form?.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.focus()
    else form?.focus()
  })

  if (loadError) {
    return (
      <div className="page2">
        <ErrorState titleAs="h1" title="Impossible de charger la publication" />
      </div>
    )
  }

  const errors = attempted.includes(step) ? validateStep(step, values, today) : {}
  const resumeHref = clientPublishHref({ duplicate: duplicateId, besoin: values.title, ville: values.city, type: values.type })

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setServerError(null)
  }

  function goTo(target) {
    setStep(target)
    setServerError(null)
    focusRequest.current = "card"
  }

  function advance() {
    if (Object.keys(validateStep(step, values, today)).length > 0) {
      setAttempted((list) => [...list, step])
      focusRequest.current = "invalid"
      return
    }
    goTo(step + 1)
  }

  async function publish() {
    if (lock.current) return
    setServerError(null)
    setPending(true)
    const outcome = await runPublish({ values, today, create: createMission, lock })
    if (outcome.kind === "busy") return
    if (outcome.kind === "success") {
      // Le verrou et l'état « en cours » restent en place jusqu'au changement de page.
      forgetResume()
      router.push(clientMissionHref(outcome.id, { publiee: true }))
      return
    }
    setPending(false)
    if (outcome.kind === "invalid") {
      setAttempted([1, 2, 3])
      setStep(outcome.step)
      focusRequest.current = "invalid"
    } else if (outcome.kind === "insufficient") {
      setInsufficient(outcome)
    } else {
      setServerError(outcome.error)
    }
  }

  function submit(event) {
    event.preventDefault()
    if (pending) return
    if (step < LAST_STEP) advance()
    else publish()
  }

  function closeInsufficient() {
    setInsufficient(null)
    // Le bouton de publication était inactif à l'ouverture : on lui rend le focus, celui des deux qui est affiché.
    setTimeout(() => {
      const target = [footRef.current, barRef.current].find(visible)
      target?.focus()
    }, 0)
  }

  return (
    <PublishWizardView
      step={step}
      values={values}
      errors={errors}
      available={available}
      today={today}
      pending={pending}
      serverError={serverError}
      insufficient={insufficient}
      resumeHref={resumeHref}
      formId={formId}
      formRef={formRef}
      footRef={footRef}
      barRef={barRef}
      onChange={change}
      onSubmit={submit}
      onBack={() => goTo(step - 1)}
      onEdit={goTo}
      onCloseInsufficient={closeInsufficient}
    />
  )
}
