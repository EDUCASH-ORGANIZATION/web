// Rendu statique des vues pures avec les données des fixtures (planches). Exécuté par Vitest via
// vitest.fidelity.config.mjs, jamais par `npm test`. Écrit <FIDELITY_OUT>/screens/<nom>.html.
import { it, vi } from "vitest"
import { mkdirSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

globalThis.__FIDELITY_PATH = "/"
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, replace() {}, push() {}, prefetch() {} }),
  usePathname: () => globalThis.__FIDELITY_PATH,
  useSearchParams: () => new URLSearchParams(),
  redirect() {},
  notFound() {},
}))
vi.mock("@/hooks/use-realtime-messages", () => ({
  useRealtimeMessages: ({ initialMessages }) => ({ messages: initialMessages ?? [], append() {}, refreshMedia() {} }),
  useMessageMediaUpload: () => async () => "x",
}))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel() {},
    auth: { getUser: async () => ({ data: {} }) },
  }),
}))

const OUT = path.join(process.env.FIDELITY_OUT || "/tmp/educash-fidelity", "screens")
const WANTED = (process.env.FIDELITY_SCREENS || "").split(",").filter(Boolean)
const FIXTURES = path.join(import.meta.dirname, "fixtures")

const page = (title, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Figtree:ital,wght@0,300..900;1,400..700&display=swap">
<link rel="stylesheet" href="/app.css">
<style>:root{--font-anton:"Anton";--font-figtree:"Figtree";--font-inter:"Figtree"} html,body{margin:0;height:100%} *,*::before,*::after{box-sizing:border-box}</style>
</head><body>${body}</body></html>`

it("rend les écrans des fixtures", async () => {
  mkdirSync(OUT, { recursive: true })
  const { ToastProvider } = await import("@/components/app-ui/toast")
  const { AppShell } = await import("@/components/app-shell/app-shell")
  const { STUDENT_NAV } = await import("@/components/student-space/shell/student-nav")
  const { CLIENT_NAV } = await import("@/components/client-space/shell/client-nav")

  const shells = {
    e2: { nav: STUDENT_NAV, user: { id: "u1", fullName: "Sèna Agossou" } },
    c2: { nav: CLIENT_NAV, user: { id: "c1", fullName: "Rosine Houngbédji" } },
  }
  const errors = []
  const rendered = []

  for (const file of readdirSync(FIXTURES).filter((name) => name.endsWith(".js")).sort()) {
    const { screens = [] } = await import(/* @vite-ignore */ path.join(FIXTURES, file))
    for (const screen of screens) {
      if (WANTED.length && !WANTED.includes(screen.name)) continue
      try {
        const viewModule = await import(/* @vite-ignore */ screen.view)
        const View = viewModule[screen.component]
        // Volet de droite des vues à deux volets : une vue enfant rendue dans `children`.
        let child = null
        if (screen.child) {
          const childModule = await import(/* @vite-ignore */ screen.child.view)
          const Child = childModule[screen.child.component]
          child = <Child {...screen.child.props} />
        }
        const shell = shells[screen.space]
        globalThis.__FIDELITY_PATH = screen.path
        const html = renderToStaticMarkup(
          <div className={`ds ${screen.space}`}>
            <ToastProvider>
              <AppShell nav={shell.nav} user={shell.user} unreadCount={2} counts={{ messages: 2 }}>
                <View {...screen.props}>{child}</View>
              </AppShell>
            </ToastProvider>
          </div>,
        )
        writeFileSync(path.join(OUT, `${screen.name}.html`), page(screen.name, html))
        rendered.push(screen.name)
      } catch (error) {
        errors.push(`${screen.name}: ${String(error).slice(0, 400)}`)
      }
    }
  }
  writeFileSync(path.join(OUT, "_rendered.json"), JSON.stringify({ rendered, errors }, null, 1))
  if (errors.length) throw new Error(errors.join("\n"))
})
