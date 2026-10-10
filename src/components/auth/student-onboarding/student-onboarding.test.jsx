import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { MISSION_TYPES } from "@/lib/supabase/database.constants"

let query = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
  redirect: vi.fn((to) => {
    throw new Error(`REDIRECT:${to}`)
  }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("@/components/shared/supabase-provider", () => ({ useSupabase: () => ({ supabase: {} }) }))
vi.mock("@/lib/actions/onboarding.actions", () => ({
  completeStudentOnboarding: vi.fn(),
  getOnboardingState: vi.fn(),
}))
vi.mock("@/lib/actions/university.actions", () => ({ getUniversities: vi.fn(async () => []) }))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))

const wizard = await import("./onboarding-wizard")
const { StepIdentity } = await import("./step-identity")
const { StepStudies } = await import("./step-studies")
const { StepCard, validateUpload } = await import("./step-card")
const { WelcomeScreen, firstNameOf } = await import("./welcome-screen")
const { getOnboardingState } = await import("@/lib/actions/onboarding.actions")
const { default: StudentOnboardingPage } = await import("@/app/auth/register/student/page")

const { EMPTY_VALUES, OnboardingWizard } = wizard

const UNIVERSITIES = [{ id: "u1", name: "Université d'Abomey-Calavi", short_name: "UAC", city: "Abomey-Calavi" }]

const IDENTITY = { ...EMPTY_VALUES, fullName: "Sèna Agossou", city: "Cotonou", phone: "01 97 45 21 08" }
const FILLED = { ...IDENTITY, school: "Université d'Abomey-Calavi", level: "Licence 2", skills: [MISSION_TYPES[0]] }

const noop = () => {}

describe("garde d'étape", () => {
  it("borne l'étape demandée à 1-3", () => {
    expect(wizard.parseStep("2")).toBe(2)
    expect(wizard.parseStep("9")).toBe(1)
    expect(wizard.parseStep("abc")).toBe(1)
    expect(wizard.parseStep(undefined)).toBe(1)
  })

  it("renvoie à l'étape 1 quand l'identité est vide", () => {
    expect(wizard.firstIncompleteStep(EMPTY_VALUES)).toBe(1)
    expect(wizard.reachableStep("3", EMPTY_VALUES)).toBe(1)
    expect(wizard.reachableStep("2", EMPTY_VALUES)).toBe(1)
  })

  it("renvoie à l'étape 2 quand seules les études manquent", () => {
    expect(wizard.reachableStep("3", IDENTITY)).toBe(2)
    expect(wizard.reachableStep("1", IDENTITY)).toBe(1)
  })

  it("autorise l'étape 3 quand les étapes 1 et 2 sont valides (retour arrière libre)", () => {
    expect(wizard.reachableStep("3", FILLED)).toBe(3)
    expect(wizard.reachableStep("2", FILLED)).toBe(2)
    expect(wizard.reachableStep("1", FILLED)).toBe(1)
  })

  it("valide chaque étape avec les schémas partagés, une erreur par champ", () => {
    const errors = wizard.validateStep(1, { ...EMPTY_VALUES, phone: "0297452108" })
    expect(Object.keys(errors).sort()).toEqual(["city", "fullName", "phone"])
    expect(errors.fullName).toMatch(/Saisis/)
    expect(wizard.validateStep(2, EMPTY_VALUES)).toMatchObject({ level: expect.any(String), skills: expect.any(String) })
    expect(wizard.validateStep(3, EMPTY_VALUES)).toEqual({})
  })

  it("prend le texte libre quand l'établissement est « autre »", () => {
    const other = { ...FILLED, school: "__other__", schoolOther: "  ESGIS  " }
    expect(wizard.resolveSchool(other)).toBe("ESGIS")
    expect(wizard.validateStep(2, other)).toEqual({})
    expect(wizard.validateStep(2, { ...other, schoolOther: "" }).school).toBeTruthy()
  })

  it("renvoie vers l'étape du premier champ en erreur du serveur", () => {
    expect(wizard.stepOfFirstError({ skills: "x", phone: "y" })).toBe(1)
    expect(wizard.stepOfFirstError({ level: "x" })).toBe(2)
    expect(wizard.stepOfFirstError({ cardUrl: "x" })).toBe(3)
    expect(wizard.stepOfFirstError({})).toBeNull()
  })

  it("ne relit du brouillon que les clés connues, avec des types sûrs", () => {
    const draft = wizard.sanitizeDraft({ fullName: "Sèna", skills: [MISSION_TYPES[0], 4], role: "admin", city: 3 })
    expect(draft.fullName).toBe("Sèna")
    expect(draft.skills).toEqual([MISSION_TYPES[0]])
    expect(draft.city).toBe("")
    expect(draft).not.toHaveProperty("role")
    expect(wizard.sanitizeDraft(null)).toBeNull()
    expect(wizard.draftKey("u1")).toContain("u1")
  })
})

