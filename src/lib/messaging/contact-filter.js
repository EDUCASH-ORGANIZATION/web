// Détection et masquage des coordonnées dans un texte de messagerie (RD-MSG-01).
// Module PUR, partagé client (avertissement pendant la saisie du message) et serveur (masquage, autorité) :
// aucun accès aux données, aucun import serveur. La valeur détectée n'est jamais journalisée ni renvoyée à part :
// seuls les TYPES sont exposés.
//
// Principe : le texte est normalisé dans une copie (minuscules, sans accents, chiffres Unicode ramenés à l'ASCII,
// caractères invisibles retirés, chiffres écrits en lettres convertis), chaque caractère de la copie gardant sa position
// dans le texte d'ORIGINE. Les détecteurs travaillent sur la copie ; le masquage remplace la portion d'origine.
// Toutes les expressions régulières sont à quantificateurs bornés ou sans imbrication ambiguë (pas de retour arrière
// catastrophique) et la recherche des numéros est linéaire.

import { CONTACT_KEYWORDS, PAYMENT_KEYWORDS } from "@/lib/messaging/contact-keywords"
import { SPLIT_LOOKBACK, CONTACT_KINDS, MASKABLE_KINDS } from "@/lib/messaging/moderation-rules"

export { CONTACT_KINDS, MASKABLE_KINDS }
export const MASK_TOKEN = "[coordonnées masquées]"

/** Longueur maximale analysée et renvoyée (le serveur limite déjà un message à 2000 caractères). */
const MAX_TEXT = 4000
/** Plafond du compteur de détections (colonne match_count du journal : 1 à 50). */
const MAX_COUNT = 50
/** Au plus 17 chiffres examinés par fenêtre : 00 + indicatif + 15 chiffres au maximum. */
const MAX_WINDOW_DIGITS = 17

// ─── Constantes de domaine ─────────────────────────────────────────────────────────────────

// Préfixes à 2 chiffres des anciens numéros béninois à 8 chiffres (avant le passage à 10 chiffres du 30/11/2024).
// Volontairement larges : fixes (20 à 29), mobiles MTN, Moov et Celtiis (40 à 49, 50 à 59, 60 à 69, 90 à 99).
// Un nombre de 8 chiffres isolé hors de cette liste (12345678, 30012345...) n'est pas un numéro et n'est pas masqué.
const BENIN_PREFIXES = new Set([
  ...["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"],
  ...["40", "41", "42", "43", "44", "45", "46", "47", "48", "49"],
  ...["50", "51", "52", "53", "54", "55", "56", "57", "58", "59"],
  ...["60", "61", "62", "63", "64", "65", "66", "67", "68", "69"],
  ...["90", "91", "92", "93", "94", "95", "96", "97", "98", "99"],
])

/**
 * Indicatifs pays connus (chiffres seuls). Copie de COUNTRY_CODES (src/lib/utils/phone.js) écrite en dur pour ne pas
 * tirer zod dans le bundle client ; un test vérifie la parité.
 */
export const COUNTRY_DIGITS = ["229", "225", "233", "234", "221", "226", "227", "242", "241", "237", "33", "1", "44", "49", "91", "86"]

/** Domaines EduCash : jamais masqués (D10). */
const ALLOWED_HOST = /(?:^|\.)educash\.bj$/

// ─── Table des chiffres écrits en lettres (français, belge, suisse, anglais) ─────────────────

const UNITS = new Map(
  Object.entries({
    zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
    one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9,
  }),
)
const FR_TEENS = new Map(Object.entries({ dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16 }))
const EN_TEENS = new Map(
  Object.entries({ ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }),
)
const TENS = new Map(
  Object.entries({
    vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, septante: 70, huitante: 80, octante: 80, nonante: 90,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  }),
)

// ─── Normalisation avec correspondance des positions ───────────────────────────────────────

/**
 * Texte normalisé et, pour chaque caractère, sa position de début et de fin (exclue) dans le texte d'origine.
 * `fl` marque les caractères protégés (dates, heures, montants) qui ne participent jamais à un numéro.
 * @typedef {{ s: string, st: number[], en: number[], fl: number[] }} Mapped
 */

