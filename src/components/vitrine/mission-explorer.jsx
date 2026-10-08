"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { useModalFocus } from "@/hooks/use-modal-focus"
import { TYPE_ICON } from "@/lib/vitrine/mission-icons"
import {
  MISSION_TYPES, CITIES, BUDGET_RANGES, SORTS, URGENCY_FILTERS, SEARCH_MAX_LENGTH,
} from "@/lib/constants/missions"

const CLEARED = { q: "", type: "", ville: "", budget: "", tri: "", urgence: "" }

function useMissionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const navigate = useCallback((next) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? {})
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v)
      else sp.delete(k)
    })
    sp.delete("page")
    const qs = sp.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }, [router, pathname, searchParams])

  return { navigate, isPending }
}

const cx = (...parts) => parts.filter(Boolean).join(" ")

// Barre de recherche et chips de type posées sur le bandeau bleu (maquette V02).
export function MissionSearch({ q = "", type = "", ville = "" }) {
  const { navigate } = useMissionFilters()
  const [city, setCity] = useState(ville)
  const [syncedVille, setSyncedVille] = useState(ville)
  if (ville !== syncedVille) {
    setSyncedVille(ville)
    setCity(ville)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    navigate({ q: data.get("q").toString().trim(), ville: city })
  }

  return (
    <>
      <form role="search" className="search search--hero v02-search ds-desk-only" onSubmit={onSubmit}>
        <Icon name="i-search" className="ic" />
        <label className="sr-only" htmlFor="mission-q">Rechercher une mission</label>
        <input
          key={q}
          id="mission-q"
          name="q"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Cours de maths, livraison, saisie…"
          defaultValue={q}
        />
        <label className="search__city ds-chip-select">
          <Icon name="i-map-pin" className="ic ic--16" />
          <span>{city || "Toutes les villes"}</span>
          <Icon name="i-chevron-down" className="ic ic--16" />
          <select name="ville" aria-label="Ville" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Toutes les villes</option>
            {CITIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn--primary btn--sm">Chercher</button>
      </form>

      <form role="search" className="search v02-search-m ds-mob-only" onSubmit={onSubmit}>
        <Icon name="i-search" className="ic" />
        <label className="sr-only" htmlFor="mission-q-m">Rechercher une mission</label>
        <input
          key={q}
          id="mission-q-m"
          name="q"
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Cours, livraison, saisie…"
          defaultValue={q}
        />
      </form>

      <div className="v02-types chips chips--scroll on-bleu">
        <button
          type="button"
          className={cx("chip", !type && "is-selected")}
          aria-pressed={!type}
          onClick={() => navigate({ type: "" })}
        >
          Toutes
        </button>
        {MISSION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={cx("chip", type === t && "is-selected")}
            aria-pressed={type === t}
            onClick={() => navigate({ type: type === t ? "" : t })}
          >
            <Icon name={TYPE_ICON[t] ?? "i-briefcase"} className="ic" />
            {t}
          </button>
        ))}
      </div>
    </>
  )
}

// Chip déroulant : le libellé affiche la valeur choisie, le select natif le recouvre.
function ChipSelect({ icon, label, ariaLabel, value, selected, onChange, small = false, children }) {
  return (
    <label className={cx("chip chip--dropdown ds-chip-select", small && "chip--sm", selected && "is-selected")}>
      <Icon name={icon} className="ic" />
      <span>{label}</span>
      <select aria-label={ariaLabel} value={value} onChange={onChange}>{children}</select>
    </label>
  )
}

