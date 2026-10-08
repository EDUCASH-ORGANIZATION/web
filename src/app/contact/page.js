import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { ContactForm } from "@/components/vitrine/contact/contact-form"
import { CONTACT_SUBJECTS } from "@/lib/contact/schema"
import { safeNextPath } from "@/lib/utils/safe-next"

export const metadata = {
  title: "Contact",
  description:
    "Écris à l'équipe EduCash : une question sur une mission, un paiement ou ta vérification.",
  openGraph: { url: "/contact" },
}

const HELP_LINKS = [
  { href: "/aide#sequestre", label: "Quand est-ce que je suis payé ?" },
  { href: "/aide#retraits", label: "Mon retrait a échoué" },
  { href: "/aide#achats", label: "Mission avec achats : qui paie ?" },
]

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ContactPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const requested = first(sp.sujet)
  const defaultSubject = CONTACT_SUBJECTS.some((s) => s.id === requested) ? requested : ""

  const ref = safeNextPath(first(sp.ref))
  const defaultMessage = defaultSubject === "signalement" && ref ? `Page concernée : ${ref}\n\n` : ""

  return (
    <VitrinePage>
      <div className="v08-head grid-bg">
        <span className="eyebrow">Contact</span>
        <h1 className="display display--xxl ds-mt-6">
          Écris-nous.
          <br />
          <span className="hl-citron">On répond.</span>
        </h1>
        <p className="body-l v08-lead">
          Une vraie équipe à Cotonou lit chaque message.
        </p>
      </div>

      <section className="section ds-pt-8">
        <div className="ds-container">
          <div className="v08-grid">
            <div className="v08-infos">
              <div className="v08-info">
                <span className="ic-sq ic-sq--lg ic-sq--bleu">
                  <Icon name="i-mail" />
                </span>
                <div>
                  <span className="caption">Email</span>
                  <div>
                    <a className="link" href="mailto:contact@educash.bj">
                      contact@educash.bj
                    </a>
                  </div>
                </div>
              </div>
              <div className="v08-info">
                <span className="ic-sq ic-sq--lg">
                  <Icon name="i-map-pin" />
                </span>
                <div>
                  <span className="caption">Adresse</span>
                  <b>Cotonou, Bénin</b>
                </div>
              </div>
              <div className="v08-help">
                <b>Ta réponse est peut-être déjà là</b>
                {HELP_LINKS.map((l) => (
                  <Link key={l.href} href={l.href}>
                    {l.label}
                    <Icon name="i-arrow-right" />
                  </Link>
                ))}
                <Link className="link" href="/aide">
                  Toute l&apos;aide
                </Link>
              </div>
            </div>
            <ContactForm defaultSubject={defaultSubject} defaultMessage={defaultMessage} />
          </div>
        </div>
      </section>
    </VitrinePage>
  )
}
