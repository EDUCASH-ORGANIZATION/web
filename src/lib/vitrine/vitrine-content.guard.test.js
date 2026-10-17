import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { MISSION_TYPES } from "@/lib/constants/missions"
import { PAYMENT_WARNING } from "@/lib/purchases/requests"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const DIRS = ["src/components/vitrine", "src/app/legal", "src/app/about", "src/app/contact", "src/app/(home)", "src/app/(public)", "src/app/(mission-detail)", "src/app/auth", "src/components/auth"]
// Composant partagé avec l'espace étudiant connecté (profile/edit), non refondu : hors périmètre du garde-fou.
const SKIP = new Set(["src/components/auth/card-upload-zone.js"])

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, out)
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) && !SKIP.has(rel)) out.push(rel)
  }
  return out
}
const files = DIRS.flatMap((d) => walk(d))
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")

// Texte "rendu" d'un fichier : commentaires retirés, et jetons exacts égaux à une valeur de MISSION_TYPES
// (valeurs en base, jamais affichées telles quelles) ignorés.
const TYPE_TOKENS = new RegExp(`(["'\`])(?:${MISSION_TYPES.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\1`, "g")
function visibleText(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[\s;,])\/\/.*$/gm, "$1")
    .replace(TYPE_TOKENS, '""')
}

const EMAIL_DIR = "src/lib/email/templates"
const emailFiles = walk(EMAIL_DIR).filter((f) => /\.jsx?$/.test(f))

