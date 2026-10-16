import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Garde-fou RD-SEC-03b : le compartiment message-media est privé. `messages.media_url` est un identifiant, jamais
// une adresse à afficher : tout affichage passe par une adresse signée (mediaUrl issue de la signature).

const root = process.cwd()
const read = (rel) => readFileSync(join(root, rel), "utf8")

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p)
  }
  return out
}

const UI = [...walk(join(root, "src", "components")), ...walk(join(root, "src", "hooks")), ...walk(join(root, "src", "app"))]

describe("message-media : aucune adresse brute affichée", () => {
  it("aucune vue, bulle, hook ni page ne lit `media_url` (colonne identifiant, réservée aux actions)", () => {
    const offenders = UI.filter((file) => /\bmedia_url\b/.test(readFileSync(file, "utf8")))
    expect(offenders.map((f) => f.replace(root, ""))).toEqual([])
  })

  it("aucune vue ne construit une adresse publique du compartiment (getPublicUrl, /object/public/message-media)", () => {
    const offenders = UI.filter((file) => {
      const source = readFileSync(file, "utf8")
      return /object\/public\/message-media/.test(source) || (/getPublicUrl/.test(source) && /message-media|MEDIA_BUCKET/.test(source))
    })
    expect(offenders.map((f) => f.replace(root, ""))).toEqual([])
  })

  it("les bulles n'affichent que `message.mediaUrl` (src d'<img> et d'<audio>), sans lien vers l'objet", () => {
    for (const rel of [
      "src/components/client-space/messages/bubble.jsx",
      "src/components/student-space/messages/bubble.jsx",
    ]) {
      const source = read(rel)
      const srcs = [...source.matchAll(/\bsrc=\{([^}]+)\}/g)].map((m) => m[1].trim())
      expect(srcs, rel).toEqual(["message.mediaUrl", "message.mediaUrl"])
      expect(source, rel).not.toMatch(/mediaPath/)
      expect(source, rel).not.toMatch(/href=\{message\.mediaUrl\}/)
      expect(source, rel).toMatch(/onError=\{\(\) => onMediaError\?\.\(message\.id\)\}/)
    }
  })

  it("toMessage ne lit `media_url` que pour en tirer un chemin, et mediaUrl vient de la table des signatures", () => {
    const source = read("src/lib/client-space/conversations.js")
    const uses = [...source.matchAll(/row\.media_url/g)]
    expect(uses).toHaveLength(1)
    expect(source).toMatch(/mediaPathOf\(row\.media_url, row\.sender_id\)/)
    expect(source).toMatch(/mediaUrl: safeSignedMediaUrl\(signed\)/)
    expect(source).not.toMatch(/safeMediaUrl/)
  })

  it("toute lecture de message des actions passe par la signature (toMessage appelé avec la table des signatures)", () => {
    const source = read("src/lib/actions/message.actions.js")
    const calls = [...source.matchAll(/toMessage\(([^)]*)\)/g)].map((m) => m[1])
    expect(calls).toEqual(["row, userId, signed"])
    // Le service role sert UNIQUEMENT à l'insertion (RD-MSG-01) : jamais à signer ni à lire un média.
    expect([...source.matchAll(/createServiceClient\(\)/g)]).toHaveLength(1)
    const insertion = source.slice(source.indexOf("async function deliverMessage"))
    expect(insertion).toMatch(/service = createServiceClient\(\)/)
    const signing = source.slice(source.indexOf("async function signMediaPaths"), source.indexOf("/** Messages (toMessage)"))
    expect(signing).not.toMatch(/createServiceClient|service\b/)
    expect(signing).toMatch(/supabase\.storage/)
    expect(source).toMatch(/createSignedUrls\(unique, MEDIA_SIGNED_URL_TTL\)/)
  })

  it("le hook temps réel ne signe pas lui-même : il passe par resolveMedia (action serveur)", () => {
    const source = read("src/hooks/use-realtime-messages.js")
    expect(source).not.toMatch(/createSignedUrl|getPublicUrl\(/)
    expect(source).toMatch(/resolve\?\.\(\[messageId\]\)/)
  })
})
