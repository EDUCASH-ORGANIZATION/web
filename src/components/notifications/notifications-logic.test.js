import { describe, it, expect, vi } from "vitest"
import {
  PANEL_LIMIT,
  POLL_INTERVAL_MS,
  announcementFor,
  bellLabel,
  createPoller,
  filterParam,
  initialListState,
  listReducer,
  loadedFromResponse,
  pageGroups,
  panelGroups,
  safeCount,
  shouldPoll,
  toViewItem,
} from "./notifications-logic"

const M = "0b8f1c1e-2c1b-4b53-9a52-9d6b6a6f3a10"
const S = "2d0a3e3f-4e3d-4d75-9c74-1f8d8c8b5c32"
const row = (id, over = {}) => ({
  id,
  type: "application_received",
  title: `T${id}`,
  body: "",
  mission_id: M,
  actor_id: S,
  read_at: null,
  created_at: "2026-10-15T10:00:00+00:00",
  ...over,
})

describe("cloche : libellé et annonce", () => {
  it("libellé selon le compteur", () => {
    expect(bellLabel(0)).toBe("Notifications")
    expect(bellLabel(1)).toBe("Notifications, 1 non lue")
    expect(bellLabel(2)).toBe("Notifications, 2 non lues")
    expect(bellLabel(NaN)).toBe("Notifications")
    expect(bellLabel(-3)).toBe("Notifications")
  })

  it("annonce seulement une hausse, jamais au premier rendu", () => {
    expect(announcementFor(null, 3)).toBe("")
    expect(announcementFor(undefined, 3)).toBe("")
    expect(announcementFor(2, 2)).toBe("")
    expect(announcementFor(3, 1)).toBe("")
    expect(announcementFor(0, 1)).toBe("Vous avez une nouvelle notification.")
    expect(announcementFor(1, 4)).toBe("Vous avez 3 nouvelles notifications.")
    expect(announcementFor(1, NaN)).toBe("")
  })

  it("safeCount borne les valeurs invalides", () => {
    expect(safeCount(4)).toBe(4)
    expect(safeCount("5")).toBe(5)
    expect(safeCount(-1, 2)).toBe(2)
    expect(safeCount("x", 7)).toBe(7)
    expect(safeCount(3.9)).toBe(3)
  })
})

describe("éléments affichés", () => {
  it("lien, icône et action recalculés depuis le type (jamais lus de la ligne)", () => {
    const v = toViewItem({ ...row("1"), href: "https://evil.example", url: "javascript:alert(1)" }, "client")
    expect(v.href).toBe(`/client/missions/${M}?candidat=${S}`)
    expect(v.icon).toBe("i-file")
    expect(v.actionLabel).toBe("Voir la candidature")
    expect(v.unread).toBe(true)
    expect(toViewItem(row("2", { read_at: "2026-10-15T11:00:00Z" }), "client").unread).toBe(false)
    expect(toViewItem(row("3"), "student").href).toBeNull()
  })

  it("le panneau montre au plus 8 éléments, un seul bouton encre", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i)))
    const { groups, primaryId } = panelGroups(rows, "client", new Date("2026-10-15T12:00:00Z"))
    expect(PANEL_LIMIT).toBe(8)
    expect(groups.flatMap((g) => g.items)).toHaveLength(8)
    expect(primaryId).toBe("0")
  })

  it("la page montre tout", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i)))
    expect(pageGroups(rows, "client", new Date("2026-10-15T12:00:00Z")).groups.flatMap((g) => g.items)).toHaveLength(12)
    expect(pageGroups(null, "client").groups).toEqual([])
  })

  it("paramètre de filtre", () => {
    expect(filterParam("unread")).toBe("non-lues")
    expect(filterParam("all")).toBeUndefined()
  })
})

