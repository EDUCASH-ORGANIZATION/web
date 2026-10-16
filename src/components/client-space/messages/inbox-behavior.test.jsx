import { describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/image", () => ({
  default: ({ src, className }) => <span data-image={src} className={className} />,
}))
const nav = { pathname: "/client/messages", search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const { ClientInboxView, nextOpened } = await import("./inbox-view")
const { activeKeyOf } = await import("./inbox-list")

const M1 = "11111111-1111-4111-8111-111111111111"
const M2 = "11111111-1111-4111-8111-111111111112"
const S1 = "22222222-2222-4222-8222-222222222221"
const S2 = "22222222-2222-4222-8222-222222222222"
const S3 = "22222222-2222-4222-8222-222222222223"
const conv = (o) => ({
  key: `${M1}:${S1}`, missionId: M1, studentId: S1, name: "Awa K.", avatarUrl: null,
  missionTitle: "Traduire", state: "candidate", preview: "Bonjour", lastAt: "2026-10-13T09:48:00Z", unreadCount: 0, ...o,
})
const A = conv({ unreadCount: 2 })
const B = conv({ key: `${M1}:${S2}`, studentId: S2, name: "Sèna A.", unreadCount: 1 })
const C = conv({ key: `${M2}:${S3}`, missionId: M2, studentId: S3, name: "Rosine H.", state: "in_progress", unreadCount: 4 })
const LIST = [A, B, C]

function render(props, { pathname = "/client/messages", search = "" } = {}) {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(<ClientInboxView now="2026-10-13T12:00:00Z" {...props} />)
}
const activeRows = (html) => html.match(/<a [^>]*class="convo[^"]*is-active[^>]*>/g) ?? []

describe("ligne active : deux candidats sur la même mission", () => {
  it("exactement la ligne du studentId, pour chacun des deux", () => {
    for (const [sid, other] of [[S1, S2], [S2, S1]]) {
      const html = render({ result: { conversations: LIST }, children: <p>x</p> }, { pathname: `/client/messages/${M1}`, search: `studentId=${sid}` })
      const act = activeRows(html)
      expect(act).toHaveLength(1)
      expect(act[0]).toContain(`studentId=${sid}`)
      expect(act[0]).not.toContain(other)
    }
  })

  it("sans studentId et deux candidats : aucune ligne active, aucune devinette", () => {
    expect(activeKeyOf(LIST, `/client/messages/${M1}`, undefined)).toBeNull()
    expect(activeKeyOf(LIST, `/client/messages/${M1}`, "")).toBeNull()
    const html = render({ result: { conversations: LIST }, children: <p>x</p> }, { pathname: `/client/messages/${M1}` })
    expect(activeRows(html)).toHaveLength(0)
    expect(html).not.toContain('aria-current="true"')
  })

  it("studentId conservé dans les liens de ligne, de pastille et l'action du formulaire", () => {
    const html = render({ result: { conversations: LIST }, children: <p>x</p> }, { pathname: `/client/messages/${M1}`, search: `studentId=${S2}&q=a` })
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S1}&amp;q=a"`)
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}&amp;q=a"`)
    expect(html).toContain(`href="/client/messages/${M2}?studentId=${S3}&amp;q=a"`)
    // Filtres (pastilles) : étudiant ouvert
    expect(html).toContain(`href="/client/messages/${M1}?studentId=${S2}&amp;q=a&amp;filtre=non-lues"`)
    expect(html).toContain(`action="/client/messages/${M1}"`)
    expect(html).toContain(`name="studentId" value="${S2}"`)
  })
})

describe("filtre et recherche hostiles", () => {
  it("filtre=zzz ignoré : Toutes actif, aucun filtre caché", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=zzz" })
    expect(html).not.toContain('name="filtre"')
    expect(html).not.toContain("is-active\" href")
    expect(html).toMatch(/segmented__item is-active"[^>]*aria-current="page">Toutes/)
    expect(html).toContain("Rosine H.")
  })

  it("en-cours (réservé à l'étudiant) ignoré, la recherche reste appliquée", () => {
    const html = render({ result: { conversations: LIST } }, { search: "filtre=en-cours&q=Rosine" })
    expect(html).toContain("Rosine H.")
    expect(html).not.toContain("Awa K.")
    expect(html).not.toContain('name="filtre"')
    expect(html).not.toContain("filtre=en-cours")
    expect(html).toContain("q=Rosine")
  })

  it("q hostile, très longue, avec caractères de contrôle : bornée, échappée, sans balise", () => {
    const hostile = `%<"&x` + "\u0000\u0007\u001b" + "é".repeat(5000) + `"><script>alert(1)</script>`
    const html = render({ result: { conversations: LIST } }, { search: "q=" + encodeURIComponent(hostile) })
    expect(html).not.toContain("<script")
    expect(html).not.toMatch(/[\u0000-\u0008\u000b\u001f\u007f]/)
    expect(html.length).toBeLessThan(40000)
    expect(html).toContain("&lt;")
    expect(html).toContain("%25%3C%22%26x")
  })
})

