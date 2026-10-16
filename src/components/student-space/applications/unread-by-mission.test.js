import { describe, it, expect } from "vitest"
import { unreadByMission } from "./unread-by-mission"

describe("unreadByMission", () => {
  it("garde les conversations avec des non lus, par mission", () => {
    const out = unreadByMission({
      conversations: [
        { missionId: "m1", unreadCount: 2, state: "candidate", lastUnreadAt: "2026-10-08T09:12:00+01:00" },
        { missionId: "m2", unreadCount: 0, state: "candidate", lastUnreadAt: "2026-10-08T10:00:00+01:00" },
        { missionId: "m1", unreadCount: 1, state: "candidate", lastUnreadAt: "2026-10-07T10:00:00+01:00" },
      ],
    })
    expect(out).toEqual({ m1: { at: "2026-10-08T09:12:00+01:00", state: "candidate" } })
  })

  it("erreur, résultat absent ou lignes incomplètes : aucun non lu", () => {
    expect(unreadByMission({ error: "x" })).toEqual({})
    expect(unreadByMission(null)).toEqual({})
    expect(unreadByMission(undefined)).toEqual({})
    expect(unreadByMission({ conversations: [{ unreadCount: 1, state: "candidate", lastUnreadAt: "x" }, { missionId: "m1", unreadCount: Number.NaN, state: "candidate", lastUnreadAt: "x" }, { missionId: "m2", unreadCount: 1 }, null] })).toEqual({})
  })

  it("at vient de lastUnreadAt (jamais de lastAt) et vaut null quand elle manque", () => {
    const out = unreadByMission({
      conversations: [
        { missionId: "m1", state: "candidate", unreadCount: 1, lastAt: "2026-10-09T10:00:00Z", lastUnreadAt: "2026-10-01T10:00:00Z" },
        { missionId: "m2", state: "in_progress", unreadCount: 1, lastAt: "2026-10-09T10:00:00Z" },
      ],
    })
    expect(out).toEqual({ m1: { at: "2026-10-01T10:00:00Z", state: "candidate" }, m2: { at: null, state: "in_progress" } })
  })

  it("seules les conversations où l'on peut écrire (candidate, in_progress) sont gardées", () => {
    const conversations = ["done", "cancelled", "rejected", "closed", null, undefined].map((state, i) => ({
      missionId: `m${i}`, state, unreadCount: 2, lastUnreadAt: "2026-10-09T10:00:00Z",
    }))
    expect(unreadByMission({ conversations })).toEqual({})
  })
})
