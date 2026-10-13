// @ds-screen RD-STUDENT-01
"use client"

import Link from "next/link"
import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { BUDGET_RANGES, CITIES, SORTS, URGENCY_FILTERS } from "@/lib/constants/missions"
import { studentMissionsHref } from "@/lib/app/student-routes"

const EMPTY_FILTERS = { budget: "", cities: [], urgency: "" }

// Les trois filtres de la colonne et de la feuille ; q, type et tri restent ceux de l'URL.
const pickFilters = ({ budget, cities, urgency }) => ({ budget, cities, urgency })
const countFilters = ({ budget, cities, urgency }) => Number(Boolean(budget)) + cities.length + Number(Boolean(urgency))
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Navigation par l'URL : toute modification de filtre revient à la page 1.
function useExploreNavigation() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const go = (href) => startTransition(() => router.push(href, { scroll: false }))
  return { go, pending }
}

function Group({ id, title, children }) {
  return (
    <div className="e2-02-group" role="group" aria-labelledby={id}>
      <span className="e2-02-gtitle" id={id}>{title}</span>
      {children}
    </div>
  )
}

/**
 * Champs communs de la colonne (bureau) et de la feuille (mobile) : budget du client, villes, urgence.
 * `values` = { budget, cities, urgency } ; `onChange(patch)` reçoit le morceau modifié.
 */
function FilterFields({ idPrefix, values, onChange }) {
  const toggleCity = (city) =>
    onChange({ cities: values.cities.includes(city) ? values.cities.filter((c) => c !== city) : [...values.cities, city] })
  return (
    <>
      <Group id={`${idPrefix}-budget`} title="Budget du client">
        {[{ id: "", label: "Tous les budgets" }, ...BUDGET_RANGES].map((range) => (
          <label key={range.id || "all"} className="radio">
            <input
              type="radio"
              name={`${idPrefix}-budget`}
              checked={values.budget === range.id}
              onChange={() => onChange({ budget: range.id })}
            />
            {range.label}
          </label>
        ))}
      </Group>
      <Group id={`${idPrefix}-ville`} title="Ville">
        {CITIES.map((city) => (
          <label key={city} className="check">
            <input type="checkbox" checked={values.cities.includes(city)} onChange={() => toggleCity(city)} />
            {city}
          </label>
        ))}
      </Group>
      <Group id={`${idPrefix}-urgence`} title="Urgence">
        {[{ id: "", label: "Toutes" }, ...URGENCY_FILTERS].map((urgency) => (
          <label key={urgency.id || "all"} className="radio">
            <input
              type="radio"
              name={`${idPrefix}-urgence`}
              checked={values.urgency === urgency.id}
              onChange={() => onChange({ urgency: urgency.id })}
            />
            {urgency.label}
          </label>
        ))}
      </Group>
    </>
  )
}

/** Colonne de filtres du bureau : chaque choix s'applique tout de suite. `current` = filtres de l'URL. */
export function FiltersColumn({ current }) {
  const idPrefix = useId()
  const { go, pending } = useExploreNavigation()
  const values = pickFilters(current)
  return (
    <aside className="e2-sec e2-02-filters ds-desk-only" aria-label="Filtres" aria-busy={pending}>
      <div className="e2-sec__head">
        <h2 className="e2-sec__title">Filtres</h2>
        {countFilters(values) > 0 ? (
          <Link className="e2-link e2-link--quiet" href={studentMissionsHref({ ...current, ...EMPTY_FILTERS })}>
            Réinitialiser
          </Link>
        ) : null}
      </div>
      <div className="e2-sec__body">
        <FilterFields
          idPrefix={idPrefix}
          values={values}
          onChange={(patch) => go(studentMissionsHref({ ...current, ...patch }))}
        />
      </div>
    </aside>
  )
}

/** Bouton « Filtres » et feuille du bas, sans état propre (testable : `open` et `draft` viennent de l'appelant). */
export function FiltersSheetView({ open, active, draft, onOpen, onClose, onDraft, onClear, onApply }) {
  const idPrefix = useId()
  const draftCount = countFilters(draft)
  return (
    <>
      <button type="button" className="btn btn--soft btn--sm" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <Icon name="i-filter" />
        {active > 0 ? `Filtres · ${active}` : "Filtres"}
      </button>
      <Modal
        open={open}
        onClose={onClose}
        title="Filtres"
        description={draftCount > 0 ? plural(draftCount, "filtre actif", "filtres actifs") : "Aucun filtre actif"}
        footer={
          <div className="e2-02-sfoot">
            <button type="button" className="btn btn--soft" onClick={onClear}>
              Tout effacer
            </button>
            <button type="button" className="btn btn--dark" onClick={onApply}>
              Afficher les missions
            </button>
          </div>
        }
      >
        <FilterFields idPrefix={idPrefix} values={draft} onChange={onDraft} />
      </Modal>
    </>
  )
}

/** Feuille de filtres du mobile : les choix sont appliqués d'un coup par « Afficher les missions ». */
export function FiltersSheet({ current }) {
  const { go } = useExploreNavigation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  return (
    <FiltersSheetView
      open={open}
      active={countFilters(pickFilters(current))}
      draft={draft}
      onOpen={() => {
        setDraft(pickFilters(current))
        setOpen(true)
      }}
      onClose={() => setOpen(false)}
      onDraft={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      onClear={() => setDraft(EMPTY_FILTERS)}
      onApply={() => {
        setOpen(false)
        go(studentMissionsHref({ ...current, ...draft }))
      }}
    />
  )
}

/** Tri : liste native, le choix s'applique tout de suite. */
export function SortControl({ current }) {
  const id = useId()
  const { go } = useExploreNavigation()
  return (
    <div className="e2-02-sort">
      <label htmlFor={id}>Trier</label>
      <select
        id={id}
        className="select select--sm"
        value={current.sort}
        onChange={(e) => go(studentMissionsHref({ ...current, sort: e.target.value }))}
      >
        {SORTS.map((sort) => (
          <option key={sort.id || "recent"} value={sort.id}>{sort.label}</option>
        ))}
      </select>
    </div>
  )
}
