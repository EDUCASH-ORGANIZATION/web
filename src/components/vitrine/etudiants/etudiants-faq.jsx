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
    question: "Est-ce que je suis sûr d'être payé ?",
    answer: (
      <>
        Oui. Le client bloque le budget sur EduCash <b>avant</b>{" "}
        que la mission commence&nbsp;: c&rsquo;est le séquestre. Une fois la mission faite, le client valide la fin de
        mission et ton argent arrive sur ton portefeuille EduCash. Jusque-là, il reste bloqué. Un souci pendant la
        mission&nbsp;? Contacte l&rsquo;équipe EduCash depuis la page{" "}
        <Link className="link" href="/contact?sujet=signalement">Contact</Link>&nbsp;: nous intervenons en médiation.
      </>
    ),
  },
  {
    id: "avance",
    question: "Je dois avancer l'argent du marché ?",
    answer: (
      <>
        Non. Les achats sont réglés par le client directement au vendeur, par Mobile Money. Toi, tu n&rsquo;avances
        rien. Les détails sont dans les{" "}
        <AnchorLink className="link" href="/legal/terms#achats">conditions d&rsquo;utilisation</AnchorLink>.
      </>
    ),
  },
  {
    id: "commission",
    question: "Combien prend EduCash ?",
    answer: `Une seule commission de ${COMMISSION} %, prélevée sur le paiement de l'étudiant. Tu vois toujours ce que tu touches avant de postuler.`,
  },
  {
    id: "retrait",
    question: "Comment je retire mon argent ?",
    answer: `Depuis ton portefeuille, vers ton MTN MoMo, ton Moov Money ou ton Celtiis Cash, à partir de ${formatFcfa(MIN_WITHDRAWAL_AMOUNT)}.`,
  },
  {
    id: "carte",
    question: "Faut-il une carte étudiante pour s'inscrire ?",
    answer:
      "Non, l'inscription est gratuite. Ta carte étudiante est demandée au moment de postuler et vérifiée à la main par l'équipe.",
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
            Tu te<br /><span className="hl-bleu">demandes ?</span>
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