/** @returns {Mapped} */
function normalize(text) {
  let s = ""
  const st = []
  const en = []
  let pos = 0
  for (const ch of text) {
    const len = ch.length
    const out = ch
      .replace(/[‘’ʼ]/g, "'")
      .normalize("NFKD")
      .replace(/[\p{M}\p{Cf}]/gu, "")
      .toLowerCase()
    if (out === "") {
      // Caractère invisible, accent isolé ou fin de chiffre émoji : absorbé par le caractère précédent.
      if (en.length) en[en.length - 1] = pos + len
    } else {
      for (let k = 0; k < out.length; k++) {
        s += out[k]
        st.push(pos)
        en.push(pos + len)
      }
    }
    pos += len
  }
  return { s, st, en, fl: new Array(s.length).fill(0) }
}

/**
 * Remplace des plages de la copie normalisée ; les caractères de remplacement pointent sur toute la plage d'origine.
 * @param {Mapped} t
 * @param {{ from: number, to: number, rep: string }[]} edits triées, sans chevauchement
 * @returns {Mapped}
 */
function rewrite(t, edits) {
  if (!edits.length) return t
  let s = ""
  const st = []
  const en = []
  const fl = []
  const copy = (a, b) => {
    s += t.s.slice(a, b)
    for (let k = a; k < b; k++) {
      st.push(t.st[k])
      en.push(t.en[k])
      fl.push(t.fl[k])
    }
  }
  let pos = 0
  for (const e of edits) {
    copy(pos, e.from)
    s += e.rep
    for (let k = 0; k < e.rep.length; k++) {
      st.push(t.st[e.from])
      en.push(t.en[e.to - 1])
      fl.push(0)
    }
    pos = e.to
  }
  copy(pos, t.s.length)
  return { s, st, en, fl }
}

const SEP_CHARS = new Set([" ", "\t", "\n", "\r", ".", "-", "_", "/", ",", "(", ")"])
const isLetter = (c) => c !== undefined && c >= "a" && c <= "z"
const isDigit = (c) => c !== undefined && c >= "0" && c <= "9"

/** Un chiffre est-il à moins de 2 séparateurs de la position `i`, dans la direction `dir` ? */
function digitNear(s, i, dir) {
  for (let k = 1; k <= 3; k++) {
    const c = s[i + dir * k]
    if (isDigit(c)) return true
    if (!SEP_CHARS.has(c)) return false
  }
  return false
}

/** O, l et I isolés et collés à des chiffres (« O1 97 », « 6l 23 ») sont lus comme 0 et 1. */
function fixLookalikes(t) {
  const edits = []
  const { s } = t
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== "o" && c !== "l" && c !== "i") continue
    if (isLetter(s[i - 1]) || isLetter(s[i + 1]) || s[i + 1] === "'" || s[i - 1] === "'") continue
    if (digitNear(s, i, -1) || digitNear(s, i, 1)) edits.push({ from: i, to: i + 1, rep: c === "o" ? "0" : "1" })
  }
  return rewrite(t, edits)
}

// ─── Protection : dates, heures, montants ──────────────────────────────────────────────────

// Ni précédé d'un chiffre ni d'un chiffre suivi d'un séparateur : on ne coupe jamais un nombre en son milieu.
const NOT_AFTER_DIGIT = "(?<!\\d)(?<!\\d[ .,\\-/])"
// Pour une date : on exclut seulement un chiffre ou un séparateur de date collé devant (une date peut suivre une autre).
const DATE_START = "(?<![\\d/.\\-])"
const DATE_FR = "(?:0?[1-9]|[12]\\d|3[01])[/.](?:0?[1-9]|1[0-2])[/.]\\d{4}"
const CUR = "(?:fcfa|f\\s?cfa|cfa|xof|francs?|frs?|f)(?![a-z0-9])"
const GROUPED = "\\d{1,3}(?:[ .,]\\d{3})+"

