import { describe, it, expect } from "vitest"
import { unreadByMission } from "./unread-by-mission"

describe("unreadByMission", () => {
  it("garde les conversations avec des non lus, par mission", () => {
    const out = unreadByMission({
      conversations: [
        { missionId: "m1", unreadCount: 2, lastAt: "2026-10-08T09:12:00+01:00" },
        { missionId: "m2", unreadCount: 0, lastAt: "2026-10-08T10:00:00+01:00" },
        { missionId: "m1", unreadCount: 1, lastAt: "2026-10-07T10:00:00+01:00" },
      ],
    })
    expect(out).toEqual({ m1: { at: "2026-10-08T09:12:00+01:00" } })
  })

  it("erreur, résultat absent ou lignes incomplètes : aucun non lu", () => {
    expect(unreadByMission({ error: "x" })).toEqual({})
    expect(unreadByMission(null)).toEqual({})
    expect(unreadByMission(undefined)).toEqual({})
    expect(unreadByMission({ conversations: [{ unreadCount: 1, lastAt: "x" }, { missionId: "m1", unreadCount: Number.NaN, lastAt: "x" }, { missionId: "m2", unreadCount: 1 }, null] })).toEqual({})
  })
})
