import { SPRITE_VERSION } from "@/components/design/sprite"
import { VitrinePage } from "@/components/vitrine/shared/vitrine-page"
import { Payers } from "@/components/vitrine/shared/payers"
import { CtaDouble } from "@/components/vitrine/shared/cta-double"

export const metadata = {
  title: "À propos",
  description:
    "EduCash relie des étudiants de Cotonou, Abomey-Calavi et Porto-Novo à des clients qui ont besoin d'un coup de main, avec un paiement bloqué en séquestre avant le début du travail.",
  openGraph: { url: "/about" },
}

const VALUES = [
  {
    tone: "bleu",
    shape: "sh-burst",
    title: "Confiance",
    text: "Chaque carte étudiante est vérifiée à la main, et l'argent de chaque mission est en séquestre avant le premier jour.",
  },
  {
    tone: "blanc",
    shape: "sh-circle",
    title: "Transparence",
    text: "Commission de 12 % affichée partout, montant net visible avant de postuler, aucun chiffre gonflé sur ce site.",
  },
  {
    tone: "encre",
    shape: "sh-quarter",
    title: "Impact local",
    text: "Des missions à Cotonou, Abomey-Calavi et Porto-Novo, payées sur MTN MoMo et Moov Money, là où les étudiants vivent.",
  },
  {
    tone: "lavande",
    shape: "sh-star",
    title: "Respect",
    text: "Des règles claires pour les deux côtés, et une équipe joignable quand une mission se passe mal.",
  },
]

function Shape({ name, className }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`/sprite.svg?v=${SPRITE_VERSION}#${name}`} />
    </svg>
  )
}

export default function AboutPage() {
  return (
    <VitrinePage>
      <div className="v06-head">
        <Shape name="roundel" className="roundel spin" />
        <svg className="scribble scribble--bleu v06-scribble" viewBox="0 0 150 70" aria-hidden="true" focusable="false">
          <use href={`/sprite.svg?v=${SPRITE_VERSION}#sc-loop`} />
        </svg>
        <span className="eyebrow">À propos d&apos;EduCash</span>
        <h1 className="display display--xxl ds-mt-4">
          On parie sur
          <br />
          les étudiants
          <br />
          <span className="underline-scribble hl-bleu">
            qui bossent.
            <svg className="scribble scribble--bleu" viewBox="0 0 240 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <use href={`/sprite.svg?v=${SPRITE_VERSION}#sc-underline`} />
            </svg>
          </span>
        </h1>
        <p className="body-l v06-head__lead">
          EduCash relie des étudiants de Cotonou, Abomey-Calavi et Porto-Novo à des particuliers, des PME et des
          associations qui ont besoin d&apos;un coup de main. Avec une règle simple&nbsp;: l&apos;argent est bloqué
          avant que le travail commence.
        </p>
      </div>

      <section className="section">
        <div className="ds-container">
          <div className="v06-story">
            <div>
              <span className="eyebrow eyebrow--bleu">Notre histoire</span>
              <h2 className="display display--l ds-mt-3">
                D&apos;où ça
                <br />
                <span className="hl-bleu">vient.</span>
              </h2>
            </div>
            <div>
              <p>
                Entre deux cours, beaucoup d&apos;étudiants cherchent à gagner un peu d&apos;argent. De l&apos;autre
                côté, des familles, des boutiques et des associations ont besoin d&apos;aide pour quelques heures&nbsp;:
                un cours, une livraison, une saisie, une garde d&apos;enfants.
              </p>
              <p>
                Jusqu&apos;ici, ils se trouvaient par le bouche-à-oreille, sans garantie&nbsp;: l&apos;étudiant
                n&apos;était pas sûr d&apos;être payé, le client pas sûr que le travail soit fait. EduCash se place au
                milieu, comme tiers de confiance.
              </p>
              <p className="v06-quote">
                Le client bloque l&apos;argent avant. L&apos;étudiant est payé après. Personne n&apos;avance rien à
                l&apos;aveugle.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ds-container">
          <div className="section__head">
            <div>
              <span className="eyebrow eyebrow--bleu">Nos valeurs</span>
              <h2 className="display display--l ds-mt-3">
                Quatre règles,
                <br />
                <span className="hl-bleu">pas plus.</span>
              </h2>
            </div>
          </div>
          <div className="v06-vals">
            {VALUES.map((value, index) => (
              <div key={value.title} className={`v06-val v06-val--${value.tone}`}>
                <Shape name={value.shape} className="v06-val__shape" />
                <span className="v06-val__n">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="v06-val__t">{value.title}</h3>
                <p>{value.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="v06-band">
        <div className="row row--between ds-items-end">
          <div>
            <span className="eyebrow">Partenaires de paiement</span>
            <h2 className="display display--l ds-mt-3">
              L&apos;argent passe par
              <br />
              <span className="hl-citron">des acteurs connus.</span>
            </h2>
          </div>
          <p className="body-s v06-band__lead">
            Les recharges et les retraits sont opérés par FedaPay, vers MTN MoMo et Moov Money. EduCash ne vous
            demande jamais votre code secret Mobile Money.
          </p>
        </div>
        <div className="v06-pay">
          <Payers />
        </div>
      </div>

      <CtaDouble
        student={{
          title: "Ton temps vaut de l'argent. Prouve-le.",
          text: "Crée ton profil gratuitement, postule près de ta fac et encaisse sur ton MoMo.",
          href: "/auth/register?role=student",
          label: "Créer mon compte",
        }}
        client={{
          title: "Une mission ? Un étudiant vérifié.",
          text: "Publiez votre besoin en deux minutes. Le budget reste bloqué jusqu'à ce que vous validiez le travail.",
          href: "/auth/register?role=client",
          label: "Publier une mission",
        }}
      />
    </VitrinePage>
  )
}
