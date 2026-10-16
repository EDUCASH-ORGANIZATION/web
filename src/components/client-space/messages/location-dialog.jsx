"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { coordsValid } from "@/lib/client-space/conversations"
import { OSM_COPYRIGHT_HREF, nominatimSearchUrl, nominatimWaitMs, toPlace } from "@/lib/messaging/map-links"

const SEARCH_ERROR = "La recherche n'a pas pu aboutir. Veuillez réessayer."

// Choix d'une position à partager : la position de l'appareil ou un lieu recherché.
export function LocationDialog({ onConfirm, onClose }) {
  const [mode, setMode] = useState("current")
  const [locating, setLocating] = useState(false)
  const [current, setCurrent] = useState(null)
  const [problem, setProblem] = useState("")
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [places, setPlaces] = useState([])
  const [picked, setPicked] = useState(null)
  const [searched, setSearched] = useState(false)
  const [searchProblem, setSearchProblem] = useState("")
  const lastRequestAt = useRef(null)
  const timer = useRef(null)
  const run = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Recherche déclenchée par la validation seulement (bouton ou Entrée), jamais à la frappe. Une requête par
  // seconde au plus : si la précédente est trop récente, celle-ci attend le délai restant.
  function search(event) {
    event?.preventDefault()
    const url = nominatimSearchUrl(query)
    if (!url) return
    clearTimeout(timer.current)
    run.current += 1
    const id = run.current
    setSearching(true)
    setSearched(false)
    setSearchProblem("")
    setPicked(null)
    const fire = async () => {
      lastRequestAt.current = Date.now()
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error("search")
        const data = await res.json()
        if (id === run.current) setPlaces(Array.isArray(data) ? data.map(toPlace).filter(Boolean) : [])
      } catch {
        if (id === run.current) {
          setPlaces([])
          setSearchProblem(SEARCH_ERROR)
        }
      } finally {
        if (id === run.current) {
          setSearching(false)
          setSearched(true)
        }
      }
    }
    const wait = nominatimWaitMs(lastRequestAt.current, Date.now())
    if (wait > 0) timer.current = setTimeout(fire, wait)
    else fire()
  }

  function locate() {
    if (!navigator.geolocation) {
      setProblem("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setLocating(true)
    setProblem("")
    setCurrent(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setProblem("Position introuvable. Vérifiez les autorisations de votre appareil.")
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  const chosen = mode === "current" ? current : picked
  const canConfirm = chosen && coordsValid(chosen.lat, chosen.lng)

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Partager une position"
      description="Votre interlocuteur pourra l'ouvrir dans Google Maps."
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(chosen.lat, chosen.lng)}
          >
            Partager cette position
          </button>
        </>
      }
    >
      <div className="segmented segmented--block" role="group" aria-label="Choix de la position">
        <button type="button" className={mode === "current" ? "segmented__item is-active" : "segmented__item"} aria-pressed={mode === "current"} onClick={() => setMode("current")}>
          Ma position
        </button>
        <button type="button" className={mode === "search" ? "segmented__item is-active" : "segmented__item"} aria-pressed={mode === "search"} onClick={() => setMode("search")}>
          Rechercher un lieu
        </button>
      </div>

      {mode === "current" ? (
        <div>
          <button type="button" className="btn btn--soft" onClick={locate} disabled={locating}>
            <Icon name="i-navigation" />
            {locating ? "Localisation en cours..." : "Utiliser ma position"}
          </button>
          {current ? <p className="dialog-note2" role="status">Position trouvée.</p> : null}
          {problem ? <p className="dialog-note2" role="alert">{problem}</p> : null}
        </div>
      ) : (
        <div>
          <div className="search-row2">
            <label className="search">
              <Icon name="i-search" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearched(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search(e)
                }}
                placeholder="Quartier, rue ou lieu"
                aria-label="Rechercher un lieu"
                maxLength={120}
                autoComplete="off"
              />
            </label>
            <button type="button" className="btn btn--soft" onClick={search} disabled={searching || !nominatimSearchUrl(query)}>
              Rechercher
            </button>
          </div>
          {searching ? <p className="dialog-note2" role="status">Recherche en cours...</p> : null}
          {searchProblem ? <p className="dialog-note2" role="alert">{searchProblem}</p> : null}
          {searched && !searchProblem && places.length === 0 ? <p className="dialog-note2" role="status">Aucun lieu trouvé.</p> : null}
          {places.length > 0 ? (
            <ul className="places2">
              {places.map((place) => (
                <li key={`${place.lat},${place.lng}`}>
                  <button type="button" className="place-option2" aria-pressed={picked === place} onClick={() => setPicked(place)}>
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="dialog-note2">
            Résultats : ©{" "}
            <a href={OSM_COPYRIGHT_HREF} className="link" target="_blank" rel="noopener noreferrer">
              contributeurs OpenStreetMap
            </a>
          </p>
        </div>
      )}
    </Modal>
  )
}

export default LocationDialog