const PROTECT_PATTERNS = [
  // jj/mm/aaaa, jj-mm-aa, jj.mm.aaaa (même séparateur), sans suite « -34 » qui ferait un numéro.
  { re: new RegExp(`${DATE_START}(?:0?[1-9]|[12]\\d|3[01])([/.\\-])(?:0?[1-9]|1[0-2])\\1(?:\\d{4}|\\d{2})(?!\\d)(?![/.\\-]\\d)`, "g"), group: 0 },
  // plage de dates : 16/10/2026-17/10/2026, 16/10/2026 au 20/10/2026
  { re: new RegExp(`${DATE_START}${DATE_FR}\\s?(?:-|a|au)\\s?${DATE_FR}(?!\\d)(?![/.\\-]\\d)`, "g"), group: 0 },
  // aaaa-mm-jj
  { re: new RegExp(`${DATE_START}(?:19|20)\\d{2}([/.\\-])(?:0?[1-9]|1[0-2])\\1(?:0?[1-9]|[12]\\d|3[01])(?!\\d)(?![/.\\-]\\d)`, "g"), group: 0 },
  // aaaammjj collé (référence datée : 20261016)
  { re: new RegExp(`${NOT_AFTER_DIGIT}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])(?!\\d)`, "g"), group: 0 },
  // référence « année-numéro » (2026-0042, 2026/0042), sinon lue comme un ancien numéro fixe commençant par 20
  { re: new RegExp(`${NOT_AFTER_DIGIT}20\\d{2}[-/]\\d{4}(?!\\d)(?![-/]\\d)`, "g"), group: 0 },
  // 14h30, 14:30, 10h
  { re: /(?<![\d:])(?:[01]?\d|2[0-3])(?:[h:][0-5]\d(?!\d)|h(?![a-z\d]))/g, group: 0 },
  // 15 000 FCFA, 150000 F, 25.000 XOF, 1 500 000 francs (7 chiffres isolés au plus : 8 chiffres collés restent un numéro)
  { re: new RegExp(`${NOT_AFTER_DIGIT}(${GROUPED}|\\d{1,7})(?:[.,]\\d{1,2})?\\s?${CUR}`, "g"), group: 1 },
  // fourchette de prix : 2500-3500 F, 2500 a 3500 FCFA
  { re: new RegExp(`${NOT_AFTER_DIGIT}\\d{1,7}\\s?(?:-|/|a)\\s?\\d{1,7}\\s?${CUR}`, "g"), group: 0 },
  // FCFA 2500-3500
  { re: /(?:fcfa|cfa|xof)\s?\d{1,7}\s?(?:-|\/|a)\s?\d{1,7}(?!\d)/g, group: 0 },
  // FCFA 15000
  { re: new RegExp(`(?:fcfa|cfa|xof)\\s?(${GROUPED}|\\d{1,7})(?!\\d)`, "g"), group: 1 },
  // 45 000 000, 25.000 : milliers finissant par 000
  { re: new RegExp(`${NOT_AFTER_DIGIT}\\d{1,3}(?:[ .,]\\d{3})*[ .,]000(?!\\d)(?![ .,]\\d)`, "g"), group: 0 },
]

/** Marque dans `t.fl` les dates, heures et montants. */
function protect(t) {
  for (const { re, group } of PROTECT_PATTERNS) {
    for (const m of t.s.matchAll(re)) {
      const from = group === 0 ? m.index : m.index + m[0].indexOf(m[group])
      const to = from + m[group].length
      for (let k = from; k < to; k++) t.fl[k] = 1
    }
  }
}

// ─── Chiffres écrits en lettres ────────────────────────────────────────────────────────────

