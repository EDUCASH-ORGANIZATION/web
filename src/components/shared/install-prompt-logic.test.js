import { describe, it, expect } from "vitest"
import {
  decideInstallPrompt,
  parseInstallState,
  isIosSafariAgent,
  installCopy,
  remainingSessionDelay,
  EMPTY_INSTALL_STATE,
  INSTALL_SNOOZE_MS,
} from "./install-prompt-logic"

const NOW = 1_700_000_000_000
const base = {
  space: "student",
  isMobile: true,
  standalone: false,
  hasNativePrompt: true,
  isIosSafari: false,
  state: { ...EMPTY_INSTALL_STATE, visits: 2 },
  sessionMs: 0,
  now: NOW,
}
const decide = (over) => decideInstallPrompt({ ...base, ...over })

describe("decideInstallPrompt", () => {
  it("shows natively on mobile in a connected space from the 2nd visit", () => {
    expect(decide({})).toEqual({ show: true, mode: "native" })
  })
  it("never shows on desktop", () => {
    expect(decide({ isMobile: false }).show).toBe(false)
  })
  it("never shows on the public showcase or auth pages", () => {
    expect(decide({ space: "public" }).show).toBe(false)
    expect(decide({ space: "auth" }).show).toBe(false)
    expect(decide({ space: undefined }).show).toBe(false)
  })
  it("never shows when already installed (standalone or flag)", () => {
    expect(decide({ standalone: true }).show).toBe(false)
    expect(decide({ state: { ...base.state, installed: true } }).show).toBe(false)
  })
  it("waits on the first visit unless 30 seconds of use", () => {
    const first = { ...EMPTY_INSTALL_STATE, visits: 1 }
    expect(decide({ state: first }).show).toBe(false)
    expect(decide({ state: first, sessionMs: 29_999 }).show).toBe(false)
    expect(decide({ state: first, sessionMs: 30_000 }).show).toBe(true)
  })
  it("hides for 30 days after Plus tard, then shows again", () => {
    const snoozedUntil = NOW + INSTALL_SNOOZE_MS
    expect(decide({ state: { ...base.state, snoozedUntil } }).show).toBe(false)
    expect(decide({ state: { ...base.state, snoozedUntil }, now: snoozedUntil - 1 }).show).toBe(false)
    expect(decide({ state: { ...base.state, snoozedUntil }, now: snoozedUntil }).show).toBe(true)
  })
  it("stays hidden for good once dismissed with the cross", () => {
    expect(decide({ state: { ...base.state, dismissed: true }, now: NOW * 2 }).show).toBe(false)
  })
  it("needs beforeinstallprompt, except on iOS Safari", () => {
    expect(decide({ hasNativePrompt: false }).show).toBe(false)
    expect(decide({ hasNativePrompt: false, isIosSafari: true })).toEqual({ show: true, mode: "ios" })
  })
  it("tells whether the prompt can ever show (infinite session, native prompt assumed)", () => {
    const ever = (over) => decide({ hasNativePrompt: true, sessionMs: Infinity, ...over }).show
    expect(ever({ state: { ...EMPTY_INSTALL_STATE, visits: 1 } })).toBe(true)
    expect(ever({ isMobile: false })).toBe(false)
    expect(ever({ standalone: true })).toBe(false)
    expect(ever({ state: { ...EMPTY_INSTALL_STATE, dismissed: true } })).toBe(false)
    expect(ever({ state: { ...EMPTY_INSTALL_STATE, snoozedUntil: NOW + 1 } })).toBe(false)
  })
  it("applies the same conditions on iOS", () => {
    const ios = { hasNativePrompt: false, isIosSafari: true }
    expect(decide({ ...ios, isMobile: false }).show).toBe(false)
    expect(decide({ ...ios, standalone: true }).show).toBe(false)
    expect(decide({ ...ios, space: "public" }).show).toBe(false)
    expect(decide({ ...ios, state: { ...EMPTY_INSTALL_STATE, visits: 1 } }).show).toBe(false)
  })
})

describe("helpers", () => {
  it("parses stored state defensively", () => {
    expect(parseInstallState(null)).toEqual(EMPTY_INSTALL_STATE)
    expect(parseInstallState("not json")).toEqual(EMPTY_INSTALL_STATE)
    expect(parseInstallState('{"visits":3,"dismissed":true}')).toEqual({
      ...EMPTY_INSTALL_STATE,
      visits: 3,
      dismissed: true,
    })
  })
  it("detects iOS Safari only", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    expect(isIosSafariAgent(safari)).toBe(true)
    expect(isIosSafariAgent(safari.replace("Version/17.0", "CriOS/120.0"))).toBe(false)
    expect(isIosSafariAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36")).toBe(false)
  })
  it("computes the remaining session delay", () => {
    expect(remainingSessionDelay(0)).toBe(30_000)
    expect(remainingSessionDelay(40_000)).toBe(0)
  })
  it("uses tu for students, vous for clients, no em dash", () => {
    expect(installCopy("student").native).toContain("tes missions")
    expect(installCopy("client").native).toContain("vos missions")
    expect(installCopy("public")).toBeNull()
    expect(JSON.stringify([installCopy("student"), installCopy("client")])).not.toMatch(/[—–]/)
  })
})
