// EduCash - décision d'affichage de l'invitation à installer l'application.
// Fonction pure : toute l'information de l'environnement est passée en entrée.

export const INSTALL_STORAGE_KEY = "educash:install-prompt:v1"
export const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
export const INSTALL_MIN_VISITS = 2
export const INSTALL_MIN_SESSION_MS = 30 * 1000

export const INSTALL_SPACES = ["student", "client"]

export const EMPTY_INSTALL_STATE = {
  visits: 0,
  snoozedUntil: 0,
  dismissed: false,
  installed: false,
}

const COPY = {
  student: {
    title: "Installe EduCash",
    native: "Retrouve tes missions depuis ton écran d'accueil.",
    ios: "Ajoute EduCash à ton écran d'accueil : touche Partager, puis « Sur l'écran d'accueil ».",
    install: "Installer",
    later: "Plus tard",
    close: "Fermer et ne plus afficher",
  },
  client: {
    title: "Installez EduCash",
    native: "Retrouvez vos missions depuis votre écran d'accueil.",
    ios: "Ajoutez EduCash à votre écran d'accueil : touchez Partager, puis « Sur l'écran d'accueil ».",
    install: "Installer",
    later: "Plus tard",
    close: "Fermer et ne plus afficher",
  },
}

export function installCopy(space) {
  return COPY[space] ?? null
}

// Retourne { show, mode } avec mode "native" (beforeinstallprompt) ou "ios".
export function decideInstallPrompt({
  space,
  isMobile,
  standalone,
  hasNativePrompt,
  isIosSafari,
  state = EMPTY_INSTALL_STATE,
  sessionMs = 0,
  now = Date.now(),
}) {
  const hidden = { show: false, mode: null }
  if (!INSTALL_SPACES.includes(space)) return hidden
  if (!isMobile || standalone) return hidden
  if (state.installed || state.dismissed) return hidden
  if (state.snoozedUntil && now < state.snoozedUntil) return hidden

  const seasoned = state.visits >= INSTALL_MIN_VISITS || sessionMs >= INSTALL_MIN_SESSION_MS
  if (!seasoned) return hidden

  if (hasNativePrompt) return { show: true, mode: "native" }
  if (isIosSafari) return { show: true, mode: "ios" }
  return hidden
}

// Délai restant avant que la session suffise à elle seule (0 si déjà acquis).
export function remainingSessionDelay(sessionMs) {
  return Math.max(0, INSTALL_MIN_SESSION_MS - sessionMs)
}

export function parseInstallState(raw) {
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== "object") return { ...EMPTY_INSTALL_STATE }
    return {
      visits: Number.isFinite(value.visits) ? value.visits : 0,
      snoozedUntil: Number.isFinite(value.snoozedUntil) ? value.snoozedUntil : 0,
      dismissed: value.dismissed === true,
      installed: value.installed === true,
    }
  } catch {
    return { ...EMPTY_INSTALL_STATE }
  }
}

export function isIosSafariAgent(userAgent) {
  const ua = userAgent || ""
  const ios = /iPad|iPhone|iPod/.test(ua)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
  return ios && /Safari/.test(ua) && !otherBrowser
}