/** Valeur du nombre écrit en lettres commençant au jeton `i`, ou null. */
function parseNumberWord(tk, text, i) {
  const at = (k) => {
    if (k >= tk.length) return null
    if (k > i && !/^[\s-]{1,2}$/.test(text.slice(tk[k - 1].to, tk[k].from))) return null
    return tk[k].w
  }
  const tail = (base, last, allowTeens) => {
    let k = last + 1
    let n = at(k)
    if (n === "et" && ["un", "une", "onze"].includes(at(k + 1))) {
      k++
      n = at(k)
    }
    if (allowTeens && FR_TEENS.has(n)) {
      let v = base + FR_TEENS.get(n)
      let end = k
      const after = at(k + 1)
      if (n === "dix" && (after === "sept" || after === "huit" || after === "neuf")) {
        v += UNITS.get(after)
        end = k + 1
      }
      return { v, last: end }
    }
    if (n && n !== "zero" && n !== "et" && UNITS.has(n)) return { v: base + UNITS.get(n), last: k }
    return { v: base, last }
  }
  const w = tk[i].w
  if (w === "quatre" && (at(i + 1) === "vingt" || at(i + 1) === "vingts")) return tail(80, i + 1, true)
  if (w === "soixante") return tail(60, i, true)
  if (TENS.has(w)) return tail(TENS.get(w), i, false)
  if (FR_TEENS.has(w)) {
    const after = at(i + 1)
    if (w === "dix" && (after === "sept" || after === "huit" || after === "neuf")) return { v: 10 + UNITS.get(after), last: i + 1 }
    return { v: FR_TEENS.get(w), last: i }
  }
  if (EN_TEENS.has(w)) return { v: EN_TEENS.get(w), last: i }
  if (UNITS.has(w)) return { v: UNITS.get(w), last: i }
  return null
}