describe("étape 1 Identité", () => {
  it("rend le formulaire vide en POST, astérisques justes, aucune erreur", () => {
    const html = renderToStaticMarkup(
      <StepIdentity values={EMPTY_VALUES} errors={{}} avatar={null} onChange={noop} onPickAvatar={noop} onSubmit={noop} />
    )
    expect(html).toContain('method="post"')
    expect(html).toContain("Étape 1 sur 3")
    expect(html).toContain("Qui es-tu ?")
    expect(html).toContain("+229")
    expect(html).toContain("0 / 200")
    expect(html).toContain("Choisir ta ville")
    expect(html).toContain("disabled")
    expect(html.match(/class="req"/g)).toHaveLength(3)
    expect(html.match(/facultatif/g)).toHaveLength(2)
    expect(html).not.toContain("is-error")
  })

  it("rend toutes les erreurs sous leur champ", () => {
    const errors = wizard.validateStep(1, EMPTY_VALUES)
    const html = renderToStaticMarkup(
      <StepIdentity values={EMPTY_VALUES} errors={errors} avatar={null} avatarError="Format non accepté." onChange={noop} onPickAvatar={noop} onSubmit={noop} />
    )
    expect(html.match(/class="field__error"/g)).toHaveLength(4)
    expect(html).toContain('id="o-nom-error"')
    expect(html).toContain('id="o-tel-error"')
    expect(html).toContain("Format non accepté.")
    expect(html).toContain("input is-error")
  })
})

describe("étape 2 Études", () => {
  it("rend établissements, niveaux, compétences par libellé et disponibilités", () => {
    const html = renderToStaticMarkup(
      <StepStudies values={EMPTY_VALUES} errors={{}} universities={UNIVERSITIES} onChange={noop} onBack={noop} onSubmit={noop} />
    )
    expect(html).toContain("UAC · Université d&#x27;Abomey-Calavi (Abomey-Calavi)")
    expect(html).toContain("Autre établissement")
    expect(html).toContain("Licence 2")
    expect(html).toContain("Marché et achats")
    expect(html).not.toContain(">Livraison<")
    expect(html).toContain("Soir")
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain("Retour")
  })

  it("marque les puces choisies et affiche les erreurs", () => {
    const errors = wizard.validateStep(2, EMPTY_VALUES)
    const html = renderToStaticMarkup(
      <StepStudies values={{ ...EMPTY_VALUES, skills: [MISSION_TYPES[0]] }} errors={errors} universities={[]} onChange={noop} onBack={noop} onSubmit={noop} />
    )
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain("chip is-selected")
    expect(html).toContain('id="o-etab-error"')
    expect(html).toContain('id="o-niv-error"')
  })

  it("montre le champ libre pour un autre établissement", () => {
    const html = renderToStaticMarkup(
      <StepStudies values={{ ...EMPTY_VALUES, school: "__other__" }} errors={{}} universities={[]} onChange={noop} onBack={noop} onSubmit={noop} />
    )
    expect(html).toContain('name="schoolOther"')
  })
})

describe("étape 3 Carte", () => {
  const props = { pending: false, onPickCard: noop, onBack: noop, onSubmit: noop, onSkip: noop }

  it("rend la zone de dépôt, le report et aucun délai d'examen", () => {
    const html = renderToStaticMarkup(<StepCard card={null} {...props} />)
    expect(html).toContain("Étape 3 sur 3")
    expect(html).toContain("Dépose ta carte étudiante")
    expect(html).toContain("Plus tard")
    expect(html).toContain("Terminer")
    expect(html).toContain("Nous examinons ta carte, tu recevras un email.")
    expect(html).not.toMatch(/24|48/)
  })

  it("rend le fichier choisi et le bouton d'envoi", () => {
    const html = renderToStaticMarkup(<StepCard card={{ name: "carte.jpg" }} {...props} />)
    expect(html).toContain("carte.jpg")
    expect(html).toContain("Envoyer et terminer")
    expect(html).toContain("file file--ok")
  })

  it("rend l'état d'erreur et l'envoi en cours", () => {
    const html = renderToStaticMarkup(
      <StepCard card={null} cardError="Fichier trop lourd (14,0 Mo)." formError="L'envoi du fichier a échoué." {...props} pending />
    )
    expect(html).toContain("upload is-error")
    expect(html).toContain("Fichier trop lourd (14,0 Mo).")
    expect(html).toContain("L&#x27;envoi du fichier a échoué.")
    expect(html).toContain("is-loading")
  })

  it("contrôle format et poids des fichiers", () => {
    const mb = 1024 * 1024
    expect(validateUpload({ type: "image/jpeg", size: mb }, ["image/jpeg"], "photo")).toBe("")
    expect(validateUpload({ type: "image/heic", size: mb }, ["image/jpeg"], "carte")).toMatch(/Format non accepté/)
    expect(validateUpload({ type: "image/jpeg", size: 14 * mb }, ["image/jpeg"], "carte")).toMatch(/trop lourd \(14,0 Mo\)/)
  })
})

