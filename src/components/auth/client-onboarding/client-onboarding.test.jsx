import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = { value: null }
const redirectMock = vi.fn((url) => {
  throw new Error(`REDIRECT:${url}`)
})

vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock("next/navigation", () => ({
  redirect: (url) => redirectMock(url),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock("@/components/shared/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { storage: { from: () => ({}) } } }),
}))
vi.mock("@/lib/actions/auth.actions", () => ({ logout: vi.fn() }))
vi.mock("@/lib/actions/onboarding.actions", () => ({
  completeClientOnboarding: vi.fn(),
  getOnboardingState: vi.fn(async () => state.value),
}))

const { OnboardingWizard, reachableStep } = await import("./onboarding-wizard")
const { StepType } = await import("./step-type")
const { StepIdentity } = await import("./step-identity")
const { ReadyScreen, WrongSessionScreen, CLIENT_ONBOARDING_BRAND } = await import("./ready-screen")
const { default: Page } = await import("@/app/auth/register/client/page")
const { MIN_DEPOSIT_AMOUNT } = await import("@/lib/supabase/database.constants")
const { formatFcfa } = await import("@/lib/vitrine/format")

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ")
const noop = () => {}

const identityProps = {
  type: "pme",
  values: { name: "", city: "", phone: "" },
  errors: {},
  onChange: noop,
  onChangeType: noop,
  onPickLogo: noop,
  onLogoChange: noop,
  onRemoveLogo: noop,
}

describe("reachableStep", () => {
  it("renvoie à l'étape 1 sans type choisi", () => {
    expect(reachableStep(2, { type: "" })).toBe(1)
    expect(reachableStep("2", {})).toBe(1)
    expect(reachableStep(2, { type: "admin" })).toBe(1)
  })

  it("autorise l'étape 2 avec un type valide", () => {
    expect(reachableStep(2, { type: "pme" })).toBe(2)
  })

  it("ramène toute valeur inconnue à l'étape 1", () => {
    expect(reachableStep(7, { type: "pme" })).toBe(1)
    expect(reachableStep("abc", { type: "pme" })).toBe(1)
    expect(reachableStep(undefined, { type: "pme" })).toBe(1)
  })
})

describe("StepType", () => {
  it("rend les trois types en groupe radio, aucun coché au départ", () => {
    const html = renderToStaticMarkup(<StepType value="" onChange={noop} />)
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain("Particulier")
    expect(html).toContain("PME ou entreprise")
    expect(html).toContain("Association")
    expect(html).not.toContain('aria-checked="true"')
  })

  it("coche le type choisi", () => {
    const html = renderToStaticMarkup(<StepType value="pme" onChange={noop} />)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toContain("is-selected")
  })

  it("affiche l'erreur sous les cartes", () => {
    const html = renderToStaticMarkup(<StepType value="" error="Choisissez votre profil." onChange={noop} />)
    expect(html).toContain("field__error")
    expect(html).toContain("Choisissez votre profil.")
    expect(html).toContain("is-error")
  })
})

describe("StepIdentity", () => {
  it("adapte les libellés au type et rappelle le type choisi", () => {
    const pme = text(renderToStaticMarkup(<StepIdentity {...identityProps} />))
    expect(pme).toMatch(/Nom de l('|&#x27;)entreprise/)
    expect(pme).toContain("Logo")
    expect(pme).toContain("facultatif")
    expect(pme).toContain("PME ou entreprise")

    const particulier = text(renderToStaticMarkup(<StepIdentity {...identityProps} type="particulier" />))
    expect(particulier).toContain("Nom complet")
    expect(particulier).toContain("Photo")
  })

  it("affiche le préfixe +229 et l'aide du téléphone sans erreur", () => {
    const html = renderToStaticMarkup(<StepIdentity {...identityProps} />)
    expect(html).toContain("+229")
    expect(html).toContain("10 chiffres, commence par 01")
  })

  it("affiche une erreur sous chaque champ", () => {
    const html = renderToStaticMarkup(
      <StepIdentity
        {...identityProps}
        errors={{ name: "Saisissez le nom.", city: "Choisissez votre ville.", phone: "Numéro invalide." }}
      />
    )
    expect(html).toContain("Saisissez le nom.")
    expect(html).toContain("Choisissez votre ville.")
    expect(html).toContain("Numéro invalide.")
    expect(html).toContain('class="input is-error"')
    expect(html).not.toContain("10 chiffres, commence par 01")
  })
})

describe("OnboardingWizard", () => {
  it("rend l'étape 1 vouvoyée, en POST, avec le bouton désactivé au rendu serveur", () => {
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" />)
    expect(html).toContain('method="post"')
    expect(html).toContain("Étape 1 sur 2")
    expect(html).toContain("Pour qui publiez-vous des missions ?")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/)
    expect(text(html).match(/(^|[^\p{L}])(tu|ton|ta|tes)(?![\p{L}])/giu)).toBeNull()
  })

  it("une étape 2 demandée sans type retombe sur l'étape 1", () => {
    const html = renderToStaticMarkup(<OnboardingWizard userId="u1" initialStep={2} />)
    expect(html).toContain("Étape 1 sur 2")
    expect(html).not.toContain("Votre identité")
  })
})

describe("ReadyScreen", () => {
  it("mène à l'URL de publication exacte avec le pré-remplissage", () => {
    const next = "/client/missions/new?besoin=Repas&ville=Cotonou"
    const html = renderToStaticMarkup(<ReadyScreen destination={next} />)
    expect(html).toContain(`href="${next.replace("&", "&amp;")}"`)
    expect(text(html)).toContain("Continuer ma mission")
  })

  it("propose le tableau de bord sans publication à reprendre", () => {
    const html = renderToStaticMarkup(<ReadyScreen destination="/client/dashboard" />)
    expect(html).toContain('href="/client/dashboard"')
    expect(text(html)).toContain("Aller à mon tableau de bord")
    expect(text(html)).not.toContain("Continuer ma mission")
  })

  it("liste les opérateurs, lit le minimum de recharge dans la constante et ne nomme pas le prestataire", () => {
    const content = text(renderToStaticMarkup(<ReadyScreen destination="/client/dashboard" />))
    expect(content).toContain("MTN MoMo, Moov Money ou Celtiis Cash")
    expect(content).toContain(formatFcfa(MIN_DEPOSIT_AMOUNT).replace(/\s/g, " "))
    expect(content).not.toMatch(/feda/i)
    expect(content).toContain("88 %")
    expect(content).toContain("12 %")
  })

  it("le panneau de marque ne nomme aucun prestataire", () => {
    expect(JSON.stringify(CLIENT_ONBOARDING_BRAND)).not.toMatch(/feda/i)
  })
})

describe("WrongSessionScreen", () => {
  it("explique la session étudiante et propose deux sorties", () => {
    const html = renderToStaticMarkup(<WrongSessionScreen status="wrong_role" role="student" email="sena@exemple.bj" />)
    const content = text(html)
    expect(content).toContain("Vous êtes connecté avec un compte étudiant")
    expect(content).toContain("sena@exemple.bj")
    expect(html).toContain('href="/dashboard"')
    expect(content).toContain("Me déconnecter")
  })

  it("compte suspendu : lien de contact sans délai", () => {
    const html = renderToStaticMarkup(<WrongSessionScreen status="suspended" role="client" />)
    expect(text(html)).toContain("Votre compte est suspendu")
    expect(html).toContain('href="/contact"')
  })
})

describe("page /auth/register/client", () => {
  beforeEach(() => {
    redirectMock.mockClear()
  })

  const render = async (searchParams) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(searchParams) }))

  it("non connecté : renvoie à la connexion en conservant la publication", async () => {
    state.value = { status: "unauthenticated", user: null, role: null, profile: null, profileComplete: false }
    await expect(render({ next: "/client/missions/new?besoin=Repas&ville=Cotonou" })).rejects.toThrow(
      "REDIRECT:/auth/login?next=%2Fclient%2Fmissions%2Fnew%3Fbesoin%3DRepas%26ville%3DCotonou"
    )
  })

  it("non connecté : ignore un next hors espace client", async () => {
    state.value = { status: "unauthenticated", user: null, role: null, profile: null, profileComplete: false }
    await expect(render({ next: "/admin/dashboard" })).rejects.toThrow("REDIRECT:/auth/login")
  })

  it("profil complet : redirige vers la publication ou le tableau de bord", async () => {
    state.value = { status: "ok", user: { id: "u1" }, role: "client", profile: {}, profileComplete: true }
    await expect(render({ next: "/client/missions/new?besoin=Repas" })).rejects.toThrow(
      "REDIRECT:/client/missions/new?besoin=Repas"
    )
    await expect(render({})).rejects.toThrow("REDIRECT:/client/dashboard")
  })

  it("connecté en étudiant : écran de session incorrecte, panneau encre", async () => {
    state.value = { status: "wrong_role", user: { id: "u2", email: "sena@exemple.bj" }, role: "student", profile: {}, profileComplete: true }
    const html = await render({})
    expect(html).toContain("auth__brand--client")
    expect(text(html)).toContain("Vous êtes connecté avec un compte étudiant")
    expect(html).not.toContain("Pour qui publiez-vous")
  })

  it("profil illisible : écran d'erreur propre, jamais de 500 ni d'assistant", async () => {
    state.value = { status: "error", user: { id: "u1", email: "awa@exemple.bj" }, role: null, profile: null, profileComplete: false }
    const html = await render({ next: "/client/missions/new" })
    expect(text(html)).toContain("Profil indisponible")
    expect(text(html)).not.toContain("n'est pas un compte client")
    expect(html).not.toContain("Pour qui publiez-vous")
  })

  it("profil à compléter : assistant dans la coquille client", async () => {
    state.value = { status: "ok", user: { id: "u1" }, role: "client", profile: null, profileComplete: false }
    const html = await render({ etape: "1" })
    expect(html).toContain('class="ds"')
    expect(html).toContain("auth__brand--client")
    expect(html).toContain("2 étapes.")
    expect(html).toContain("Pour qui publiez-vous des missions ?")
  })
})

describe("garde-fous", () => {
  it("le composant n'importe ni MUI ni écriture directe de profiles", async () => {
    const { readFileSync, readdirSync } = await import("node:fs")
    const dir = new URL(".", import.meta.url)
    const files = readdirSync(dir).filter((name) => /\.jsx$/.test(name) && !name.endsWith(".test.jsx"))
    for (const name of files) {
      const source = readFileSync(new URL(name, dir), "utf8")
      expect(source, name).not.toMatch(/@mui|@emotion|\bBRAND\b|\.from\(["']profiles/)
      expect(source, name).not.toContain("style={{")
      expect(source, name).not.toContain(String.fromCharCode(0x2014))
    }
  })
})

