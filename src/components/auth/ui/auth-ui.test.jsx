import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/link", () => ({
  default: ({ href, children, replace, scroll, ...rest }) => <a href={href} {...rest}>{children}</a>,
}))

const { FieldError } = await import("./field-error")
const { PasswordInput } = await import("./password-input")
const { PasswordChecklist } = await import("./password-checklist")
const { FormBanner } = await import("./form-banner")
const { HydratedSubmit } = await import("./hydrated-submit")
const { CountdownButton, formatCountdown } = await import("./countdown-button")
const { PhoneInput } = await import("./phone-input")
const { ChoiceCard } = await import("./choice-card")
const { AuthStepper } = await import("./auth-stepper")
const { MailboxLink, mailboxFor } = await import("./mailbox-link")

const RULES = [
  { key: "len", label: "8 caractères minimum", test: (v) => v.length >= 8 },
  { key: "num", label: "Un chiffre", test: (v) => /\d/.test(v) },
]

describe("FieldError", () => {
  it("rend le message avec role alert, rien sans message", () => {
    const html = renderToStaticMarkup(<FieldError id="e-err" message="Saisis ton email." />)
    expect(html).toContain('class="field__error"')
    expect(html).toContain('id="e-err"')
    expect(html).toContain('role="alert"')
    expect(html).toContain("Saisis ton email.")
    expect(renderToStaticMarkup(<FieldError message="" />)).toBe("")
  })
})

describe("PasswordInput", () => {
  it("masque le mot de passe, relie le bouton au champ et tutoie l'étudiant", () => {
    const html = renderToStaticMarkup(<PasswordInput id="pw" name="password" />)
    expect(html).toContain('type="password"')
    expect(html).toContain('aria-controls="pw"')
    expect(html).toContain('aria-label="Afficher ton mot de passe"')
    expect(html).not.toContain("is-error")
  })

  it("vouvoie le client et marque l'erreur", () => {
    const html = renderToStaticMarkup(<PasswordInput id="pw" audience="client" invalid aria-describedby="pw-e" />)
    expect(html).toContain('aria-label="Afficher votre mot de passe"')
    expect(html).toContain("control is-error")
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="pw-e"')
  })
})

describe("PasswordChecklist", () => {
  it("marque les règles respectées is-ok et annonce en direct", () => {
    const html = renderToStaticMarkup(<PasswordChecklist rules={RULES} value="abcdefgh" />)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('<li class="is-ok">8 caractères minimum')
    expect(html).toContain("<li>Un chiffre")
    expect(html).not.toContain("is-ko")
  })

  it("marque is-ko les règles manquantes une fois les erreurs affichées", () => {
    const html = renderToStaticMarkup(<PasswordChecklist rules={RULES} value="abc" showErrors />)
    expect(html.match(/is-ko/g)).toHaveLength(2)
    expect(html).not.toContain("is-ok")
  })
})

describe("FormBanner", () => {
  it("rend les quatre tons avec le bon role et les actions", () => {
    const err = renderToStaticMarkup(<FormBanner tone="erreur" title="Email incorrect">Vérifie.</FormBanner>)
    expect(err).toContain("banner banner--erreur")
    expect(err).toContain('role="alert"')
    expect(err).toContain('class="banner__title">Email incorrect')
    const ok = renderToStaticMarkup(<FormBanner tone="succes" actions={<button type="button">Ok</button>}>Envoyé</FormBanner>)
    expect(ok).toContain("banner--succes")
    expect(ok).toContain('role="status"')
    expect(ok).toContain('class="banner__actions"')
    expect(renderToStaticMarkup(<FormBanner tone="alerte">x</FormBanner>)).toContain("banner--alerte")
    expect(renderToStaticMarkup(<FormBanner>x</FormBanner>)).toContain("banner--info")
  })
})

describe("HydratedSubmit", () => {
  it("est désactivé côté serveur (avant hydratation)", () => {
    const html = renderToStaticMarkup(<HydratedSubmit>Se connecter</HydratedSubmit>)
    expect(html).toMatch(/<button[^>]*type="submit"/)
    expect(html).toMatch(/<button[^>]*disabled=""/)
    expect(html).toContain("btn btn--primary btn--lg btn--block")
  })

  it("passe en chargement avec aria-busy", () => {
    const html = renderToStaticMarkup(<HydratedSubmit pending>Se connecter</HydratedSubmit>)
    expect(html).toContain("is-loading")
    expect(html).toContain('aria-busy="true"')
  })
})

