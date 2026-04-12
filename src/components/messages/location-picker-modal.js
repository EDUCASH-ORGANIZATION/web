"use client"

import { useState, useEffect, useRef } from "react"
import { X, MapPin, Navigation, Search, Loader2, CheckCircle } from "lucide-react"

/**
 * Modal de sélection de localisation.
 * Deux modes :
 *  - "current"  : géolocalisation GPS
 *  - "search"   : recherche textuelle via Nominatim (OpenStreetMap)
 *
 * @param {{
 *   onConfirm: (lat: number, lng: number, label: string) => void,
 *   onClose:   () => void,
 * }} props
 */
export function LocationPickerModal({ onConfirm, onClose }) {
  const [tab,           setTab]           = useState("current")  // "current" | "search"
  const [isLocating,    setIsLocating]    = useState(false)
  const [currentCoords, setCurrentCoords] = useState(null)       // { lat, lng }
  const [geoError,      setGeoError]      = useState("")

  const [query,         setQuery]         = useState("")
  const [isSearching,   setIsSearching]   = useState(false)
  const [results,       setResults]       = useState([])
  const [selected,      setSelected]      = useState(null)       // résultat Nominatim
  const searchTimeout                     = useRef(null)

  // Ferme avec Echap
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // ── Géolocalisation ───────────────────────────────────────────────────────
  function getMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setIsLocating(true)
    setGeoError("")
    setCurrentCoords(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setIsLocating(false)
      },
      () => {
        setGeoError("Position introuvable. Vérifiez les autorisations.")
        setIsLocating(false)
      },
      { timeout: 10000 }
    )
  }

  // ── Recherche Nominatim (debounce 500ms) ──────────────────────────────────
  useEffect(() => {
    if (tab !== "search") return
    clearTimeout(searchTimeout.current)
    if (query.trim().length < 3) { setResults([]); return }

    setIsSearching(true)
    setSelected(null)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=fr`,
          { headers: { "Accept-Language": "fr" } }
        )
        const data = await res.json()
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(searchTimeout.current)
  }, [query, tab])

  // ── Carte statique ────────────────────────────────────────────────────────
  function staticMapUrl(lat, lng) {
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=320x120&markers=${lat},${lng},ol-marker-blue`
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (tab === "current" && currentCoords) {
      onConfirm(currentCoords.lat, currentCoords.lng, "Ma position")
    } else if (tab === "search" && selected) {
      onConfirm(parseFloat(selected.lat), parseFloat(selected.lon), selected.display_name)
    }
  }

  const canConfirm = (tab === "current" && currentCoords) || (tab === "search" && selected)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Fond */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panneau */}
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#1A6B4A]" />
            <p className="text-sm font-black text-gray-900">Partager une localisation</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors touch-manipulation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          {[
            { id: "current", label: "Ma position", icon: Navigation },
            { id: "search",  label: "Rechercher un lieu", icon: Search },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setSelected(null); setCurrentCoords(null); setGeoError("") }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors touch-manipulation ${
                tab === id
                  ? "bg-[#1A6B4A] text-white"
                  : "bg-gray-100 text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">

          {/* ── Tab : position actuelle ───────────────────────────────── */}
          {tab === "current" && (
            <div className="flex flex-col gap-3 pt-1">
              <button
                type="button"
                onClick={getMyLocation}
                disabled={isLocating}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-60 touch-manipulation"
              >
                {isLocating
                  ? <><Loader2 size={15} className="animate-spin" /> Localisation en cours…</>
                  : <><Navigation size={15} /> Utiliser ma position GPS</>
                }
              </button>

              {geoError && (
                <p className="text-xs text-red-500 text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {geoError}
                </p>
              )}

              {currentCoords && (
                <div className="flex flex-col gap-2">
                  {/* Carte preview */}
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={staticMapUrl(currentCoords.lat, currentCoords.lng)}
                      alt="Carte"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <MapPin size={28} className="text-red-500 drop-shadow-md" fill="white" />
                    </div>
                  </div>

                  {/* Coordonnées */}
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle size={14} className="text-[#1A6B4A] shrink-0" />
                    <p className="text-xs text-gray-600 font-medium tabular-nums">
                      {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab : recherche ───────────────────────────────────────── */}
          {tab === "search" && (
            <div className="flex flex-col gap-3 pt-1">
              {/* Champ recherche */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Adresse, lieu, quartier…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] transition-colors"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Résultats */}
              {results.length > 0 && !selected && (
                <div className="flex flex-col gap-1">
                  {results.map((r) => (
                    <button
                      key={r.place_id}
                      type="button"
                      onClick={() => { setSelected(r); setResults([]) }}
                      className="text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors touch-manipulation"
                    >
                      <p className="text-xs font-semibold text-gray-900 truncate">{r.display_name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{r.type}</p>
                    </button>
                  ))}
                </div>
              )}

              {query.trim().length >= 3 && !isSearching && results.length === 0 && !selected && (
                <p className="text-xs text-gray-400 text-center py-4">Aucun résultat trouvé.</p>
              )}

              {/* Lieu sélectionné + preview carte */}
              {selected && (
                <div className="flex flex-col gap-2">
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={staticMapUrl(selected.lat, selected.lon)}
                      alt="Carte"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <MapPin size={28} className="text-red-500 drop-shadow-md" fill="white" />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle size={14} className="text-[#1A6B4A] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2">{selected.display_name}</p>
                    </div>
                  </div>

                  {/* Changer de sélection */}
                  <button
                    type="button"
                    onClick={() => { setSelected(null); setQuery("") }}
                    className="text-xs text-[#1A6B4A] font-semibold hover:underline self-start touch-manipulation"
                  >
                    ← Choisir un autre lieu
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer boutons */}
        <div className="flex gap-3 px-4 pb-6 pt-2 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors touch-manipulation"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
          >
            <MapPin size={15} />
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}