// Écart toléré entre deux groupes de chiffres : espaces, retours à la ligne, ponctuation courante, émojis (6 au plus).
// Le deux-points est exclu : 12:34 est une heure.
const CHAIN_GAP = /^(?:[\s.\-_/,()*|;~']|\p{Extended_Pictographic}){0,6}$/u

/** Chiffres sous forme de texte où les caractères protégés ne sont plus des chiffres. */
function digitView(t) {
  let u = ""
  for (let k = 0; k < t.s.length; k++) u += t.fl[k] && isDigit(t.s[k]) ? "#" : t.s[k]
  return u
}

/**
 * Convertit les nombres écrits en lettres, seulement quand ils font partie d'une suite d'au moins 2 jetons numériques
 * (chiffres ou mots) séparés par des séparateurs : un « un » isolé reste un mot.
 */
function convertNumberWords(t) {
  const words = []
  const tk = []
  for (const m of t.s.matchAll(/[a-z]+/g)) tk.push({ w: m[0], from: m.index, to: m.index + m[0].length })
  for (let i = 0; i < tk.length; ) {
    const r = parseNumberWord(tk, t.s, i)
    if (r) {
      const item = { from: tk[i].from, to: tk[r.last].to, word: true, value: r.v }
      if (!t.fl.slice(item.from, item.to).some(Boolean)) words.push(item)
      i = r.last + 1
    } else i++
  }
  if (!words.length) return t
  const items = [...words]
  for (const m of digitView(t).matchAll(/\d+/g)) items.push({ from: m.index, to: m.index + m[0].length, word: false })
  items.sort((a, b) => a.from - b.from)
  const edits = []
  let chain = []
  const flush = () => {
    if (chain.length >= 2) for (const it of chain) if (it.word) edits.push({ from: it.from, to: it.to, rep: String(it.value) })
    chain = []
  }
  for (const it of items) {
    const prev = chain[chain.length - 1]
    if (prev && !CHAIN_GAP.test(t.s.slice(prev.to, it.from))) flush()
    chain.push(it)
  }
  flush()
  return rewrite(t, edits)
}

// ─── Numéros de téléphone ──────────────────────────────────────────────────────────────────

/** Les chiffres `r` (avec indicatif explicite si `plus`) forment-ils un numéro ? */
function isPhoneDigits(r, plus) {
  if (!plus && r.length >= 10 && r.startsWith("00")) {
    plus = true
    r = r.slice(2)
  }
  if (plus) {
    if (COUNTRY_DIGITS.some((c) => r.startsWith(c) && r.length - c.length >= 8 && r.length - c.length <= 10)) return true
    return r.length >= 11 && r.length <= 15
  }
  if (r.length === 10 && r.startsWith("01")) return true
  if (r.length === 8 && BENIN_PREFIXES.has(r.slice(0, 2))) return true
  if ((r.length === 11 || r.length === 13) && r.startsWith("229")) return r.length === 11 || r.startsWith("01", 3)
  return false
}

/**
 * Suites de groupes de chiffres séparés par au plus 3 séparateurs (espaces, . - _ / , parenthèses).
 * @returns {{ start: number, end: number, digits: string, plus: boolean }[][]}
 */
function digitChains(t) {
  const u = digitView(t)
  const chains = []
  let chain = []
  let prevEnd = -1
  for (const m of u.matchAll(/\d+/g)) {
    const start = m.index
    if (chain.length && !CHAIN_GAP.test(u.slice(prevEnd, start))) {
      chains.push(chain)
      chain = []
    }
    const plus = u[start - 1] === "+" || (u[start - 1] === " " && u[start - 2] === "+")
    chain.push({ start, end: start + m[0].length, digits: m[0], plus })
    prevEnd = start + m[0].length
  }
  if (chain.length) chains.push(chain)
  return chains
}

// Un bloc de 8 chiffres précédé de ces mots est une référence, pas un numéro (ticket 45879632, facture 50012345).
const REFERENCE_BEFORE = /(?:ticket|ref|reference|facture|commande|code|n°|nº)\s{0,2}[:.]?\s{0,2}$/

/**
 * Filtre les faux numéros de 8 chiffres sans indicatif : deux prix de 4 chiffres côte à côte (2000 2500, 1500, 2500) ou
 * une référence annoncée par un mot (ticket, facture...). Les autres formes (10 chiffres en 01, indicatif +) passent.
 */
function plausibleGroups(chain, i, j, u) {
  if (chain[i].plus) return true
  let total = 0
  for (let k = i; k <= j; k++) total += chain[k].digits.length
  if (total !== 8) return true
  if (j > i && chain.slice(i, j + 1).some((g) => g.digits.length >= 4 && /(?:00|50)$/.test(g.digits))) return false
  return !REFERENCE_BEFORE.test(u.slice(Math.max(0, chain[i].start - 20), chain[i].start))
}

/** Numéros trouvés dans la copie normalisée : plages [start, end) de `t`. */
function phoneRanges(t) {
  const ranges = []
  const u = digitView(t)
  for (const chain of digitChains(t)) {
    let i = 0
    while (i < chain.length) {
      let digits = ""
      let best = -1
      for (let j = i; j < chain.length; j++) {
        digits += chain[j].digits
        if (digits.length > MAX_WINDOW_DIGITS) break
        if (isPhoneDigits(digits, chain[i].plus) && plausibleGroups(chain, i, j, u)) best = j
      }
      if (best >= 0) {
        ranges.push({ start: chain[i].start, end: chain[best].end })
        i = best + 1
      } else i++
    }
  }
  return ranges
}

// ─── E-mails, liens, réseaux ───────────────────────────────────────────────────────────────

const AT_WORDS = /\s{0,3}[([{]\s{0,3}(?:at|arobase|arrobase)\s{0,3}[)\]}]\s{0,3}|\s{1,3}(?:arobase|arrobase|at)\s{1,3}|\s{0,3}@\s{0,3}/g
const TLDS = "com|net|org|bj|fr|io|me|co|info|biz|app|tv|xyz|link|site|online|shop|store|africa|ci|ly|gl"
// « point » et « dot » écrits en lettres, et un point isolé entre espaces seulement s'il est suivi d'un domaine connu.
const DOT_WORDS = new RegExp(
  `\\s{0,3}[([{]\\s{0,3}(?:dot|point)\\s{0,3}[)\\]}]\\s{0,3}|\\s{1,3}(?:dot|point)\\s{1,3}|\\s{1,3}\\.\\s{1,3}(?=(?:${TLDS})(?![a-z0-9]))`,
  "g",
)

const EMAIL_RE = /(?<![a-z0-9._%+-])[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,24}(?![a-z0-9])/g
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']{1,200}/g
const SOCIAL_HOSTS =
  "wa\\.me|chat\\.whatsapp\\.com|api\\.whatsapp\\.com|whatsapp\\.com|t\\.me|telegram\\.me|telegram\\.org|m\\.me|fb\\.me|fb\\.com|facebook\\.com|instagram\\.com|tiktok\\.com|snapchat\\.com|snap\\.com|twitter\\.com|linkedin\\.com|youtu\\.be|discord\\.gg"
const SOCIAL_RE = new RegExp(
  `(?<![a-z0-9@.\\-])(?:[a-z0-9-]{1,30}\\.)?(?:${SOCIAL_HOSTS})(?![a-z0-9])(?:[/?#][^\\s]{0,200})?`,
  "g",
)
const SOCIAL_HOST_RE = new RegExp(`(?:^|\\.)(?:${SOCIAL_HOSTS})$`)
const DOMAIN_RE = new RegExp(
  `(?<![a-z0-9@.-])(?:[a-z0-9][a-z0-9-]{0,62}\\.){1,5}(?:${TLDS})(?![a-z0-9])(?:[/?#][^\\s]{0,200})?`,
  "g",
)

/** Nom d'hôte d'un lien ou d'un domaine nu (sans schéma, identifiants, port ni chemin). */
function hostOf(raw) {
  let h = raw.replace(/^https?:\/\//, "")
  h = h.split(/[/?#]/, 1)[0]
  h = h.slice(h.lastIndexOf("@") + 1).replace(/:\d*$/, "").replace(/^www\./, "")
  return h
}

/**
 * Un domaine nu (sans schéma, www. ni chemin) dont le suffixe commence par une majuscule suivie d'une minuscule est une
 * phrase sans espace après le point (« Je pars.Info », « arrivé.Me voici »), pas une adresse (EXEMPLE.COM reste masqué).
 */
function isSentenceJoin(src, t0, raw, index) {
  if (/^(?:https?:\/\/|www\.)/.test(raw) || /[/?#]/.test(raw)) return false
  const at = index + raw.lastIndexOf(".") + 1
  const first = src[t0.st[at]]
  const second = src[t0.st[at + 1]]
  return first !== undefined && first !== first.toLowerCase() && second !== undefined && second === second.toLowerCase() && second !== second.toUpperCase()
}

/** E-mails, liens et réseaux : spans [start, end) du texte d'origine `src` avec leur type. */
function linkRanges(t0, src) {
  const atEdits = []
  for (const m of t0.s.matchAll(AT_WORDS)) atEdits.push({ from: m.index, to: m.index + m[0].length, rep: "@" })
  const t1 = rewrite(t0, atEdits)
  const dotEdits = []
  for (const m of t1.s.matchAll(DOT_WORDS)) dotEdits.push({ from: m.index, to: m.index + m[0].length, rep: "." })
  const t = rewrite(t1, dotEdits)

  /** @type {{ s: number, e: number, kind: string }[]} */
  const found = []
  // Sur la copie où « arobase » et « point » sont réécrits : e-mails et réseaux déguisés.
  for (const m of t.s.matchAll(EMAIL_RE)) {
    if (ALLOWED_HOST.test(m[0].slice(m[0].lastIndexOf("@") + 1))) continue
    found.push({ s: t.st[m.index], e: t.en[m.index + m[0].length - 1], kind: "email" })
  }
  for (const m of t.s.matchAll(SOCIAL_RE)) {
    const raw = m[0].replace(/[.,;:!?)\]}]+$/, "")
    if (!raw || ALLOWED_HOST.test(hostOf(raw))) continue
    found.push({ s: t.st[m.index], e: t.en[m.index + raw.length - 1], kind: "social" })
  }
  // Sur la copie non réécrite : « au point info » ne devient pas un domaine.
  for (const re of [URL_RE, DOMAIN_RE]) {
    for (const m of t0.s.matchAll(re)) {
      const raw = m[0].replace(/[.,;:!?)\]}]+$/, "")
      const host = hostOf(raw)
      if (!raw || ALLOWED_HOST.test(host) || (re === DOMAIN_RE && isSentenceJoin(src, t0, raw, m.index))) continue
      found.push({ s: t0.st[m.index], e: t0.en[m.index + raw.length - 1], kind: SOCIAL_HOST_RE.test(host) ? "social" : "link" })
    }
  }
  return found
}

// ─── Mots-clés (avertissement et journal, jamais de masquage) ──────────────────────────────

function keywordRegex(list) {
  const parts = list
    .map((p) =>
      p
        .replace(/[\u2018\u2019]/g, "'")
        .normalize("NFKD")
        .replace(/[\p{M}\p{Cf}]/gu, "")
        .toLowerCase(),
    )
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]{1,3}"))
  return new RegExp(`(?<![a-z0-9])(?:${parts.join("|")})(?![a-z0-9])`, "g")
}
const CONTACT_KEYWORD_RE = keywordRegex(CONTACT_KEYWORDS)
const PAYMENT_KEYWORD_RE = keywordRegex(PAYMENT_KEYWORDS)

