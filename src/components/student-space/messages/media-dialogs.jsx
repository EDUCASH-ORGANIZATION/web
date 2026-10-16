"use client"

// @ds-screen RD-STUDENT-01
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/design/icon"
import { Modal } from "@/components/app-ui/modal"
import { coordsValid } from "@/lib/client-space/conversations"
import { NOMINATIM_MAX_QUERY, NOMINATIM_MIN_QUERY, OSM_COPYRIGHT_HREF, nominatimSearchUrl, nominatimWaitMs, toPlace } from "@/lib/messaging/map-links"

function sizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

// Aperçu d'une image avant l'envoi. `previewUrl` est une adresse locale du navigateur (blob), jamais envoyée.
export function ImageDialog({ file, previewUrl, onConfirm, onCancel }) {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Envoyer cette image ?"
      footer={
        <>
          <button type="button" className="btn btn--soft" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Envoyer
          </button>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="dialog-image2" src={previewUrl} alt="Aperçu de l'image à envoyer" />
      <p className="dialog-note2">{sizeText(file?.size)}</p>
    </Modal>
  )
}

const ERR_SHORT_QUERY = `Saisissez au moins ${NOMINATIM_MIN_QUERY} caractères.`
const ERR_SEARCH = "La recherche est indisponible pour le moment. Veuillez réessayer."

// Choix d'une position à partager : la position de l'appareil ou un lieu recherché. La recherche n'est lancée
// qu'à la validation (bouton « Rechercher » ou Entrée), au plus une requête par seconde (politique de Nominatim).
export function LocationDialog({ onConfirm, onClose }) {
  const [mode, setMode] = useState("current")
  const [locating, setLocating] = useState(false)
  const [current, setCurrent] = useState(null)
  const [problem, setProblem] = useState("")
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchProblem, setSearchProblem] = useState("")
  const [places, setPlaces] = useState([])
  const [picked, setPicked] = useState(null)
  const lastRequestAt = useRef(null)
  const busy = useRef(false)
  const alive = useRef(true)

  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  async function search() {
    if (busy.current) return
    const url = nominatimSearchUrl(query)
    if (!url) {
      setSearchProblem(ERR_SHORT_QUERY)
      return
    }
    busy.current = true
    setSearchProblem("")
    setSearching(true)
    setPicked(null)
    try {
      const wait = nominatimWaitMs(lastRequestAt.current, Date.now())
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      lastRequestAt.current = Date.now()
      const res = await fetch(url)
      const data = res.ok ? await res.json() : null
      if (!alive.current) return
      if (Array.isArray(data)) {
        setPlaces(data.map(toPlace).filter(Boolean))
      } else {
        setPlaces([])
        setSearchProblem(ERR_SEARCH)
      }
    } catch {
      if (alive.current) {
        setPlaces([])
        setSearchProblem(ERR_SEARCH)
      }
    } finally {
      busy.current = false
      if (alive.current) {
        setSearching(false)
        setSearched(true)
      }
    }
  }

  function onSearchKeyDown(event) {
    if (event.key === "Enter" && !event.nativeEvent?.isComposing) {
      event.preventDefault()
      search()
    }
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
      description="Le client pourra l'ouvrir dans Google Maps."
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
          <div className="stack">
            <label className="search">
              <Icon name="i-search" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Quartier, rue ou lieu"
                aria-label="Rechercher un lieu"
                maxLength={NOMINATIM_MAX_QUERY}
                autoComplete="off"
              />
            </label>
            <button type="button" className="btn btn--soft" onClick={search} disabled={searching}>
              Rechercher
            </button>
          </div>
          {searching ? <p className="dialog-note2" role="status">Recherche en cours...</p> : null}
          {searchProblem ? <p className="dialog-note2" role="alert">{searchProblem}</p> : null}
          {!searching && !searchProblem && searched && places.length === 0 ? (
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
          <p className="dialog-note2">
            Résultats : ©{" "}
            <a href={OSM_COPYRIGHT_HREF} target="_blank" rel="noopener noreferrer" className="link">
              contributeurs OpenStreetMap
            </a>
          </p>
        </div>
      )}
    </Modal>
  )
}