describe("réducteur de liste", () => {
  const loaded = (rows, count) => listReducer(initialListState({ status: "loading" }), { type: "loaded", rows, nextCursor: "c1", count })

  it("chargement réussi puis page suivante ajoutée", () => {
    const first = loaded([row("1"), row("2")], 2)
    expect(first).toMatchObject({ status: "ready", count: 2, nextCursor: "c1" })
    const next = listReducer(first, { type: "loaded", rows: [row("3")], nextCursor: null, count: 2, append: true })
    expect(next.rows.map((r) => r.id)).toEqual(["1", "2", "3"])
    expect(next.nextCursor).toBeNull()
  })

  it("échec de chargement", () => {
    expect(listReducer(initialListState(), { type: "failed" }).status).toBe("error")
    expect(loadedFromResponse({ error: "x" })).toEqual({ type: "failed" })
    expect(loadedFromResponse(undefined)).toEqual({ type: "failed" })
    expect(loadedFromResponse({ items: [row("1")], nextCursor: null, unreadCount: 1 })).toMatchObject({ type: "loaded", count: 1 })
  })

  it("marquer une notification : lue, compteur décrémenté, jamais sous zéro", () => {
    const state = loaded([row("1"), row("2")], 1)
    const marked = listReducer(state, { type: "mark", id: "1", at: "2026-10-15T12:00:00Z" })
    expect(marked.rows[0].read_at).toBe("2026-10-15T12:00:00Z")
    expect(marked.rows[1].read_at).toBeNull()
    expect(marked.count).toBe(0)
    const again = listReducer(marked, { type: "mark", id: "2" })
    expect(again.count).toBe(0)
  })

  it("marquer une notification déjà lue ou inconnue : aucun changement", () => {
    const state = loaded([row("1", { read_at: "2026-10-14T00:00:00Z" })], 0)
    expect(listReducer(state, { type: "mark", id: "1" })).toBe(state)
    expect(listReducer(state, { type: "mark", id: "zzz" })).toBe(state)
  })

  it("tout marquer puis échec : retour arrière", () => {
    const state = loaded([row("1"), row("2")], 2)
    const all = listReducer(state, { type: "markAll", at: "2026-10-15T12:00:00Z" })
    expect(all.rows.every((r) => r.read_at)).toBe(true)
    expect(all.count).toBe(0)
    const back = listReducer(all, { type: "rollback" })
    expect(back.rows.every((r) => r.read_at === null)).toBe(true)
    expect(back.count).toBe(2)
    expect(back.snapshot).toBeNull()
  })

  it("échec de marquage d'une notification : retour arrière", () => {
    const state = loaded([row("1")], 1)
    const back = listReducer(listReducer(state, { type: "mark", id: "1" }), { type: "rollback" })
    expect(back.rows[0].read_at).toBeNull()
    expect(back.count).toBe(1)
    expect(listReducer(state, { type: "rollback" })).toBe(state)
  })

  it("filtre : repasse en chargement, valeur inconnue ignorée", () => {
    const state = loaded([row("1")], 1)
    const filtered = listReducer(state, { type: "filter", filter: "unread" })
    expect(filtered).toMatchObject({ filter: "unread", status: "loading", rows: [], nextCursor: null })
    expect(listReducer(state, { type: "filter", filter: "../x" })).toBe(state)
  })

  it("compteur renvoyé par le sondage", () => {
    const state = loaded([], 0)
    expect(listReducer(state, { type: "count", count: 5 }).count).toBe(5)
    expect(listReducer(state, { type: "count", count: "abc" }).count).toBe(0)
    expect(listReducer(state, { type: "inconnu" })).toBe(state)
  })
})

describe("sondage du compteur", () => {
  function setup(initialVisibility = "visible") {
    let visibility = initialVisibility
    let callback = null
    let id = 0
    const refresh = vi.fn()
    const setTimer = vi.fn((fn, ms) => {
      callback = fn
      return ++id
    })
    const clearTimer = vi.fn(() => {
      callback = null
    })
    const poller = createPoller({ refresh, getVisibility: () => visibility, setTimer, clearTimer })
    return {
      poller,
      refresh,
      setTimer,
      clearTimer,
      tick: () => callback?.(),
      setVisibility: (v) => {
        visibility = v
      },
    }
  }

  it("intervalle de 60 s, onglet visible seulement", () => {
    expect(POLL_INTERVAL_MS).toBe(60_000)
    expect(shouldPoll("visible")).toBe(true)
    expect(shouldPoll("hidden")).toBe(false)
    const t = setup()
    t.poller.start()
    expect(t.setTimer).toHaveBeenCalledWith(expect.any(Function), 60_000)
    t.tick()
    expect(t.refresh).toHaveBeenCalledTimes(1)
  })

  it("onglet caché au démarrage : aucune minuterie", () => {
    const t = setup("hidden")
    t.poller.start()
    expect(t.setTimer).not.toHaveBeenCalled()
    expect(t.poller.isRunning()).toBe(false)
  })

  it("passage en arrière-plan : minuterie arrêtée ; retour : relecture immédiate et minuterie relancée", () => {
    const t = setup()
    t.poller.start()
    t.setVisibility("hidden")
    t.poller.onVisibilityChange()
    expect(t.clearTimer).toHaveBeenCalledTimes(1)
    expect(t.poller.isRunning()).toBe(false)
    expect(t.refresh).not.toHaveBeenCalled()
    t.setVisibility("visible")
    t.poller.onVisibilityChange()
    expect(t.refresh).toHaveBeenCalledTimes(1)
    expect(t.poller.isRunning()).toBe(true)
  })

  it("un tick pendant que l'onglet est caché ne relit rien ; l'arrêt est définitif", () => {
    const t = setup()
    t.poller.start()
    t.setVisibility("hidden")
    t.tick()
    expect(t.refresh).not.toHaveBeenCalled()
    t.poller.stop()
    expect(t.poller.isRunning()).toBe(false)
  })
})