describe("écran Bienvenue", () => {
  it("carte envoyée : badge, message sans délai, CTA missions", () => {
    const html = renderToStaticMarkup(<WelcomeScreen fullName="Sèna Agossou" cardSent destination="/dashboard" />)
    expect(html).toContain("Sèna.")
    expect(html).toContain("En cours d&#x27;examen")
    expect(html).toContain("Nous examinons ta carte, tu recevras un email.")
    expect(html).not.toMatch(/24|48/)
    expect(html).toContain('href="/student/missions"')
    expect(html).toContain('href="/dashboard"')
    expect(html).toContain("Explorer les missions")
  })

  it("carte reportée : rappel de l'envoi et lien vers le profil", () => {
    const html = renderToStaticMarkup(<WelcomeScreen fullName="Sèna" cardSent={false} destination="/dashboard" />)
    expect(html).toContain("Non vérifié")
    expect(html).toContain("tu devras l&#x27;envoyer pour postuler")
    expect(html).toContain('href="/profile/edit"')
    expect(html).not.toContain("En cours d&#x27;examen")
  })

  it("retour au next quand l'étudiant venait d'une mission", () => {
    const html = renderToStaticMarkup(<WelcomeScreen fullName="Sèna" cardSent={false} destination="/student/missions/m1" />)
    expect(html).toContain('href="/student/missions/m1"')
    expect(html).toContain("Continuer")
    expect(html).not.toContain("Explorer les missions")
  })

  it("extrait le prénom", () => {
    expect(firstNameOf("  Sèna  Agossou ")).toBe("Sèna")
    expect(firstNameOf("")).toBe("")
  })
})

describe("assistant", () => {
  beforeEach(() => {
    query = ""
  })

  it("démarre à l'étape 1", () => {
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" universities={UNIVERSITIES} />)
    expect(html).toContain("Étape 1 sur 3")
  })

  it("?etape=3 sans étapes 1-2 valides retombe sur l'étape 1", () => {
    query = "etape=3"
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" universities={UNIVERSITIES} />)
    expect(html).toContain("Étape 1 sur 3")
    expect(html).not.toContain("Ta carte étudiante")
  })

  it("?etape=3 avec des étapes valides affiche la carte", () => {
    query = "etape=3"
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" universities={UNIVERSITIES} initialValues={FILLED} />)
    expect(html).toContain("Étape 3 sur 3")
  })

  it("reprend les valeurs initiales du profil", () => {
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" universities={[]} initialValues={IDENTITY} />)
    expect(html).toContain('value="Sèna Agossou"')
    expect(html).toContain('value="01 97 45 21 08"')
  })
})

describe("page serveur", () => {
  const params = (value = {}) => ({ searchParams: Promise.resolve(value) })

  it("non connecté : renvoie vers la connexion", async () => {
    getOnboardingState.mockResolvedValue({ status: "unauthenticated" })
    await expect(StudentOnboardingPage(params())).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("profil complet : renvoie vers le tableau de bord ou le next autorisé", async () => {
    getOnboardingState.mockResolvedValue({ status: "ok", profileComplete: true, role: "student", user: { id: "u1" } })
    await expect(StudentOnboardingPage(params())).rejects.toThrow("REDIRECT:/dashboard")
    await expect(StudentOnboardingPage(params({ next: "/student/missions/m1" }))).rejects.toThrow(
      "REDIRECT:/student/missions/m1"
    )
  })

  it("mauvais rôle : écran session incorrecte vers l'espace du rôle, sans assistant", async () => {
    getOnboardingState.mockResolvedValue({ status: "wrong_role", role: "client", user: { id: "u1" }, profile: null })
    const html = renderToStaticMarkup(await StudentOnboardingPage(params()))
    expect(html).toContain("Session incorrecte")
    expect(html).toContain('href="/client/dashboard"')
    expect(html).not.toContain("Étape 1 sur 3")
  })

  it("étudiant à compléter : rend l'assistant dans la coquille étudiante", async () => {
    getOnboardingState.mockResolvedValue({
      status: "ok",
      profileComplete: false,
      role: "student",
      user: { id: "u1" },
      profile: { full_name: "Sèna Agossou", phone: "+2290197452108" },
    })
    const html = renderToStaticMarkup(await StudentOnboardingPage(params({ etape: "1" })))
    expect(html).toContain("C&#x27;est parti.")
    expect(html).toContain("Étape 1 sur 3")
    expect(html).toContain('value="Sèna Agossou"')
  })
})

describe("règles de l'écran", () => {
  const files = ["onboarding-wizard", "step-identity", "step-studies", "step-card", "welcome-screen"].map((name) =>
    readFileSync(new URL(`./${name}.jsx`, import.meta.url), "utf8")
  )

  it("n'écrit jamais profiles depuis le navigateur et n'utilise ni MUI, ni style en ligne", () => {
    for (const source of files) {
      expect(source).not.toMatch(/\.from\(\s*["']profiles/)
      expect(source).not.toMatch(/@mui|@emotion|style=\{\{|<style/)
      expect(source).not.toContain(String.fromCharCode(8212))
      expect(source).not.toMatch(/Réponse sous|24 à 48/)
    }
    expect(files[0]).not.toMatch(/supabase\s*\.from\(/)
  })
})
