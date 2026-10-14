// Mode attente (RD-STAGE-01) : module pur, sans directive client, sans import Next ni Supabase.
// Utilisable depuis le middleware (Edge runtime) : uniquement des API natives.
//
// Activer ou désactiver SITE_WAITING_MODE exige un NOUVEAU DÉPLOIEMENT (redeploy), jamais un simple
// changement de variable : robots.js est statique, le sitemap est en revalidate 3600, l'en-tête
// X-Robots-Tag est posé au build et les variables d'environnement sont figées par déploiement.

export const WAITING_RETRY_AFTER_SECONDS = 86400

export const ROBOTS_WAITING_TEXT = "User-agent: *\nDisallow: /\n"

const WAITING_ROBOTS_TAG = "noindex, nofollow, noarchive"

// Actif seulement pour la chaîne exacte "true" (modèle de paymentsEnabled).
export function waitingModeEnabled(env = process.env) {
  return env.SITE_WAITING_MODE === "true"
}

export function waitingRobotsTag() {
  return WAITING_ROBOTS_TAG
}

export function waitingHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Retry-After": String(WAITING_RETRY_AFTER_SECONDS),
    "X-Robots-Tag": WAITING_ROBOTS_TAG,
    "Clear-Site-Data": '"storage"',
    "Referrer-Policy": "no-referrer",
  }
}

// Chemins servis normalement même en mode attente (comparaison exacte).
const PASSTHROUGH_PATHS = ["/attente.css", "/api/health"]

export function isWaitingPassthrough(pathname) {
  return PASSTHROUGH_PATHS.includes(pathname)
}

export function waitingPageHtml() {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${WAITING_ROBOTS_TAG}">
<title>EduCash</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/attente.css">
</head>
<body>
<main class="attente">
<img class="attente__logo" src="/logo-horizontal-blanc.svg" alt="EduCash" width="180" height="44">
<h1 class="attente__titre">EduCash ouvre bientôt</h1>
<p class="attente__texte">Nous préparons l'ouverture du service. Merci de votre patience, revenez très prochainement.</p>
<p class="attente__texte"><a class="attente__lien" href="mailto:contact@educash.bj">contact@educash.bj</a></p>
</main>
</body>
</html>
`
}

// Service worker de nettoyage : remplace tout service worker déjà installé chez un visiteur.
export function killSwitchServiceWorker() {
  return `self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const windows = await self.clients.matchAll({ type: "window" })
      windows.forEach((client) => client.navigate(client.url))
    })()
  )
})
`
}
