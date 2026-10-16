import { describe, it, expect } from "vitest"
import {
  MASK_TOKEN,
  CONTACT_KINDS,
  MASKABLE_KINDS,
  detectContacts,
  maskContacts,
  detectSplitPhone,
  maskDigitRuns,
} from "@/lib/messaging/contact-filter"

const M = MASK_TOKEN
const keycap = (digits) => [...digits].map((d) => `${d}️⃣`).join("")
const fullwidth = (digits) => [...digits].map((d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0)).join("")

describe("contrat du module", () => {
  it("expose les constantes du contrat", () => {
    expect(MASK_TOKEN).toBe("[coordonnées masquées]")
    expect(CONTACT_KINDS).toEqual(["phone", "email", "link", "social", "phone_split", "contact_keyword", "payment_keyword"])
    expect(MASKABLE_KINDS).toEqual(["phone", "email", "link", "social", "phone_split"])
  })

  it("renvoie des résultats neutres pour une entrée vide ou invalide", () => {
    for (const input of ["", "   ", null, undefined, 42, {}]) {
      expect(detectContacts(input)).toEqual({ kinds: [], count: 0, maskable: false })
      expect(maskContacts(input)).toEqual({ text: typeof input === "string" ? input : "", masked: false, kinds: [], count: 0 })
    }
  })

  it("ne tronque ni ne modifie un texte sans coordonnées", () => {
    const text = "Bonjour, je suis disponible demain matin à Cotonou."
    expect(maskContacts(text)).toEqual({ text, masked: false, kinds: [], count: 0 })
  })
})

// [entrée, sortie attendue] : le reste du texte reste identique au caractère près.
const PHONES = [
  ["01 97 12 34 56", M],
  ["0197123456", M],
  ["+229 01 97 12 34 56", M],
  ["00229 0197123456", M],
  ["+22901.97.12.34.56", M],
  ["01-97-12-34-56", M],
  ["01/97/12/34/56", M],
  ["01.97.12.34.56", M],
  ["0 1 9 7 1 2 3 4 5 6", M],
  ["(01) 97 12 34 56", M],
  ["97 12 34 56", M],
  ["97123456", M],
  ["97-12-34-56", M],
  ["9 7 1 2 3 4 5 6", M],
  ["0197 123 456", M],
  ["+229 97 12 34 56", M],
  ["00229 97 12 34 56", M],
  ["+229 0197123456", M],
  ["6l 23 45 67", M],
  ["O1 97 12 34 56", M],
  [keycap("0197123456"), M],
  [fullwidth("0197123456"), M],
  [`${fullwidth("01")} ${fullwidth("97")} ${fullwidth("12")} 34 56`, M],
  ["zéro un quatre-vingt-dix-sept douze trente-quatre cinquante-six", M],
  ["Zero One Nine Seven One Two Three Four Five Six", M],
  ["zéro un nonante-sept douze trente-quatre cinquante-six", M],
  ["01 nonante-sept 12 34 56", M],
  ["01 quatre-vingt-dix-sept soixante-dix-sept 12 34", M],
  ["+225 07 07 12 34 56", M],
  ["+234 803 123 4567", M],
  ["+33 6 12 34 56 78", M],
  ["+1 415 555 0132", M],
  ["01 97 12 34 56", M],
  ["01​97​12​34​56", M],
  ["mon num c 97 12 34 56", `mon num c ${M}`],
  ["Appelle-moi au 01 97 12 34 56 pour confirmer", `Appelle-moi au ${M} pour confirmer`],
  ["Voici mon numéro : 01 97 12 34 56.", `Voici mon numéro : ${M}.`],
  ["Salut\n01 97 12 34 56\nmerci", `Salut\n${M}\nmerci`],
  ["il y a 3 97 12 34 56", `il y a 3 ${M}`],
  ["Tel (+229 97 12 34 56) merci", `Tel ${M} merci`],
  ["01 97 12 34 56 et 01 98 76 54 32", `${M} et ${M}`],
  ["01 97 12 34 56, 01 98 76 54 32", M],
]