describe("CountdownButton", () => {
  it("formate le compte à rebours", () => {
    expect(formatCountdown(58)).toBe("0:58")
    expect(formatCountdown(292)).toBe("4:52")
    expect(formatCountdown(-3)).toBe("0:00")
  })

  it("est actif au repos et inactif avec compte à rebours au démarrage automatique", () => {
    const idle = renderToStaticMarkup(<CountdownButton label="Renvoyer l'email" />)
    expect(idle).toContain("Renvoyer l&#x27;email")
    expect(idle).not.toContain("disabled")
    const running = renderToStaticMarkup(<CountdownButton label="Renvoyer l'email" autoStart />)
    expect(running).toContain("disabled")
    expect(running).toContain("Renvoyer dans 1:00")
  })

  it("annonce aux lecteurs d'écran sur une zone status", () => {
    const html = renderToStaticMarkup(<CountdownButton label="Renvoyer" autoStart seconds={45} />)
    expect(html).toContain('role="status"')
    expect(html).toContain("Renvoyer dans 0:45")
  })
})

describe("PhoneInput", () => {
  it("affiche le préfixe +229 et limite la saisie", () => {
    const html = renderToStaticMarkup(<PhoneInput id="tel" />)
    expect(html).toContain('<span class="control__prefix">+229</span>')
    expect(html).toContain('name="phone"')
    expect(html).toContain('type="tel"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('maxLength="14"')
    expect(html).toContain('placeholder="01 97 45 21 08"')
  })

  it("marque l'erreur", () => {
    const html = renderToStaticMarkup(<PhoneInput id="tel" invalid />)
    expect(html).toContain("control is-error")
    expect(html).toContain('aria-invalid="true"')
  })
})

describe("ChoiceCard", () => {
  it("rend une sémantique radio sélectionnée", () => {
    const html = renderToStaticMarkup(
      <div role="radiogroup" aria-label="Type de compte">
        <ChoiceCard title="Je suis étudiant" sub="Je cherche des missions payées" icon="i-graduation" tone="bleu" selected />
        <ChoiceCard title="Je publie des missions" icon="i-briefcase" />
      </div>
    )
    expect(html).toContain('role="radio"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain("choice is-selected")
    expect(html).toContain("ic-sq ic-sq--bleu")
    expect(html).toContain('tabindex="0"')
  })

  it("rend un lien utilisable sans JavaScript avec href", () => {
    const html = renderToStaticMarkup(<ChoiceCard title="Client" icon="i-briefcase" href="/auth/register?role=client" />)
    expect(html).toContain('<a href="/auth/register?role=client"')
    expect(html).toContain('role="radio"')
  })

  it("sort la carte désactivée de l'ordre de tabulation", () => {
    const html = renderToStaticMarkup(<ChoiceCard title="Client" icon="i-briefcase" disabled invalid />)
    expect(html).toContain("is-disabled")
    expect(html).toContain("is-error")
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('tabindex="-1"')
  })
})

describe("AuthStepper", () => {
  it("marque l'étape courante, les étapes faites et la légende", () => {
    const html = renderToStaticMarkup(<AuthStepper steps={["Identité", "Études", "Carte étudiante"]} current={2} />)
    expect(html).toContain('aria-label="Étapes"')
    expect(html).toContain("step is-done")
    expect(html).toContain('step is-current" aria-current="step"')
    expect(html.match(/step__line/g)).toHaveLength(2)
    expect(html).toContain("Étape 2 sur 3")
  })

  it("supporte la variante compacte sans légende", () => {
    const html = renderToStaticMarkup(<AuthStepper steps={["Type", "Identité"]} current={1} compact showCaption={false} />)
    expect(html).toContain("stepper stepper--compact")
    expect(html).not.toContain("Étape 1 sur 2")
  })
})

describe("MailboxLink", () => {
  it("devine la messagerie depuis le domaine", () => {
    expect(mailboxFor("a@gmail.com")?.name).toBe("Gmail")
    expect(mailboxFor("a@Hotmail.fr")?.name).toBe("Outlook")
    expect(mailboxFor("a@yahoo.fr")?.name).toBe("Yahoo")
    expect(mailboxFor("a@exemple.bj")).toBeNull()
    expect(mailboxFor("")).toBeNull()
    expect(mailboxFor(undefined)).toBeNull()
  })

  it("rend un lien externe sûr ou rien", () => {
    const html = renderToStaticMarkup(<MailboxLink email="sena@gmail.com" />)
    expect(html).toContain('href="https://mail.google.com/"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("Ouvrir ma messagerie")
    expect(renderToStaticMarkup(<MailboxLink email="sena@exemple.bj" />)).toBe("")
  })
})
