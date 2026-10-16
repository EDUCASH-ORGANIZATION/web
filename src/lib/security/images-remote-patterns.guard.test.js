import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const { default: config } = await import("../../../next.config.mjs")
const patterns = config.images.remotePatterns

describe("next.config.mjs : images.remotePatterns", () => {
  it("n'autorise aucun joker d'hôte", () => {
    for (const p of patterns) expect(p.hostname).not.toContain("*")
  })

  it("autorise un seul motif : l'hôte exact du projet Supabase, stockage public", () => {
    expect(patterns).toEqual([
      {
        protocol: "https",
        hostname: "ymdtwtlnenxpfnxdipek.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ])
  })

  it("n'autorise jamais les URL signées (object/sign)", () => {
    // Une URL signée donne accès à un fichier privé pour 60 s : l'optimiseur d'images en
    // garderait une copie en cache bien au-delà. Ces images passent par <img>, pas next/image.
    expect(JSON.stringify(patterns)).not.toContain("object/sign")
  })

  it("ne lit aucune variable d'environnement dans le bloc images", () => {
    const source = readFileSync(resolve(__dirname, "../../../next.config.mjs"), "utf8")
    const block = source.slice(source.indexOf("images:"))
    expect(block).not.toMatch(/process\.env/)
  })
})