const LEGIT = [
  "15 000 FCFA",
  "150000 F",
  "25.000 XOF",
  "1 500 000 francs",
  "45 000 000 FCFA",
  "FCFA 15000",
  "Prix: 5 000 F + 1 500 F de transport",
  "Montant 12 500 CFA",
  "Total: 1 250 000 F",
  "Budget de 120 000 FCFA, soit 300 euros",
  "Mon budget est de 2 500 000 FCFA",
  "le 16/10/2026 à 14h30",
  "2026-10-16",
  "RDV 14:30",
  "Rendez-vous le 05-11-2026 à 9h",
  "Mission du 16.10.2026 au 20.10.2026",
  "Le 3 mars 2027",
  "A 17h30 devant l'université",
  "code porte 4589",
  "digicode 120456",
  "Code de retrait : 548213",
  "chambre 214",
  "3 kg de riz à 2 500 F",
  "lot 1234 carré 56",
  "Cotonou, quartier Fidjrossè, lot 245",
  "IFU 3201234567890",
  "réf. commande 20261016",
  "la facture n° 2026-0042",
  "j'ai un rendez-vous à 10h",
  "deux ou trois cartons",
  "un deux trois soleil",
  "trois cents mètres après la pharmacie",
  "environ 500 m après le carrefour",
  "Il y a 12 étudiants et 3 clients",
  "J'arrive dans 15 minutes",
  "lien educash.bj/aide",
  "https://educash.bj/aide",
  "Écrivez-nous à contact@educash.bj",
  "Merci beaucoup !",
  "Bonjour, êtes-vous disponible samedi ?",
]

const ADDRESSES = [
  ["jean@gmail.com", M, "email"],
  ["Écrivez à jean.dupont@gmail.com merci", `Écrivez à ${M} merci`, "email"],
  ["JEAN@GMAIL.COM", M, "email"],
  ["jean arobase gmail point com", M, "email"],
  ["jean (at) gmail (dot) com", M, "email"],
  ["jean [at] gmail [dot] com", M, "email"],
  ["jean at gmail dot com", M, "email"],
  ["wa.me/22901971234 56", M, "social"],
  ["écrivez sur wa point me/22901971234", `écrivez sur ${M}`, "social"],
  ["https://t.me/xxx", M, "social"],
  ["instagram.com/xxx", M, "social"],
  ["facebook.com/jean.dupont", M, "social"],
  ["chat.whatsapp.com/AbCdEf", M, "social"],
  ["m.me/jean", M, "social"],
  ["www.exemple.bj", M, "link"],
  ["https://example.com/page?x=1", M, "link"],
  ["Voir exemple.fr/contact svp", `Voir ${M} svp`, "link"],
  ["https://educash.bj.autre.com", M, "link"],
]

describe("numéros déguisés", () => {
  it("jeu de référence d'au moins 30 numéros", () => {
    expect(PHONES.length).toBeGreaterThanOrEqual(30)
  })

  for (const [input, expected] of PHONES) {
    it(`masque ${JSON.stringify(input)}`, () => {
      const detected = detectContacts(input)
      expect(detected.maskable).toBe(true)
      expect(detected.kinds).toContain("phone")
      const result = maskContacts(input)
      expect(result.masked).toBe(true)
      expect(result.text).toBe(expected)
      expect(result.kinds).toContain("phone")
    })
  }

  it("compte deux numéros distincts dans le même message", () => {
    expect(maskContacts("01 97 12 34 56 et 01 98 76 54 32").count).toBe(2)
  })
})