describe("vues vide et erreur", () => {
  it("/client/messages sans conversation : vide pleine page", () => {
    const html = render({ result: { conversations: [] } })
    expect(html).toContain('aria-label="Aucune conversation"')
    expect(html).not.toContain("c-inbox__list")
  })

  it("/client/messages/<mission> : une seule notice compacte à gauche, jamais empilée", () => {
    for (const result of [{ conversations: [] }, { error: "boom" }]) {
      const html = render({ result, children: <p>Fil</p> }, { pathname: `/client/messages/${M1}` })
      expect((html.match(/c-inbox__list/g) ?? []).length).toBe(1)
      expect(html).not.toContain('aria-label="Aucune conversation"')
      expect(html).not.toContain('aria-label="Erreur de chargement"')
      expect(html).toContain("Fil")
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1)
    }
  })

  it("un seul h1 Messages dans tous les états", () => {
    const states = [
      [{ conversations: LIST }, "/client/messages"],
      [{ conversations: LIST }, `/client/messages/${M1}`],
      [{ conversations: [] }, "/client/messages"],
      [{ error: "x" }, "/client/messages"],
    ]
    for (const [result, pathname] of states) {
      const html = render({ result, children: <p>x</p> }, { pathname })
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
      expect(html).toMatch(/<h1[^>]*>Messages<\/h1>/)
    }
  })
})

describe("non lus locaux M1 puis M2", () => {
  it("remis à zéro puis conservés avec le même result, vidés si le result change", () => {
    const result = { conversations: LIST }
    let s = { result, ids: [] }
    s = nextOpened(s, result, A.key)
    s = nextOpened(s, result, C.key)
    expect(s.ids).toEqual([A.key, C.key])
    expect(nextOpened(s, { conversations: LIST }, null).ids).toEqual([])
  })
})

describe("client-boundary", () => {
  const root = resolve(__dirname, "../../../..")
  const FORBIDDEN = [/^server-only$/, /@\/lib\/actions\//, /@\/lib\/supabase\/server/, /next\/headers/, /@\/lib\/.*\/server/, /^node:/, /^fs$/]
  const resolveImport = (from, spec) => {
    const base = spec.startsWith("@/") ? join(root, "src", spec.slice(2)) : resolve(dirname(from), spec)
    return ["", ".js", ".jsx", "/index.js", "/index.jsx"].map((e) => base + e).find((p) => existsSync(p) && !p.endsWith("/") && /\.jsx?$/.test(p))
  }
  it("aucun module serveur dans les fichiers client de la messagerie, transitivement", () => {
    const seen = new Set()
    const bad = []
    const walk = (file) => {
      if (seen.has(file)) return
      seen.add(file)
      const src = readFileSync(file, "utf8")
      for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
        const spec = m[1] ?? m[2]
        if (FORBIDDEN.some((re) => re.test(spec))) bad.push(`${file}: ${spec}`)
        if (spec.startsWith("@/") || spec.startsWith(".")) {
          const p = resolveImport(file, spec)
          if (p) walk(p)
        }
      }
    }
    walk(join(__dirname, "inbox-view.jsx"))
    walk(join(__dirname, "inbox-list.jsx"))
    expect(seen.size).toBeGreaterThan(5)
    expect(bad).toEqual([])
    expect(readFileSync(join(__dirname, "inbox-view.jsx"), "utf8").trimStart().startsWith('"use client"')).toBe(true)
    expect(readFileSync(join(__dirname, "inbox-list.jsx"), "utf8").trimStart().startsWith('"use client"')).toBe(true)
  })
})
