import { describe, expect, it } from "vitest"
import {
  NOMINATIM_MAX_QUERY,
  NOMINATIM_MIN_INTERVAL_MS,
  NOMINATIM_MIN_QUERY,
  OSM_COPYRIGHT_HREF,
  googleMapsDirectionsHref,
  googleMapsPlaceHref,
  nominatimSearchUrl,
  nominatimWaitMs,
  normalizeQuery,
  toPlace,
} from "./map-links"

describe("liens Google Maps", () => {
  it("construit les URL exactes sans clé", () => {
    expect(googleMapsPlaceHref(6.37, 2.39)).toBe("https://www.google.com/maps/search/?api=1&query=6.37,2.39")
    expect(googleMapsDirectionsHref(6.37, 2.39)).toBe("https://www.google.com/maps/dir/?api=1&destination=6.37,2.39")
    expect(googleMapsPlaceHref(6.37, 2.39)).not.toMatch(/key=/)
  })

  it("accepte les coordonnées négatives et les bornes", () => {
    expect(googleMapsPlaceHref(-33.9, -70.5)).toBe("https://www.google.com/maps/search/?api=1&query=-33.9,-70.5")
    expect(googleMapsPlaceHref(90, 180)).toContain("query=90,180")
    expect(googleMapsDirectionsHref(-90, -180)).toContain("destination=-90,-180")
    expect(googleMapsPlaceHref(0, 0)).toContain("query=0,0")
  })

  it("évite la notation scientifique et arrondit à six décimales", () => {
    expect(googleMapsPlaceHref(1e-9, 2.123456789)).toBe("https://www.google.com/maps/search/?api=1&query=0,2.123457")
  })

  it("renvoie null hors bornes, NaN, infini et valeurs non numériques", () => {
    for (const [lat, lng] of [
      [90.1, 0], [0, 180.1], [-90.1, 0], [0, -180.1],
      [NaN, 2], [2, NaN], [Infinity, 0], [0, -Infinity],
      ["6.37", "2.39"], ["6.37", 2.39], [null, null], [undefined, 1],
      ["6.37,2.39&x=1", 1],
    ]) {
      expect(googleMapsPlaceHref(lat, lng)).toBeNull()
      expect(googleMapsDirectionsHref(lat, lng)).toBeNull()
    }
  })
})

describe("nominatimSearchUrl", () => {
  it("encode la requête et limite au Bénin", () => {
    expect(nominatimSearchUrl("Cotonou")).toBe(
      "https://nominatim.openstreetmap.org/search?q=Cotonou&format=json&limit=5&accept-language=fr&countrycodes=bj",
    )
  })

  it("encode les caractères spéciaux", () => {
    const url = nominatimSearchUrl("  Rue & Cie #1 é/?  ")
    expect(url).toContain("q=Rue%20%26%20Cie%20%231%20%C3%A9%2F%3F&")
    expect(url.split("?")).toHaveLength(2)
  })

  it("refuse les requêtes trop courtes, trop longues ou invalides", () => {
    expect(nominatimSearchUrl("ab")).toBeNull()
    expect(nominatimSearchUrl("  a  ")).toBeNull()
    expect(nominatimSearchUrl("")).toBeNull()
    expect(nominatimSearchUrl(null)).toBeNull()
    expect(nominatimSearchUrl(42)).toBeNull()
    expect(nominatimSearchUrl("a".repeat(NOMINATIM_MAX_QUERY + 1))).toBeNull()
  })

  it("accepte les bornes", () => {
    expect(nominatimSearchUrl("a".repeat(NOMINATIM_MIN_QUERY))).not.toBeNull()
    expect(nominatimSearchUrl("a".repeat(NOMINATIM_MAX_QUERY))).not.toBeNull()
    expect(normalizeQuery("  abc ")).toBe("abc")
  })
})

describe("nominatimWaitMs", () => {
  it("impose une seconde entre deux requêtes", () => {
    expect(NOMINATIM_MIN_INTERVAL_MS).toBe(1000)
    expect(nominatimWaitMs(10000, 10300)).toBe(700)
    expect(nominatimWaitMs(10000, 11000)).toBe(0)
    expect(nominatimWaitMs(10000, 15000)).toBe(0)
  })

  it("n'attend pas sans requête précédente", () => {
    expect(nominatimWaitMs(null, 5)).toBe(0)
    expect(nominatimWaitMs(undefined, 5)).toBe(0)
  })
})

describe("toPlace", () => {
  it("réduit un résultat valide", () => {
    expect(toPlace({ lat: "6.37", lon: "2.39", display_name: "Cotonou, Bénin" })).toEqual({
      label: "Cotonou, Bénin", lat: 6.37, lng: 2.39,
    })
  })

  it("rejette les entrées invalides", () => {
    expect(toPlace(null)).toBeNull()
    expect(toPlace(undefined)).toBeNull()
    expect(toPlace({})).toBeNull()
    expect(toPlace({ lat: "abc", lon: "2", display_name: "x" })).toBeNull()
    expect(toPlace({ lat: "91", lon: "2", display_name: "x" })).toBeNull()
    expect(toPlace({ lat: "6", lon: "181", display_name: "x" })).toBeNull()
    expect(toPlace({ lat: "6", lon: "2" })).toBeNull()
    expect(toPlace({ lat: "6", lon: "2", display_name: 5 })).toBeNull()
  })
})

describe("mention OpenStreetMap", () => {
  it("pointe vers la page de copyright", () => {
    expect(OSM_COPYRIGHT_HREF).toBe("https://www.openstreetmap.org/copyright")
  })
})