describe("messages légitimes", () => {
  it("jeu de référence d'au moins 30 messages", () => {
    expect(LEGIT.length).toBeGreaterThanOrEqual(30)
  })

  for (const input of LEGIT) {
    it(`ne masque pas ${JSON.stringify(input)}`, () => {
      expect(detectContacts(input)).toEqual({ kinds: [], count: 0, maskable: false })
      expect(maskContacts(input)).toEqual({ text: input, masked: false, kinds: [], count: 0 })
    })
  }

  it("ne masque jamais sous 8 chiffres ni les suites de 11 chiffres ou plus sans motif", () => {
    for (const digits of ["1", "12", "123456", "1234567", "12345678901", "123456789012", "3201234567890", "99999999999999"]) {
      expect(maskContacts(`réf ${digits}`).masked, digits).toBe(false)
    }
  })

  it("ne confond pas un « un » isolé ou un « o » ordinaire avec un chiffre", () => {
    for (const input of ["un", "j'ai un chat", "ok o 2 fois", "il l'a vu", "un ou deux", "Vingt minutes plus tard"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
  })
})

describe("e-mails et liens", () => {
  it("jeu de référence d'au moins 10 e-mails et liens", () => {
    expect(ADDRESSES.length).toBeGreaterThanOrEqual(10)
  })

  for (const [input, expected, kind] of ADDRESSES) {
    it(`masque ${JSON.stringify(input)}`, () => {
      const result = maskContacts(input)
      expect(result.text).toBe(expected)
      expect(result.masked).toBe(true)
      expect(result.kinds).toContain(kind)
    })
  }

  it("distingue un lien d'un réseau social", () => {
    expect(detectContacts("https://example.com/x").kinds).toEqual(["link"])
    expect(detectContacts("https://t.me/x").kinds).toEqual(["social"])
  })

  it("autorise educash.bj et ses sous-domaines", () => {
    for (const input of ["educash.bj", "www.educash.bj/aide", "https://app.educash.bj/x?y=1", "contact@educash.bj"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
  })

  it("masque un lien déguisé en educash.bj", () => {
    for (const input of ["https://educash.bj@evil.com/x", "https://educash.bj.evil.com", "educash.bj.evil.com"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
  })
})

describe("mots-clés", () => {
  it("écrivez-moi sur WhatsApp : détecté, non masquable, texte inchangé", () => {
    const text = "écrivez-moi sur WhatsApp"
    const detected = detectContacts(text)
    expect(detected.kinds).toEqual(["contact_keyword"])
    expect(detected.maskable).toBe(false)
    expect(detected.count).toBeGreaterThan(0)
    expect(maskContacts(text)).toMatchObject({ text, masked: false, kinds: ["contact_keyword"] })
  })

  it("payez-moi directement sur MoMo : détecté, non masquable, texte inchangé", () => {
    const text = "payez-moi directement sur MoMo"
    const detected = detectContacts(text)
    expect(detected.kinds).toEqual(["payment_keyword"])
    expect(detected.maskable).toBe(false)
    expect(maskContacts(text)).toMatchObject({ text, masked: false })
  })

  it("combine mots-clés et numéro : le numéro est masqué, les mots restent", () => {
    const result = maskContacts("Écris-moi sur WhatsApp au 01 97 12 34 56")
    expect(result.text).toBe(`Écris-moi sur WhatsApp au ${M}`)
    expect(result.kinds).toEqual(["phone", "contact_keyword"])
  })

  it("reconnaît les variantes sans accent ni trait d'union", () => {
    for (const text of ["ecrivez moi sur whats app", "Appelle moi", "mon e-mail", "par mobile money", "Paie-moi en cash"]) {
      expect(detectContacts(text).kinds.length, text).toBeGreaterThan(0)
    }
  })

  it("n'est pas déclenché par des mots proches", () => {
    for (const text of ["un moment", "le montant du momento", "ma numérotation", "sa facture"]) {
      expect(detectContacts(text).kinds, text).toEqual([])
    }
  })
})

describe("numéro découpé sur plusieurs messages", () => {
  it("détecte un numéro complété par le message courant", () => {
    expect(detectSplitPhone(["01 97"], "12 34 56")).toBe(true)
    expect(detectSplitPhone(["97 12", "34"], "56")).toBe(true)
    expect(detectSplitPhone(["mon numero 01 97 12"], "34 56 merci")).toBe(true)
  })

  it("ne signale pas un montant ni un numéro déjà complet", () => {
    expect(detectSplitPhone(["15 000 FCFA"], "merci")).toBe(false)
    expect(detectSplitPhone(["01 97 12 34 56"], "ok")).toBe(false)
    expect(detectSplitPhone(["bonjour"], "12 34 56 78")).toBe(false)
    expect(detectSplitPhone([], "12 34 56")).toBe(false)
  })

  it("ne relit que les deux derniers messages", () => {
    expect(detectSplitPhone(["01 97", "12", "34"], "56")).toBe(false)
  })

  it("supporte des entrées invalides", () => {
    expect(detectSplitPhone(null, "12")).toBe(false)
    expect(detectSplitPhone(["01 97"], null)).toBe(false)
    expect(detectSplitPhone([null, 5, ""], "12 34 56")).toBe(false)
  })

  it("maskDigitRuns masque les chiffres du message courant", () => {
    expect(maskDigitRuns("12 34 56")).toBe(M)
    expect(maskDigitRuns("voilà 12 34 56 merci")).toBe(`voilà ${M} merci`)
    expect(maskDigitRuns("sans chiffre")).toBe("sans chiffre")
    expect(maskDigitRuns("le 16/10/2026 à 14h30")).toBe("le 16/10/2026 à 14h30")
    expect(maskDigitRuns(null)).toBe("")
  })
})

describe("masquage", () => {
  it("fusionne les masques adjacents", () => {
    expect(maskContacts("01 97 12 34 56 / jean@gmail.com").text).toBe(M)
    expect(maskContacts("jean@gmail.com, wa.me/22901971234").text).toBe(M)
  })

  it("ne fusionne pas des masques séparés par des mots", () => {
    expect(maskContacts("jean@gmail.com ou 97 12 34 56").text).toBe(`${M} ou ${M}`)
  })

  it("garde le reste du texte à l'identique, espaces et retours à la ligne compris", () => {
    const text = "  Bonjour  Léa,\n\n   voici 15 000 FCFA\tet  le code 4589 .  "
    expect(maskContacts(text).text).toBe(text)
    const withPhone = `${text}01 97 12 34 56${text}`
    expect(maskContacts(withPhone).text).toBe(`${text}${M}${text}`)
  })

  it("préserve les émojis et caractères hors alphabet latin autour du masque", () => {
    expect(maskContacts("😀 01 97 12 34 56 🎉 café").text).toBe(`😀 ${M} 🎉 café`)
  })

  it("renvoie une sortie de 4000 caractères au plus, même si les masques allongent le texte", () => {
    const dense = "t.me,x ".repeat(285)
    expect(dense.length).toBeLessThanOrEqual(2000)
    const result = maskContacts(dense)
    expect(result.masked).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(4000)
    expect(maskContacts("a".repeat(9000)).text.length).toBeLessThanOrEqual(4000)
    expect(maskDigitRuns("1 a ".repeat(500)).length).toBeLessThanOrEqual(4000)
  })

  it("ne laisse aucun chiffre du numéro dans la sortie", () => {
    for (const [input] of PHONES) {
      const out = maskContacts(input).text
      expect(out.replace(/[^0-9]/g, "").length, input).toBeLessThanOrEqual(3)
    }
  })

  it("plafonne le compteur à 50", () => {
    const many = "jean@gmail.com et ".repeat(100)
    expect(maskContacts(many.slice(0, 1990)).count).toBe(50)
  })
})

describe("performance : pas de regex catastrophique", () => {
  const TRAPS = {
    chiffres_espaces: "1 ".repeat(1000),
    zeros: "0".repeat(2000),
    chiffres_groupes: "1 000 ".repeat(330),
    tirets: "1-".repeat(1000),
    espaces: " ".repeat(2000),
    lettres_puis_arobase: `${"a".repeat(1990)}@x.c`,
    points: "a.".repeat(1000),
    arobases: "a@".repeat(1000),
    local_long: `${"a.".repeat(900)}@${"b.".repeat(50)}1`,
    domaines: "www.".repeat(500),
    liens: "http://".repeat(280),
    wa: "wa.me/".repeat(330),
    mots_nombres: "zéro ".repeat(400),
    mots_un: "un ".repeat(660),
    quatre_vingt: "quatre vingt dix sept ".repeat(90),
    at_dot: "at dot ".repeat(280),
    crochets: "[at]".repeat(500),
    parentheses: "(".repeat(2000),
    plus: "+1 ".repeat(660),
    indicatifs: "+229 ".repeat(400),
    montants: "15 000 F ".repeat(220),
    dates: "16/10/2026 ".repeat(180),
    heures: "14h30 ".repeat(330),
    lookalikes: "o l i ".repeat(330),
    keycaps: keycap("0123456789").repeat(60),
    invisibles: "​".repeat(2000),
    accents: "é".repeat(2000),
    pleine_largeur: fullwidth("0123456789").repeat(100),
    numeros: "01 97 12 34 56 ".repeat(133),
    mots_cles: "whatsapp momo ".repeat(140),
    melange: "a1 b2@c.d 3 4 5 wa.me 01 97 (at) dot ".repeat(54),
  }

  it("traite chaque texte piège de 2000 caractères en moins de 50 ms", () => {
    maskContacts("Échauffement 01 97 12 34 56 jean@gmail.com https://t.me/x") // compile les expressions
    for (const [name, text] of Object.entries(TRAPS)) {
      const input = text.slice(0, 2000)
      let best = Infinity
      for (let run = 0; run < 3; run++) {
        const start = performance.now()
        const result = maskContacts(input)
        detectSplitPhone([input], input)
        maskDigitRuns(input)
        best = Math.min(best, performance.now() - start)
        expect(result.text.length, name).toBeLessThanOrEqual(4000)
      }
      expect(best, `${name}: ${best.toFixed(1)} ms`).toBeLessThan(50)
    }
  })
})
