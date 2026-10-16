// Configuration Vitest du banc de fidélité (rendu statique des vues). Distincte de vitest.config.mjs :
// `npm test` n'exécute pas le banc. Lancée par compare.mjs ; variables : FIDELITY_OUT, FIDELITY_SCREENS.
import { defineConfig, transformWithOxc } from "vite"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../..")

process.env.TZ = "Africa/Porto-Novo"

// Pas de dossier de sortie par défaut ici : un défaut partagé ferait s'écraser les worktrees.
if (!process.env.FIDELITY_OUT) throw new Error("FIDELITY_OUT est obligatoire (le banc se lance par `npm run fidelity`).")

// Les fichiers .js du projet contiennent du JSX : on les transforme en amont (comme vitest.config.mjs).
const jsxInJs = {
  name: "jsx-in-js",
  enforce: "pre",
  async transform(code, id) {
    const file = id.split("?")[0]
    if (!/\.js$/.test(file) || file.includes("node_modules")) return null
    return transformWithOxc(code, file, { lang: "jsx", jsx: { runtime: "automatic" } })
  },
}

export default defineConfig({
  plugins: [jsxInJs],
  resolve: {
    alias: {
      "server-only": path.join(import.meta.dirname, "stubs/server-only.js"),
      "@": path.join(ROOT, "src"),
    },
  },
  server: { fs: { allow: [ROOT] } },
  test: {
    environment: "node",
    root: ROOT,
    include: ["scripts/fidelity/render.fidelity.jsx"],
    testTimeout: 120000,
    env: {
      RESEND_API_KEY: "re_fidelity",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fidelity",
    },
  },
})
