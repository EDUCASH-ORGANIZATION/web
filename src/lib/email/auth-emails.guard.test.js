import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const TEMPLATES_DIR = "src/lib/email/templates"
const SUPABASE_DIR = "supabase/templates"

// Gabarits d'accueil (etudiants, tutoiement) et ensemble des gabarits Resend.
const AUTH_RESEND = ["welcome-student.jsx", "welcome-verified.jsx"].map((f) => join(TEMPLATES_DIR, f))
const ALL_RESEND = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith(".jsx"))
  .map((f) => join(TEMPLATES_DIR, f))
const SUPABASE = readdirSync(SUPABASE_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => join(SUPABASE_DIR, f))
const INDEX = "src/lib/email/index.js"

const read = (f) => readFileSync(f, "utf8")
const VISIBLE = [...AUTH_RESEND, ...SUPABASE]

// Retire les commentaires HTML (consignes d'application) pour ne scanner que le texte envoye
const withoutComments = (src) => src.replace(/<!--[\s\S]*?-->/g, "")

describe("emails d'auth", () => {
  it("les deux gabarits Supabase existent", () => {
    expect(SUPABASE.map((f) => f.split("/").pop()).sort()).toEqual(["confirm-signup.html", "reset-password.html"])
  })

  it("tous les gabarits Resend sont scannes", () => {
    expect(ALL_RESEND.length).toBeGreaterThan(10)
  })

  it("aucune apostrophe droite dans le texte JSX des gabarits Resend", () => {
    const hits = ALL_RESEND.filter((f) => />[^<{}]*[a-zà-ÿ]'[a-zà-ÿ][^<{}]*</i.test(read(f)))
    expect(hits).toEqual([])
  })

  it("aucun tiret cadratin", () => {
    const hits = [...ALL_RESEND, ...SUPABASE, INDEX].filter((f) => read(f).includes("—"))
    expect(hits).toEqual([])
  })

  it("aucun delai d'examen ni de validite", () => {
    const hits = VISIBLE.filter((f) => /\b24\s?h|\b48\s?h|sous 24|sous 48|valable|expire dans/i.test(withoutComments(read(f))))
    expect(hits).toEqual([])
  })

  it("aucun mot banni ni nom de prestataire", () => {
    const hits = VISIBLE.filter((f) =>
      /fedapay|livraisons?|coursiers?|\bcourses?\b|saisies?\b|bient[oô]t|wallet/i.test(withoutComments(read(f))),
    )
    expect(hits).toEqual([])
  })

  it("aucun emoji dans les gabarits d'auth", () => {
    const hits = VISIBLE.filter((f) => /\p{Extended_Pictographic}/u.test(read(f)))
    expect(hits).toEqual([])
  })

  it("les gabarits Supabase pointent vers RedirectTo avec token_hash", () => {
    const confirm = read(join(SUPABASE_DIR, "confirm-signup.html"))
    const reset = read(join(SUPABASE_DIR, "reset-password.html"))
    expect(confirm).toContain("{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup")
    expect(reset).toContain("{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery")
    expect(confirm).not.toMatch(/\{\{ \.ConfirmationURL \}\}/)
    expect(reset).not.toMatch(/\{\{ \.ConfirmationURL \}\}/)
  })

  it("les objets d'email n'ont ni tiret cadratin, ni emoji, ni wallet", () => {
    const src = read(INDEX)
    // Valeurs de SUBJECTS et objets calcules : on ignore les cles et les identifiants de gabarit
    const subjectValues = src
      .slice(src.indexOf("const SUBJECTS"))
      .split("\n")
      .filter((l) => /^\s*"[a-z-]+":\s+"/.test(l) || /\?\s*`/.test(l))
      .map((l) => l.replace(/^\s*"[a-z-]+":\s+/, ""))
    expect(subjectValues.length).toBeGreaterThan(10)
    expect(subjectValues.filter((l) => /\u2014|wallet|\p{Extended_Pictographic}/iu.test(l))).toEqual([])
  })

  it("tutoiement dans les gabarits etudiants", () => {
    for (const f of AUTH_RESEND) expect(read(f)).not.toMatch(/\bvotre\b|\bvous\b|\bvos\b/i)
  })
})
