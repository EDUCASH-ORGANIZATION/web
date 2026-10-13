"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { coordsValid } from "@/lib/client-space/conversations"

const SEARCH_DELAY_MS = 500
const MIN_QUERY = 3

// Résultat de recherche de lieu réduit à un libellé et des coordonnées valides.
function toPlace(raw) {
  const lat = Number.parseFloat(raw?.lat)
  const lng = Number.parseFloat(raw?.lon)
  if (!coordsValid(lat, lng) || typeof raw?.display_name !== "string") return null
  return { label: raw.display_name, lat, lng }
}

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

  useEffect(() => {
    if (mode !== "search") return undefined
    const text = query.trim()
    if (text.length < MIN_QUERY) {
      setPlaces([])
      setSearching(false)
      return undefined
    }
    let cancelled = false
    setSearching(true)
    setPicked(null)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&accept-language=fr`,
        )
        const data = await res.json()
        if (!cancelled) setPlaces(Array.isArray(data) ? data.map(toPlace).filter(Boolean) : [])
      } catch {
        if (!cancelled) setPlaces([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, query])

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
      description="Votre interlocuteur pourra l'ouvrir dans une carte."
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
          <label className="search">
            <Icon name="i-search" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Quartier, rue ou lieu"
              aria-label="Rechercher un lieu"
              maxLength={120}
              autoComplete="off"
            />
          </label>
          {searching ? <p className="dialog-note2" role="status">Recherche en cours...</p> : null}
          {!searching && query.trim().length >= MIN_QUERY && places.length === 0 ? (
            <p className="dialog-note2" role="status">Aucun lieu trouvé.</p>
          ) : null}
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
        </div>
      )}
    </Modal>
  )
}

export default LocationDialog