// ─── Analyse et masquage ───────────────────────────────────────────────────────────────────

/** Texte normalisé, prêt pour la recherche de numéros (lookalikes corrigés, protections posées, chiffres en lettres). */
function digitsCopy(t0) {
  const t1 = fixLookalikes(t0)
  protect(t1)
  return convertNumberWords(t1)
}

/** Fusionne les spans qui se chevauchent ; « social » l'emporte sur « link » pour une même adresse. */
function mergeSpans(spans) {
  const sorted = spans.filter((sp) => sp.e > sp.s).sort((a, b) => a.s - b.s || b.e - a.e)
  const groups = []
  for (const sp of sorted) {
    const last = groups[groups.length - 1]
    if (last && sp.s < last.e) {
      last.e = Math.max(last.e, sp.e)
      last.kinds.add(sp.kind)
    } else groups.push({ s: sp.s, e: sp.e, kinds: new Set([sp.kind]) })
  }
  for (const g of groups) if (g.kinds.has("social")) g.kinds.delete("link")
  return groups
}

/** @returns {{ groups: { s: number, e: number, kinds: Set<string> }[], keywordKinds: Set<string>, keywordCount: number, src: string }} */
function analyze(text) {
  const src = typeof text === "string" ? text.slice(0, MAX_TEXT) : ""
  const t0 = normalize(src)
  const t2 = digitsCopy(t0)
  const spans = linkRanges(t0, src)
  for (const r of phoneRanges(t2)) spans.push({ s: t2.st[r.start], e: t2.en[r.end - 1], kind: "phone" })
  const keywordKinds = new Set()
  let keywordCount = 0
  for (const [re, kind] of [[CONTACT_KEYWORD_RE, "contact_keyword"], [PAYMENT_KEYWORD_RE, "payment_keyword"]]) {
    const hits = [...t0.s.matchAll(re)].length
    if (hits) keywordKinds.add(kind)
    keywordCount += hits
  }
  return { groups: mergeSpans(spans), keywordKinds, keywordCount, src }
}

