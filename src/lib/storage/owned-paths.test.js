import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { toProjectAvatarUrl } from "./owned-paths"

const ORIGIN = "https://proj.supabase.co"
const avatar = (rest) => `${ORIGIN}/storage/v1/object/public/avatars/${rest}`

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN))
afterEach(() => vi.unstubAllEnvs())

describe("toProjectAvatarUrl", () => {
  it("accepte l'URL publique d'un avatar du projet et retire les paramètres", () => {
    expect(toProjectAvatarUrl(avatar("u1/avatar-1.png"))).toBe(avatar("u1/avatar-1.png"))
    expect(toProjectAvatarUrl(`${avatar("u1/avatar-1.png")}?t=1#x`)).toBe(avatar("u1/avatar-1.png"))
  })

  it.each([
    ["URL externe", "https://evil.example/storage/v1/object/public/avatars/u1/a.png"],
    ["chemin imité sur un autre hôte", "https://proj.supabase.co.evil.example/storage/v1/object/public/avatars/u1/a.png"],
    ["autre bucket", `${ORIGIN}/storage/v1/object/public/student-cards/u1/a.png`],
    ["URL signée", `${ORIGIN}/storage/v1/object/sign/avatars/u1/a.png?token=t`],
    ["schéma parasite", "javascript:alert(1)"],
    ["chemin brut", "u1/avatar.png"],
    ["dossier seul", avatar("")],
    ["segment vide", avatar("u1//a.png")],
    ["traversée encodée", avatar("..%2F..%2Fx")],
    ["traversée encodée dans un sous-dossier", avatar("u1/..%2F..%2Fx")],
    ["double encodage", avatar("u1/%252e%252e/x")],
    ["antislash encodé", avatar("u1%5Cx.png")],
    ["non-chaîne", 42],
    ["null", null],
    ["vide", ""],
  ])("refuse : %s", (_l, value) => {
    expect(toProjectAvatarUrl(value)).toBeNull()
  })

  it("une traversée normalisée par l'analyseur d'URL reste sous le dossier des avatars du projet", () => {
    for (const raw of [avatar("u1/../u2/a.png"), avatar("u1/%2e%2e/u2/a.png"), avatar("../../object/public/student-cards/u1/c.jpg")]) {
      const result = toProjectAvatarUrl(raw)
      if (result !== null) expect(result.startsWith(`${ORIGIN}/storage/v1/object/public/avatars/`)).toBe(true)
    }
    expect(toProjectAvatarUrl(avatar("../../object/public/student-cards/u1/c.jpg"))).toBeNull()
  })

  it("refuse tout sans configuration du projet", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(toProjectAvatarUrl(avatar("u1/a.png"))).toBeNull()
  })
})