describe("garde-fous de contenu vitrine", () => {
  it("scanne des fichiers", () => expect(files.length).toBeGreaterThan(30))

  it.each([
    ["EduCash SAS", /EduCash SAS/],
    ["Haie Vive", /Haie Vive/],
    ["XX XX", /XX XX/],
    ["tiret cadratin", /\u2014/],
    ["style inline", /style=\{\{/],
    ["@mui", /@mui/],
    ["@emotion", /@emotion/],
  ])("aucun %s dans les fichiers vitrine", (_n, re) => {
    const hits = files.filter((f) => re.test(read(f)))
    expect(hits).toEqual([])
  })

  it.each([
    ["72 h", /72(\s|&nbsp;|\u00a0)*h\b/],
    ["J'ai terminé", /J(&rsquo;|&apos;|'|\u2019)ai terminé/],
    ["tranche", /tranche/],
    ["coup sûr", /coup sûr/],
    ["privacy@educash.bj", /privacy@educash\.bj/],
    ["24 h ouvrées", /24(\s|&nbsp;|\u00a0)*h ouvrées/],
    ["lundi au samedi", /lundi au samedi/i],
  ])("aucune promesse retiree (%s) dans les fichiers vitrine", (_n, re) => {
    const hits = files.filter((f) => /\.jsx?$/.test(f) && re.test(read(f)))
    expect(hits).toEqual([])
  })

  it("le libelle de la pastille 24 h n'apparait que dans la page contact", () => {
    const EXCEPTIONS = { "src/app/contact/page.js": "pastille 24 h demandée par l'utilisateur (RD-FIX-03b)" }
    const badge = /24(\s|&nbsp;|\u00a0)*h\s*ouvrées/
    const hits = files
      .filter((f) => /\.jsx?$/.test(f))
      .filter((f) => badge.test(read(f).replace(/<[^>]*>/g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")))
    expect(hits).toEqual(Object.keys(EXCEPTIONS))
  })

  it("les mentions legales portent l'identite BRANDYBEN", () => {
    const src = read("src/components/vitrine/legal/legal-entity.js") + read("src/app/legal/mentions/page.js")
    expect(src).toContain("BRANDYBEN")
    expect(src).toContain("RB/COT/26 A 119853")
    expect(src).toContain("0202212868410")
  })

  // Une mention de « demande de paiement » (carte d'achats de RD-ACHATS-01) n'est tolérée que si le même fichier
  // dit « hors EduCash » et porte l'avertissement PAYMENT_WARNING (constante ou texte identique).
  const PAYMENT_REQUEST = /demandes?\s+de\s+paiement/i
  const isFramedPaymentRequest = (src) =>
    !PAYMENT_REQUEST.test(src) || (/hors\s+EduCash/.test(src) && (/\bPAYMENT_WARNING\b/.test(src) || src.includes(PAYMENT_WARNING)))

  it("« demande de paiement » n'apparait qu'avec « hors EduCash » et l'avertissement de paiement dans le meme fichier", () => {
    const hits = files.filter((f) => /\.jsx?$/.test(f) && !isFramedPaymentRequest(read(f)))
    expect(hits).toEqual([])
  })

  it("le cas négatif de « demande de paiement » échoue sans l'avertissement ou sans « hors EduCash » (construit en mémoire)", () => {
    const bare = "<p>Envoyez une demande de paiement au client.</p>"
    const noWarning = "<p>Une demande de paiement, réglée hors EduCash.</p>"
    const noHors = `<p>Une demande de paiement.</p> {PAYMENT_WARNING}`
    const framed = `<p>Une demande de paiement, réglée hors EduCash.</p> {PAYMENT_WARNING}`
    expect(isFramedPaymentRequest(bare)).toBe(false)
    expect(isFramedPaymentRequest(noWarning)).toBe(false)
    expect(isFramedPaymentRequest(noHors)).toBe(false)
    expect(isFramedPaymentRequest(framed)).toBe(true)
    expect(isFramedPaymentRequest("<p>Aucune mention.</p>")).toBe(true)
  })

  describe("achats : CGU et confidentialité (RD-ACHATS-01)", () => {
    const termsSrc = read("src/app/legal/terms/page.js")
    const privacySrc = read("src/app/legal/privacy/page.js")
    const between = (src, start, end) => {
      const a = src.indexOf(start)
      expect(a).toBeGreaterThan(-1)
      return src.slice(a, src.indexOf(end, a))
    }
    const achats = between(termsSrc, 'id="achats"', "</LegalSection>").replace(/\s+/g, " ")
    const privacyBlock = between(privacySrc, "<LegalSection {...SECTIONS.demandes_d_achats}>", "</LegalSection>").replace(/\s+/g, " ")
    // Durée chiffrée : décision D8 non tranchée, aucune promesse de conservation dans ces textes.
    const NUMBERED_DURATION = /\d+(?:&nbsp;|\s)*(?:jours?|mois|ans?|semaines?|heures?|h\b|minutes?)/i
    const PROVIDER = /fedapay|kkiapay|feexpay|cinetpay|paydunya|stripe|paypal|flutterwave/i

    it("les CGU contiennent la clause achats et le modèle rétabli", () => {
      expect(termsSrc).toMatch(/id="achats">Missions avec achats/)
      expect(achats).toMatch(/directement au vendeur par Mobile Money, hors EduCash/)
      expect(achats).toMatch(/n’avance jamais d’argent/)
      expect(achats).toMatch(/ni partie, ni dépositaire, ni garant/)
      expect(achats).toMatch(/ne rembourse pas un paiement effectué hors plateforme/)
      expect(achats).toMatch(/« demande de paiement d’achats »/)
      for (const word of ["numéro à payer", "nom du vendeur", "montant", "numéro marchand", "panneau", "ticket", "capture du SMS"]) {
        expect(achats).toContain(word)
      }
      expect(achats).toMatch(/confirme la réception/)
      expect(achats).toMatch(/Chaque partie peut signaler/)
      expect(achats).toMatch(/sans remboursement ni compensation/)
      expect(achats).toMatch(/n’entre jamais dans le séquestre ni dans la commission de 12(?:&nbsp;| )%/)
      expect(achats).toMatch(/nom du bénéficiaire/)
      expect(achats).toMatch(/PAYMENT_WARNING/)
      expect(achats).toMatch(/une personne peut indiquer un numéro qui n’est pas celui du vendeur/)
    })

    it("la clause achats ne nomme aucun prestataire et ne promet aucune durée", () => {
      expect(achats).not.toMatch(PROVIDER)
      expect(achats).not.toMatch(NUMBERED_DURATION)
      expect(achats).not.toMatch(/Commission/)
    })

    it("la politique de confidentialité décrit les données des demandes d'achats sans durée chiffrée", () => {
      expect(privacySrc).toContain('id: "demandes-d-achats"')
      expect(privacyBlock).toMatch(/numéro à payer/)
      expect(privacyBlock).toMatch(/nom du vendeur/)
      expect(privacyBlock).toMatch(/photo du numéro marchand ou du panneau/)
      expect(privacyBlock).toMatch(/photo du ticket/)
      expect(privacyBlock).toMatch(/capture du SMS/)
      expect(privacyBlock).toMatch(/concerner des tiers, notamment des vendeurs/)
      expect(privacyBlock).toMatch(/Finalité/)
      expect(privacyBlock).toMatch(/les deux parties de la mission et l’équipe d’administration d’EduCash, pour le suivi des missions et le traitement des signalements\./)
      expect(privacyBlock).not.toMatch(/en cas de signalement, l’équipe d’administration/)
      expect(privacyBlock).toMatch(/stockage privé/)
      expect(privacyBlock).toMatch(/Droits/)
      expect(privacyBlock).toMatch(/Durée de conservation :<\/strong> elle sera précisée/)
      expect(privacyBlock).not.toMatch(NUMBERED_DURATION)
      expect(privacyBlock).not.toMatch(PROVIDER)
    })

    it("la détection d'une durée chiffrée ou d'un prestataire fonctionne (cas construits en mémoire)", () => {
      expect("conservés 90 jours").toMatch(NUMBERED_DURATION)
      expect("purgés après 6 mois").toMatch(NUMBERED_DURATION)
      expect("via FedaPay").toMatch(PROVIDER)
      expect("la durée sera précisée").not.toMatch(NUMBERED_DURATION)
    })
  })

  it("les CGU et la politique de confidentialite annoncent l'analyse automatique des messages (RD-MSG-01)", () => {
    const privacy = read("src/app/legal/privacy/page.js")
    const terms = read("src/app/legal/terms/page.js")
    expect(privacy).toContain('id: "analyse-des-messages"')
    expect(privacy).toMatch(/analyse\s+automatique/)
    expect(privacy).toMatch(/jamais journalisée/)
    expect(privacy).toMatch(/180 jours/)
    expect(privacy).toMatch(/12 mois/)
    expect(terms).toMatch(/analyse\s+automatique/)
    expect(terms).toMatch(/jamais\s+automatiquement/)
    expect(terms).toContain('href="/legal/privacy#analyse-des-messages"')
    expect(privacy).toMatch(/paiement direct/)
    expect(privacy).toMatch(/pseudos de réseaux sociaux/)
    expect(privacy).toMatch(/votre identité/)
    expect(privacy).toMatch(/message vocal ou position/)
    expect(terms).toMatch(/bandeau\s+d’avertissement/)
    // La clause achats reste inchangee (RD-ACHATS-01).
    expect(terms).toMatch(/id="achats">Missions avec achats/)
  })

  it("chaque classe utilisee existe dans le design system", () => {
    const known = new Set()
    const cssDir = path.join(ROOT, "src/app/design")
    for (const f of fs.readdirSync(cssDir).filter((n) => n.endsWith(".css"))) {
      for (const m of fs.readFileSync(path.join(cssDir, f), "utf8").matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) known.add(m[1])
    }
    const allowed = (c) => /^(w|h|max-w)-/.test(c) || ["rounded-full", "object-cover", "sr-only", "focus:not-sr-only", "ds"].includes(c)
    const unknown = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " ")
        for (const c of text.split(/\s+/).filter(Boolean)) {
          // Fragments de gabarits dynamiques (btn--${x}, v06-val--${x}) : non verifiables.
          if (/[$?"]|--$/.test(c)) continue
          if (!known.has(c) && !allowed(c)) unknown.push(`${f}: ${c}`)
        }
      }
    }
    expect([...new Set(unknown)]).toEqual([])
  })

  it("aucune classe generique du design system n'est utilisee en dehors de lui", () => {
    // Noms assembles : un nom de classe Tailwind ecrit en clair dans ce fichier serait scanne
    // par Tailwind, qui generait alors l'utilitaire et ferait diverger le rendu.
    const banned = new Set(["con" + "tainer", "gr" + "ow", "gr" + "id", "ta" + "ble", "h1", "h2", "h3", "h4"])
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      for (const m of read(f).matchAll(/className=(?:"([^"]*)"|\{?`([^`]*)`)/g)) {
        for (const c of (m[1] ?? m[2]).split(/\s+/)) if (banned.has(c)) hits.push(`${f}: ${c}`)
      }
    }
    expect(hits).toEqual([])
  })

  it("aucun mot banni dans les textes vitrine (livraison, course, coursier, saisie, prestataire de paiement, Bientôt)", () => {
    const banned = /livraisons?|coursiers?|\bcourses?\b|saisies?\b|fedapay|bient[ôo]t/i
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n))) {
      const m = visibleText(f).match(banned)
      if (m) hits.push(`${f}: ${m[0]}`)
    }
    expect(hits).toEqual([])
  })

  it("vouvoiement : aucun tutoiement dans les textes de la vitrine publique", () => {
    // Filet local, volontairement conservé : le garde-fou global src/lib/security/no-tutoiement.guard.test.js
    // est la référence (plus complet) ; celui-ci échoue plus près des fichiers de la vitrine.
    // Décision RD-VOUS-01 : vouvoiement partout. L'authentification (components/auth, app/auth, auth-shell)
    // est couverte par ses propres tests ; le garde-fou global no-tutoiement.guard.test.js couvre tout src/.
    const PRONOUNS = /(^|[^\p{L}-])(?:(?:tu|toi|ton|ta|tes|te)(?![\p{L}-])|t(?:['\u2019]|&rsquo;|&apos;))/iu
    const COMPOUND = /\p{L}+-(toi|tu|te)(?![\p{L}-])/iu
    const IMPERATIVES = /(^|[^\p{L}-])(Crée|Encaisse|Postule|Écris|Fais|Trouve|Prouve|Découvre|Retire|Reprends|Réessaie|Vérifie|Envoie|Contacte|Choisis|Parcours|Bosse|Sois|Essaie|Précise|Explique|Laisse|Inscris|Connecte|Reviens|Retrouve|Filtre|Ouvre|Utilise|Renvoie|Élargis|Donne|Passe)(?![\p{L}])/u
    const hits = []
    for (const f of files.filter((n) => /\.jsx?$/.test(n) && !/^src\/(components|app)\/auth\//.test(n))) {
      const text = visibleText(f).replace(/(className|href|id|name|type|htmlFor|aria-labelledby|aria-describedby)=("[^"]*"|\{[^}]*\})/g, "")
      for (const re of [PRONOUNS, COMPOUND, IMPERATIVES]) {
        const m = text.match(re)
        if (m) hits.push(`${f}: ${m[0].trim()}`)
      }
    }
    expect(hits).toEqual([])
  })

  it("aucun <select> natif dans l'authentification (Select maison du design system)", () => {
    const hits = files.filter((f) => /^src\/(components|app)\/auth\//.test(f) && /<select[\s>]/.test(read(f)))
    expect(hits).toEqual([])
  })

  it("aucun lien vers /clients (redirigé vers l'accueil)", () => {
    const hits = files.filter((f) => /\.jsx?$/.test(f) && /["'`]\/clients(?:[/?#"'`])/.test(visibleText(f)))
    expect(hits).toEqual([])
  })

  it("les gabarits d'email ne nomment pas le prestataire de paiement et n'affichent aucun mot banni", () => {
    expect(emailFiles.length).toBeGreaterThan(5)
    const hits = emailFiles.filter((f) => /fedapay|livraisons?|coursiers?|\bcourses?\b|saisies?\b/i.test(visibleText(f)))
    expect(hits).toEqual([])
  })

  describe("authentification", () => {
    const authFiles = files.filter((f) => /^src\/(app|components)\/auth\//.test(f) && /\.jsx?$/.test(f))
    const AUTH_UI_SOURCES = [...authFiles, "src/components/vitrine/auth-shell.jsx"]

    it("scanne les écrans d'auth", () => expect(authFiles.length).toBeGreaterThan(20))

    it("aucun formulaire sans action serveur ni method=post", () => {
      const hits = []
      for (const f of AUTH_UI_SOURCES) {
        for (const m of visibleText(f).matchAll(/<form\b[^>]*>/g)) {
          if (!/\baction=\{|method="post"/.test(m[0])) hits.push(`${f}: ${m[0].slice(0, 60)}`)
        }
      }
      expect(hits).toEqual([])
    })

    it("aucun formulaire en method=get", () => {
      expect(AUTH_UI_SOURCES.filter((f) => /method=["']get["']/i.test(read(f)))).toEqual([])
    })

    it("aucun délai d'examen de carte ni promesse de support", () => {
      const re = /réponse sous|sous 24|sous 48|24\s?h|48\s?h|support répond|valable \d|expire dans/i
      const hits = AUTH_UI_SOURCES.filter((f) => re.test(visibleText(f)))
      expect(hits).toEqual([])
    })

    it("aucun accès direct aux tables depuis les composants d'auth", () => {
      const hits = authFiles.filter((f) => f.startsWith("src/components/auth/") && /supabase\s*\.from\(/.test(read(f)))
      expect(hits).toEqual([])
    })

    it("aucune couleur en dur ni balise style dans les écrans d'auth", () => {
      const hits = AUTH_UI_SOURCES.filter((f) => /#[0-9a-fA-F]{3,8}\b|<style/.test(visibleText(f)))
      expect(hits).toEqual([])
    })
  })

  it("aucun tiret cadratin dans les gabarits d'email Resend", () => {
    expect(emailFiles.filter((f) => read(f).includes("\u2014"))).toEqual([])
  })
})