function summarize({ groups, keywordKinds, keywordCount }) {
  const found = new Set(keywordKinds)
  for (const g of groups) for (const k of g.kinds) found.add(k)
  return {
    kinds: CONTACT_KINDS.filter((k) => found.has(k)),
    count: Math.min(groups.length + keywordCount, MAX_COUNT),
  }
}

const FUSE_GAP = /^[\s,;.\-/|]{0,3}$/

/** Coupe à 4000 caractères en gardant la place d'un masque final, sans couper un point de code ni un masque en deux. */
function truncateWithMask(out) {
  let body = out.slice(0, MAX_TEXT - MASK_TOKEN.length)
  const last = body.charCodeAt(body.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) body = body.slice(0, -1)
  const open = body.lastIndexOf("[")
  if (open >= 0 && MASK_TOKEN.startsWith(body.slice(open))) body = body.slice(0, open)
  return body + MASK_TOKEN
}

/** Remplace les plages d'origine par MASK_TOKEN : parenthèse ou « + » collés inclus, masques voisins fusionnés. */
function buildMasked(src, groups) {
  const ranges = []
  for (const g of groups) {
    let s = g.s
    let e = g.e
    const floor = ranges.length ? ranges[ranges.length - 1].e : 0
    let opened = false
    for (let k = 0; k < 2 && s > floor && (src[s - 1] === "(" || src[s - 1] === "+"); k++) {
      opened = opened || src[s - 1] === "("
      s--
    }
    if (opened && src[e] === ")") e++
    const last = ranges[ranges.length - 1]
    if (last && FUSE_GAP.test(src.slice(last.e, s))) last.e = e
    else ranges.push({ s, e })
  }
  let out = ""
  let pos = 0
  for (const r of ranges) {
    out += src.slice(pos, r.s) + MASK_TOKEN
    pos = r.e
  }
  out += src.slice(pos)
  // Garantie de taille : un texte de 2000 caractères bourré de petites adresses peut grossir au masquage.
  return out.length > MAX_TEXT ? truncateWithMask(out) : out
}

