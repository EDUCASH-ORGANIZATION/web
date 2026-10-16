import { describe, it, expect } from "vitest"
import { unreadByMission } from "./unread-by-mission"

describe("unreadByMission : comportements", () => {
  it("plusieurs missions : une entrée par mission avec non lus", () => {
    const out = unreadByMission({
      conversations: [
        { missionId: "m1", unreadCount: 1, lastAt: "2026-10-08T09:00:00Z" },
        { missionId: "m2", unreadCount: 5, lastAt: "2026-10-08T10:00:00Z" },
        { missionId: "m3", unreadCount: 0, lastAt: "2026-10-08T11:00:00Z" },
      ],
    })
    expect(Object.keys(out).sort()).toEqual(["m1", "m2"])
    expect(out.m2).toEqual({ at: "2026-10-08T10:00:00Z" })
  })

  it("plusieurs candidats (conversations) sur une même mission : la première rencontrée gagne, une seule entrée", () => {
    const out = unreadByMission({
      conversations: [
        { missionId: "m1", unreadCount: 1, lastAt: "2026-10-08T10:00:00Z" },
        { missionId: "m1", unreadCount: 3, lastAt: "2026-10-08T08:00:00Z" },
      ],
    })
    expect(out).toEqual({ m1: { at: "2026-10-08T10:00:00Z" } })
  })

  it("nombre de non lus 0, négatif, chaîne vide ou absent : aucune entrée", () => {
    for (const unreadCount of [0, -1, undefined, null, "", Number.NaN]) {
      expect(unreadByMission({ conversations: [{ missionId: "m1", unreadCount, lastAt: "2026-10-08T10:00:00Z" }] })).toEqual({})
    }
  })

  it("conversations non tableau ou liste vide", () => {
    expect(unreadByMission({ conversations: [] })).toEqual({})
    expect(unreadByMission({})).toEqual({})
    expect(unreadByMission()).toEqual({})
  })
})
