import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { MIN_WITHDRAWAL_AMOUNT } from "@/lib/supabase/database.constants"
import { formatFcfa } from "@/lib/vitrine/format"
import { Faq } from "../shared/faq"
import { AnchorLink } from "../shared/hash-scroll"

const COMMISSION = Math.round(COMMISSION_RATE * 100)

export const FAQ_ITEMS = [
  {
    id: "paye",
    question: "Suis-je sûr d'être payé ?",
    answer: (
      <>
        Oui. Le client bloque le budget sur EduCash <b>avant</b>{" "}
        que la mission commence&nbsp;: c&rsquo;est le séquestre. Une fois la mission faite, le client valide la fin de
        mission et votre argent arrive sur votre portefeuille EduCash. Jusque-là, il reste bloqué. Un souci pendant la
        mission&nbsp;? Contactez l&rsquo;équipe EduCash depuis la page{" "}
        <Link className="link" href="/contact?sujet=signalement">Contact</Link>&nbsp;: nous intervenons en médiation.
      </>
    ),
  },
  {
    id: "avance",
    question: "Dois-je avancer l'argent du marché ?",
    answer: (
      <>
        Non. Les achats sont réglés par le client directement au vendeur, par Mobile Money, hors EduCash. Vous, vous
        n&rsquo;avancez jamais d&rsquo;argent. Vous envoyez au client, dans la conversation de la mission, une carte de
        paiement d&rsquo;achats&nbsp;: numéro à payer, nom du vendeur, montant, photo du numéro marchand ou du panneau,
        et photo du ticket. Le client paie, joint la capture du SMS, puis vous confirmez que le vendeur a bien reçu. Seul
        votre service passe par le séquestre&nbsp;; EduCash n&rsquo;est ni partie, ni dépositaire, ni garant des achats
        et ne rembourse pas un paiement fait hors plateforme. Les détails sont dans les{" "}
        <AnchorLink className="link" href="/legal/terms#achats">conditions d&rsquo;utilisation</AnchorLink>.
      </>
    ),
  },
  {
    id: "commission",
    question: "Combien prend EduCash ?",
    answer: `Une seule commission de ${COMMISSION} %, prélevée sur le paiement de l'étudiant. Vous voyez toujours ce que vous touchez avant de postuler.`,
  },
  {
    id: "retrait",
    question: "Comment retirer mon argent ?",
    answer: `Depuis votre portefeuille, vers votre MTN MoMo, votre Moov Money ou votre Celtiis Cash, à partir de ${formatFcfa(MIN_WITHDRAWAL_AMOUNT)}.`,
  },
  {
    id: "carte",
    question: "Faut-il une carte étudiante pour s'inscrire ?",
    answer:
      "Non, l'inscription est gratuite. Votre carte étudiante est demandée au moment de postuler et vérifiée à la main par l'équipe.",
  },
]

// FAQ étudiante de /etudiants (maquette V05 v3).
export function EtudiantsFaq() {
  return (
    <section className="section" id="faq">
      <div className="v05-faq">
        <div>
          <span className="eyebrow eyebrow--bleu">Questions fréquentes</span>
          <h2 className="display display--l ds-mt-3">
            Vous vous<br /><span className="hl-bleu">demandez ?</span>
          </h2>
          <p className="muted ds-mt-4">Les questions qu&rsquo;on nous pose le plus. Le reste est dans l&rsquo;aide.</p>
          <Link className="btn btn--secondary ds-mt-6" href="/aide">
            Toutes les questions
            <Icon name="i-arrow-right" />
          </Link>
        </div>
        <Faq items={FAQ_ITEMS} headingLevel={3} />
      </div>
    </section>
  )
}