// ─── API publique ──────────────────────────────────────────────────────────────────────────

/**
 * Types de coordonnées présents dans le texte, sans le modifier. `kinds` inclut les mots-clés (non masquables) ;
 * `count` est le nombre de détections (plafonné à 50) ; `maskable` indique qu'au moins un type masquable est présent.
 * @param {string} text
 * @returns {{ kinds: string[], count: number, maskable: boolean }}
 */
export function detectContacts(text) {
  const a = analyze(text)
  return { ...summarize(a), maskable: a.groups.length > 0 }
}

/**
 * Remplace par MASK_TOKEN les coordonnées (téléphone, e-mail, lien, réseau) ; le reste du texte est conservé à
 * l'identique. Les mots-clés (WhatsApp, MoMo...) ne sont jamais masqués mais apparaissent dans `kinds`.
 * La sortie ne dépasse jamais 4000 caractères.
 * @param {string} text
 * @returns {{ text: string, masked: boolean, kinds: string[], count: number }}
 */
export function maskContacts(text) {
  const a = analyze(text)
  const masked = a.groups.length > 0
  return { text: masked ? buildMasked(a.src, a.groups) : a.src, masked, ...summarize(a) }
}

/**
 * Le texte courant complète-t-il un numéro commencé dans les derniers messages du même expéditeur ?
 * Vrai seulement si le numéro chevauche la frontière entre un message précédent et le message courant.
 * @param {string[]} previousTexts messages texte précédents, du plus ancien au plus récent
 * @param {string} current
 * @returns {boolean}
 */
export function detectSplitPhone(previousTexts, current) {
  if (typeof current !== "string" || !Array.isArray(previousTexts)) return false
  const prev = previousTexts.filter((p) => typeof p === "string" && p).slice(-SPLIT_LOOKBACK).map((p) => p.slice(-200))
  if (!prev.length) return false
  const head = current.slice(0, 200)
  const joined = `${prev.join("\n")}\n`
  const boundary = joined.length
  const t = digitsCopy(normalize(joined + head))
  return phoneRanges(t).some((r) => t.st[r.start] < boundary && t.en[r.end - 1] > boundary)
}

/**
 * Masque toutes les suites de chiffres du texte (hors dates, heures et montants). Sert quand un numéro est découpé
 * sur plusieurs messages : les chiffres du message courant sont alors masqués.
 * @param {string} text
 * @returns {string}
 */
export function maskDigitRuns(text) {
  const src = typeof text === "string" ? text.slice(0, MAX_TEXT) : ""
  const t = digitsCopy(normalize(src))
  const spans = digitChains(t).map((chain) => ({
    s: t.st[chain[0].start],
    e: t.en[chain[chain.length - 1].end - 1],
    kind: "phone_split",
  }))
  const groups = mergeSpans(spans)
  return groups.length ? buildMasked(src, groups) : src
}