function OptionChips({ options, value, onPick }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={cx("chip chip--sm", value === o.id && "is-selected")}
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
        >
          {o.icon ? <Icon name={o.icon} className="ic" /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Barre de filtres (maquette V02) : puces déroulantes en bureau, bouton « Filtres »
// et feuille du bas en mobile, pastilles de filtres actifs supprimables.
export function MissionFilterBar({
  q = "", type = "", ville = "", budget = "", tri = "", urgence = "",
  total = 0, countLabel = "", countShort = "",
}) {
  const { navigate, isPending } = useMissionFilters()
  const [sheetOpen, setSheetOpen] = useState(false)

  const filtersButtonRef = useRef(null)
  const sheetRef = useRef(null)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  useModalFocus({
    active: sheetOpen,
    containerRef: sheetRef,
    returnFocusRef: filtersButtonRef,
    onClose: closeSheet,
  })

  const budgetRange = BUDGET_RANGES.find((b) => b.id === budget)
  const urgency = URGENCY_FILTERS.find((u) => u.id === urgence)
  const sort = SORTS.find((s) => s.id === tri) ?? SORTS[0]
  const hasFilter = Boolean(q || type || ville || budget || tri || urgence)
  const sheetFilterCount = [ville, budget, urgence].filter(Boolean).length

  const pills = [
    q && { key: "q", label: `« ${q} »` },
    type && { key: "type", label: type },
    ville && { key: "ville", label: ville },
    budgetRange && { key: "budget", label: budgetRange.label },
    urgency && { key: "urgence", label: urgency.label },
    tri && { key: "tri", label: sort.label },
  ].filter(Boolean)

  const sortSelect = (small) => (
    <ChipSelect
      icon="i-sort"
      label={small ? sort.short : sort.label}
      ariaLabel="Tri"
      value={tri}
      selected={false}
      small={small}
      onChange={(e) => navigate({ tri: e.target.value })}
    >
      {SORTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
    </ChipSelect>
  )

  const count = (
    <span className="filterbar__count" aria-live="polite">{countLabel}</span>
  )

  return (
    <>
      <div className="filterbar ds-desk-only">
        <ChipSelect
          icon="i-map-pin" label={ville || "Ville"} ariaLabel="Ville" value={ville} selected={Boolean(ville)}
          onChange={(e) => navigate({ ville: e.target.value })}
        >
          <option value="">Toutes les villes</option>
          {CITIES.map((v) => <option key={v} value={v}>{v}</option>)}
        </ChipSelect>
        <ChipSelect
          icon="i-banknote" label={budgetRange?.label ?? "Budget"} ariaLabel="Budget" value={budget} selected={Boolean(budget)}
          onChange={(e) => navigate({ budget: e.target.value })}
        >
          <option value="">Tous budgets</option>
          {BUDGET_RANGES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </ChipSelect>
        <ChipSelect
          icon="i-zap" label={urgency?.label ?? "Urgence"} ariaLabel="Urgence" value={urgence} selected={Boolean(urgence)}
          onChange={(e) => navigate({ urgence: e.target.value })}
        >
          <option value="">Toutes urgences</option>
          {URGENCY_FILTERS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </ChipSelect>
        {sortSelect(false)}
        {count}
      </div>

      <div className="v02-mbar ds-mob-only">
        <button
          ref={filtersButtonRef}
          type="button"
          className="btn btn--dark btn--sm"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="i-filter" className="ic" />Filtres
          {sheetFilterCount > 0 && <span className="count count--citron">{sheetFilterCount}</span>}
        </button>
        {sortSelect(true)}
        <span className="ds-grow" />
        <span className="caption" aria-live="polite">{countShort || countLabel}</span>
      </div>

      {pills.length > 0 && (
        <div className="row">
          <span className="caption ds-strong">Filtres actifs :</span>
          {pills.map((p) => (
            <button
              key={p.key}
              type="button"
              className="chip chip--sm chip--remove"
              aria-label={`Retirer le filtre ${p.label}`}
              onClick={() => navigate({ [p.key]: "" })}
            >
              {p.label}<Icon name="i-x" className="ic" />
            </button>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(CLEARED)}>
            Effacer les filtres
          </button>
        </div>
      )}

      {isPending && <span className="filterbar__count muted" role="status">Chargement…</span>}

      {sheetOpen && (
        <div className="scrim scrim--bottom ds-scrim-fixed" onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}>
          <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label="Filtres">
            <div className="sheet__grip" />
            <div className="modal__head">
              <div>
                <div className="modal__title">Filtres</div>
                <div className="modal__sub">{countLabel}</div>
              </div>
              <button type="button" className="btn-icon btn-icon--sm" aria-label="Fermer" onClick={closeSheet}>
                <Icon name="i-x" className="ic" />
              </button>
            </div>
            <div className="modal__body">
              <div className="field">
                <span className="field__label">Ville</span>
                <OptionChips
                  options={[{ id: "", label: "Toutes" }, ...CITIES.map((v) => ({ id: v, label: v }))]}
                  value={ville}
                  onPick={(v) => navigate({ ville: v })}
                />
              </div>
              <div className="field">
                <span className="field__label">Budget</span>
                <OptionChips
                  options={[{ id: "", label: "Tous" }, ...BUDGET_RANGES]}
                  value={budget}
                  onPick={(v) => navigate({ budget: v })}
                />
              </div>
              <div className="field">
                <span className="field__label">Urgence</span>
                <OptionChips
                  options={[{ id: "", label: "Toutes" }, ...URGENCY_FILTERS.map((u) => ({ ...u, icon: "i-zap" }))]}
                  value={urgence}
                  onPick={(v) => navigate({ urgence: v })}
                />
              </div>
            </div>
            <div className="modal__foot">
              {hasFilter && (
                <button type="button" className="btn btn--ghost" onClick={() => navigate(CLEARED)}>Effacer les filtres</button>
              )}
              <button type="button" className="btn btn--primary" onClick={closeSheet}>
                {total > 0 ? `Voir les ${total} mission${total > 1 ? "s" : ""}` : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
