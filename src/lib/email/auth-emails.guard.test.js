import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const TEMPLATES_DIR = "src/lib/email/templates"
const SUPABASE_DIR = "supabase/templates"

// Gabarits d'accueil et ensemble des gabarits Resend (vouvoiement partout, decision RD-VOUS-01).
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

// Detecteur de tutoiement : pronoms et possessifs de la 2e personne du singulier, elisions (t'),
// pronom postpose (-toi, -tu) et impératifs courants des anciens gabarits (sans pronom).
// Les bornes de mot sont posees avec \p{L} : \b ne reconnait pas les lettres accentuees (ex. "n'etes").
const L = "(?<![\\p{L}\\p{N}_])"
const R = "(?![\\p{L}\\p{N}_])"
const TUTOIEMENT = new RegExp(
  `${L}(tu|toi|ton|ta|tes|te)${R}|${L}t['\\u2019]|${L}t&apos;|-(toi|tu)${R}|${L}(confirme|reinitialise|réinitialise|copie|ignore|consulte|commence|garde|hesite|hésite|renouvelle|reprends|soumets|explore)${R}`,
  "iu",
)

// Retire les commentaires HTML (consignes d'application) pour ne scanner que le texte envoye
const withoutComments = (src) => src.replace(/<!--[\s\S]*?-->/g, "")

// Texte visible : sans commentaires (HTML, bloc, ligne), balises ni attributs, pour que le detecteur
// ne s'applique pas au code (noms de props, classes, URL).
const visibleText = (src) =>
  withoutComments(src)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/<[^<>]*>/g, " ")

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
    const hits = [...ALL_RESEND, ...SUPABASE, INDEX].filter((f) => read(f).includes("\u2014"))
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

  it("detecteur de tutoiement : fixtures vrai positif et vrai negatif", () => {
    const tutoyes = [
      "Ton profil est verifie",
      "Tu peux postuler",
      "Confirme ton adresse email",
      "Copie ce lien dans ton navigateur",
      "Consulte les missions près de chez toi",
      "Tu n'as pas cree de compte",
      "N&apos;hésite pas à nous contacter",
      "Réinitialise le mot de passe",
      "Connecte-toi pour continuer",
      "Garde ton avantage",
    ]
    const vouvoyes = [
      "Votre profil est verifie",
      "Vous pouvez postuler",
      "Confirmez votre adresse email",
      "Copiez ce lien dans votre navigateur",
      "Consultez les missions près de chez vous",
      "Vous n'avez pas cree de compte",
      "N&apos;hésitez pas à nous contacter",
      "Gardez votre avantage compétitif",
      "Bienvenue sur EduCash. Nous examinons votre carte.",
    ]
    for (const t of tutoyes) expect(t, t).toMatch(TUTOIEMENT)
    for (const v of vouvoyes) expect(v, v).not.toMatch(TUTOIEMENT)
  })

  it("le texte visible ignore balises, attributs et commentaires mais garde le texte", () => {
    const code = '<a href="https://x.fr/ton" data-te="1">Ton lien</a> {/* tu es ici */} // tu aussi\n<!-- ton -->'
    expect(visibleText(code)).toMatch(TUTOIEMENT)
    expect(visibleText('<a href="https://x.fr/ton" data-te="1">Votre lien</a> {/* tu es ici */}')).not.toMatch(TUTOIEMENT)
    expect(visibleText("const a = 1 // tu peux\nconst b = 2")).not.toMatch(TUTOIEMENT)
  })

  it("vouvoiement partout : aucune forme de tutoiement dans les gabarits ni les objets d'email", () => {
    const hits = [...ALL_RESEND, ...SUPABASE, INDEX].filter((f) => TUTOIEMENT.test(visibleText(read(f))))
    expect(hits).toEqual([])
  })
})
