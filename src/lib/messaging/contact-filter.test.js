import { describe, it, expect } from "vitest"
import { COUNTRY_CODES } from "@/lib/utils/phone"
import {
  MASK_TOKEN,
  COUNTRY_DIGITS,
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
  it("garde COUNTRY_DIGITS en parité avec COUNTRY_CODES de phone.js", () => {
    const expected = COUNTRY_CODES.filter((c) => /^\+\d+$/.test(c.code)).map((c) => c.code.slice(1))
    expect(COUNTRY_DIGITS).toEqual(expected)
  })

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
  ["01*97*12*34*56", M],
  ["01|97|12|34|56", M],
  ["01;97;12;34;56", M],
  ["01~97~12~34~56", M],
  ["01'97'12'34'56", M],
  ["01\u201997\u201912\u201934\u201956", M],
  ["01\u{1F60A}97\u{1F60A}12\u{1F60A}34\u{1F60A}56", M],
  ["01    97    12    34    56", M],
  ["01 97 12 \n\n 34 56", M],
  ["appelez 01 97 12 34 56 ou 97 12 34 56", `appelez ${M} ou ${M}`],
  ["9712 5000", M],
  ["appelle 9712 5000", `appelle ${M}`],
  ["9712 3400", M],
  ["9750 1234", M],
  ["97 1250 34", M],
  ["97 12 3450", M],
  ["971250 34", M],
  ["97 123400", M],
  ["Facture 97 12 34 56", `Facture ${M}`],
  ["Appelez le code 97 12 34 56", `Appelez le code ${M}`],
  ["ref 9712 3456", `ref ${M}`],
  ["97\u{1F4DE}12\u{1F4DE}34\u{1F4DE}56", M],
  ["mon n° 96457823", `mon n° ${M}`],
  ["Mon n°: 96457823", `Mon n°: ${M}`],
  ["votre n° 96457823", `votre n° ${M}`],
  ["N° 96457823", `N° ${M}`],
  ["mon n°96457823", `mon n°${M}`],
  ["mon no 96457823", `mon no ${M}`],
  ["ticket 96457823 appelez-moi", `ticket ${M} appelez-moi`],
  ["ticket 96457823 (whatsapp)", `ticket ${M} (whatsapp)`],
  ["code: 96457823 c'est mon whatsapp", `code: ${M} c'est mon whatsapp`],
  ["appelez 9700 1250", `appelez ${M}`],
  ["whatsapp 9750 1200", `whatsapp ${M}`],
  ["mon num 9600 1250", `mon num ${M}`],
  ["tel 6650 0050", `tel ${M}`],
  ["tel 20 21 22 23", `tel ${M}`],
  ["97 12\u{1F642}34 56", M],
  ["97 * 12 * 34 * 56", M],
  ["97*12-34*56", M],
  ["01*97|12*34|56", M],
  ["97 12 ... 34 56", M],
  ["97 12 -- 34 56", M],
  ["2 500 97 12 34 56", `2 500 ${M}`],
  ["+ 229 01 96 45 78 23", M],
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
  "Les prix : 2 500, 3 500, 4 500",
  "prix 2 500, 3 500 ou 4 500 F",
  "2.500, 3.500",
  "4 500, 5 500",
  "5 500, 6 500",
  "2 750, 3 250",
  "2 300, 4 600",
  "1 500, 2 500, 3 500",
  "2 500 3 500 4 500 5 500",
  "2.500 3.500 4.500",
  "année scolaire 2025 2026",
  "2025 - 2026",
  "saison 2025 2026",
  "2024 2025",
  "ticket n° 45879632",
  "commande n° 97123456",
  "20 L, 25 L, 30 L, 45 L",
  "5 l 25 l 30 l",
  "Pointure 42 43 44 45",
  "24 36 48 60",
  "20 30 40 50",
  "20 21 22 23",
  "chambres 20 - 21 - 22 - 23",
  "\u{1F956} 20 \u{1F95B} 25 \u{1F34C} 30 \u{1F34A} 45",
  "2000 2500",
  "2000, 2500, 3000",
  "prix: 1500, 2500, 3500, 4500",
  "Prix : 2500 / 3500 selon taille",
  "2500-3500 F",
  "4500 5500 F",
  "5000 6000",
  "9500 4500",
  "2500 3500",
  "FCFA 2500-3500",
  "16/10/2026-17/10/2026",
  "du 16/10/2026 au 20/10/2026",
  "16/10/2026 20/10/2026",
  "ticket 45879632",
  "facture 50012345",
  "réf. 55123456",
  "commande n° 61234567",
  "12:34",
  "Rendez-vous au point info de l'université",
  "On se voit au point co",
  "faire le point tv",
  "Je suis au Point Store",
  "Je suis arrivé.Me voici",
  "Je pars.Info: le marché ferme",
  "Il fait chaud.Tv allumée",
  "merci beaucoup.App bien",
  "Prix 2500 / 3500 / 4500 / 5500",
  "Prix 2 500 / 3 500",
  "2 500 3 500",
  "2.500 / 3.500",
  "prix: 2 500 - 4 500",
  "🥖 20 🥛 25 🍌 30 🍊 45",
  "🍅 25 🧅 30 🥔 45 🍌 60",
  "25 🍅, 30 🧅, 45 🥔, 60 🍌",
  "Prix: 25 ✅ 30 ✅ 45 ✅ 60",
  "Tickets : 20 ; 25 ; 30 ; 45",
  "2*3*4*5*6*7*8*9",
  "étages 2|3|4|5|6|7|8|9",
  "20 ' 25 ' 30 ' 45",
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

describe("anti-régression des relectures", () => {
  // Relecture de 77b5cc9 : prix côte à côte, point/dot, point collé, plages de dates, séparateurs, bundle client.
  // Relecture de f6b320b : vrais numéros contenant 00/50, suffixes toujours masqués, forme entre crochets,
  // référence seulement pour un bloc collé, listes à symboles, milliers sans devise.
  it("masque tout vrai numéro écrit normalement, quel que soit le regroupement", () => {
    for (const input of ["9712 5000", "9712 3400", "9750 1234", "97 1250 34", "97 12 3450", "971250 34", "97 123400", "9712 3456", "97.12.34.50", "970 123 45", "97-12-50-00"]) {
      expect(maskContacts(input).text, input).toBe(M)
    }
  })

  it("ne masque pas les prix ronds côte à côte", () => {
    for (const input of ["2000 2500", "9500 4500", "5000 6000", "2500 / 3500", "Prix 2500 / 3500 / 4500 / 5500", "2 500 / 3 500", "prix: 2 500 - 4 500"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
  })

  it("masque toujours les domaines dont le suffixe n'est pas un mot courant", () => {
    for (const input of ["Monsite.Com", "Rejoignez Moncv.Net", "Portfolio.Io", "Jean.Dupont.Net", "Site.Bj", "Contactez-moi sur Moncv.Bj", "Rdv au Bénin.Bj"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
  })

  it("lit « point » en lettres : crochets toujours, forme espacée seulement devant un suffixe sans ambiguïté", () => {
    for (const input of ["monsite point com", "monsite(point)com", "monsite [dot] bj", "monsite dot fr"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
    for (const input of ["au point info", "au point co", "faire le point tv"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
  })

  it("une référence annoncée par un mot ne protège qu'un bloc collé", () => {
    expect(maskContacts("ticket 45879632").masked).toBe(false)
    expect(maskContacts("facture 50012345").masked).toBe(false)
    expect(maskContacts("Facture 97 12 34 56").masked).toBe(true)
    expect(maskContacts("mono 97123456").masked).toBe(true)
  })

  it("un écart de symboles doit être identique et collé aux chiffres", () => {
    for (const input of ["01*97*12*34*56", "01|97|12|34|56", "97\u{1F4DE}12\u{1F4DE}34\u{1F4DE}56"]) {
      expect(maskContacts(input).text, input).toBe(M)
    }
    // Écarts mélangés collés : depuis la relecture de 7642273, "01*97|12*34|56" est masqué (passe tolérante, groupes de 2 chiffres).
    for (const input of ["20 ; 25 ; 30 ; 45", "2*3*4*5*6*7*8*9"]) {
      expect(maskContacts(input).text, input).toBe(input)
    }
  })

  it("coupe l'entrée trop longue sans casser une paire de substitution", () => {
    const text = `${"a".repeat(3999)}\u{1F600}`
    const out = maskContacts(text).text
    expect(out.length).toBeLessThanOrEqual(4000)
    expect(out).not.toMatch(/[\ud800-\udbff]$/)
    expect(maskDigitRuns(text)).not.toMatch(/[\ud800-\udbff]$/)
  })
})

describe("anti-régression de la troisième relecture", () => {
  it("garde intactes les listes de montants à milliers, virgules comprises", () => {
    for (const input of ["Les prix : 2 500, 3 500, 4 500", "prix 2 500, 3 500 ou 4 500 F", "2.500, 3.500", "1 500, 2 500, 3 500", "2.500 3.500 4.500"]) {
      expect(maskContacts(input).text, input).toBe(input)
    }
  })

  it("« n° » veut dire numéro : il ne protège un bloc que derrière un mot de référence", () => {
    for (const input of ["mon n° 96457823", "Mon n°: 96457823", "votre n° 96457823", "N° 96457823", "mon n°96457823", "mon no 96457823"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
    for (const input of ["commande n° 97123456", "ticket n° 45879632"]) expect(maskContacts(input).masked, input).toBe(false)
  })

  it("un possessif ou un mot de contact lève la protection de référence", () => {
    for (const input of ["mon ticket 96457823", "ticket 96457823 appelez-moi", "ticket 96457823 (whatsapp)", "code: 96457823 c'est mon whatsapp"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
  })

  it("laisse intactes les années scolaires et les suites arithmétiques, sauf mot de contact", () => {
    for (const input of ["année scolaire 2025 2026", "2025 - 2026", "2024 2025", "2025 2026 2027 2028", "Pointure 42 43 44 45", "chambres 20 - 21 - 22 - 23"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
    expect(maskContacts("tel 20 21 22 23").masked).toBe(true)
  })

  it("masque les prix ronds quand un mot de contact les précède", () => {
    for (const input of ["appelez 9700 1250", "whatsapp 9750 1200", "mon num 9600 1250", "tel 6650 0050"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
  })

  it("masque les écarts de symboles mélangés ou entourés d'espaces, mais pas les listes", () => {
    for (const input of ["97 12\u{1F642}34 56", "97 * 12 * 34 * 56", "97*12-34*56", "97 12 ... 34 56", "97 12 -- 34 56"]) {
      expect(maskContacts(input).text, input).toBe(M)
    }
    for (const input of ["2 * 3 * 4 * 5", "\u{1F956} 20 \u{1F95B} 25 \u{1F34C} 30 \u{1F34A} 45", "Prix: 25 \u2705 30 \u2705 45 \u2705 60"]) {
      expect(maskContacts(input).masked, input).toBe(false)
    }
  })

  it("l'unité litre n'est pas lue comme un 1 ; « 2 500 » est laissé avant un numéro", () => {
    expect(maskContacts("5 l 25 l 30 l").masked).toBe(false)
    expect(maskContacts("2 500 97 12 34 56").text).toBe(`2 500 ${M}`)
    expect(maskContacts("+ 229 01 96 45 78 23").text).toBe(M)
  })

  // Limites connues, documentées et volontairement non testées comme masquées ou intactes : liens exotiques
  // ("Monsite.Me", "rdv au point com de Cotonou", "D'accord.Com bien ?"), homoglyphes cyrilliques, chiffres
  // arabes-indiens, "97 12 et 34 56", "Ticket 4587 9632", faux positifs de 4 nombres à 2 chiffres hors suite
  // arithmétique (Taille 42, 44, 46, 49), numéro envoyé en plus de SPLIT_LOOKBACK messages, "le prix.net est 500".
})

describe("e-mails et liens : cas limites", () => {
  it("lit les domaines en capitales ou sans majuscule initiale comme des adresses", () => {
    for (const input of ["EXEMPLE.COM", "ecrire a exemple.fr svp", "jean@gmail . com", "youtu.be/abc", "discord.gg/xyz"]) {
      expect(maskContacts(input).masked, input).toBe(true)
    }
  })

  it("ne réécrit point et dot que pour les e-mails et les réseaux", () => {
    expect(maskContacts("jean point dupont arobase gmail point com").text).toBe(M)
    expect(maskContacts("wa point me/22901971234").text).toBe(M)
    expect(maskContacts("au point info").masked).toBe(false)
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
    for (const text of ["ecrivez moi sur whats app", "Appelle moi", "mon e-mail", "par mobile money", "Paie-moi en cash", "sur wtsp", "mon insta", "ajoute-moi sur fb", "watsapp stp"]) {
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

  it("ne coupe pas une paire de substitution ni un masque en tronquant", () => {
    const text = "t.me,x \u{1F600} ".repeat(200)
    const out = maskContacts(text).text
    expect(out.length).toBeLessThanOrEqual(4000)
    expect(out.endsWith(M)).toBe(true)
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/)
    expect(out.replaceAll(M, "")).not.toMatch(/\[coordonn/)
  })

  it("ne laisse aucun chiffre du numéro dans la sortie", () => {
    // Seuls les chiffres du texte voisin (« 2 500 », « il y a 3 ») peuvent subsister : ceux du numéro, jamais.
    for (const [input, expected] of PHONES) {
      const digits = (text) => text.replace(/[^0-9]/g, "")
      expect(digits(maskContacts(input).text), input).toBe(digits(expected))
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

  it("traite chaque texte piège de 2000 et de 4000 caractères en moins de 50 ms", () => {
    maskContacts("Échauffement 01 97 12 34 56 jean@gmail.com https://t.me/x") // compile les expressions
    const cases = Object.entries(TRAPS).flatMap(([name, text]) => [
      [name, text.slice(0, 2000)],
      [`${name} x2`, text.repeat(2).slice(0, 4000)],
    ])
    // Chaque cas est échauffé puis chronométré 5 fois ; on garde le meilleur passage par fonction (stable sous charge).
    const bestOf = (fn) => {
      fn()
      let best = Infinity
      for (let run = 0; run < 5; run++) {
        const start = performance.now()
        fn()
        best = Math.min(best, performance.now() - start)
      }
      return best
    }
    for (const [name, input] of cases) {
      expect(maskContacts(input).text.length, name).toBeLessThanOrEqual(4000)
      for (const [label, fn] of [
        ["maskContacts", () => maskContacts(input)],
        ["detectSplitPhone", () => detectSplitPhone([input], input)],
        ["maskDigitRuns", () => maskDigitRuns(input)],
      ]) {
        const best = bestOf(fn)
        expect(best, `${name} ${label}: ${best.toFixed(1)} ms`).toBeLessThan(50)
      }
    }
  })
})
