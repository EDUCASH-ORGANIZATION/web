import { defineConfig, transformWithOxc } from "vite"
import path from "node:path"

// Les fichiers .js du projet contiennent du JSX : on les transforme en amont.
const jsxInJs = {
  name: "jsx-in-js",
  enforce: "pre",
  async transform(code, id) {
    if (!/\/src\/.*\.js$/.test(id.split("?")[0])) return null
    return transformWithOxc(code, id.split("?")[0], {
      lang: "jsx",
      jsx: { runtime: "automatic" },
    })
  },
}

export default defineConfig({
  plugins: [jsxInJs],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
})
