import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { Scribble } from "@/components/vitrine/shared/scribble"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/vitrine/format"

const EXAMPLE_BUDGET = 25000

// Récapitulatif d'exemple (maquettes V01 et V06) : commission issue de COMMISSION_RATE.
export function exampleRecap() {
  return {
    lines: [
      { label: "Budget de la mission", value: formatFcfa(EXAMPLE_BUDGET) },
      { label: `Dont commission ${Math.round(COMMISSION_RATE * 100)} %`, value: formatFcfa(Math.round(EXAMPLE_BUDGET * COMMISSION_RATE)) },
    ],
    note: "Bloqué en séquestre",
  }
}

// Carte d'appel à l'action. Champs facultatifs : tag (pastille de public), secondary (lien discret),
// badge ({ value, caption }, pastille ronde) et recap ({ lines, note }, mini récapitulatif).
function CtaCard({ tone, tag, card, scribble }) {
  const { title, text, href, label, secondary, badge, recap } = card
  const citron = tone === "citron"
  return (
    <div className={citron ? "v-cta v-cta--citron" : "v-cta v-cta--bleu grid-bg on-bleu"}>
      {recap ? (
        <div className="v-cta__recap">
          <span className="eyebrow">Récapitulatif</span>
          {recap.lines.map(({ label: lineLabel, value }) => (
            <div className="recap__line" key={lineLabel}>
              <span className="muted">{lineLabel}</span>
              <b>{value}</b>
            </div>
          ))}
          {recap.note ? (
            <span className="badge badge--lavande badge--sm ds-self-start">
              <Icon name="i-lock" />
              {recap.note}
            </span>
          ) : null}
        </div>
      ) : null}
      {tag}
      <h2 className={recap ? "display display--l v-cta__title--low" : "display display--l"}>{title}</h2>
      <p className="body-l ds-measure-m">{text}</p>
      <div className="v-cta__actions">
        <Link className={citron ? "btn btn--dark btn--lg" : "btn btn--primary btn--lg"} href={href}>
          {label}
          <span className="btn__dot"><Icon name="i-arrow-right" /></span>
        </Link>
        {secondary ? (
          <Link className="btn btn--ghost" href={secondary.href}>{secondary.label}</Link>
        ) : null}
      </div>
      {badge ? (
        <div className="v-cta__badge">
          <div><b>{badge.value}</b><span>{badge.caption}</span></div>
        </div>
      ) : null}
      {scribble ? <Scribble name="sc-arrow" className="scribble--encre v-cta__scribble" viewBox="0 0 80 70" /> : null}
    </div>
  )
}

// Double appel à l'action étudiant / client (maquettes V01 et V06). Chaque côté accepte
// { title, text, href, label, secondary?, badge?, recap? } ; le côté client accepte aussi tag.
export function CtaDouble({ student, client }) {
  return (
    <div className="v-cta2">
      <CtaCard
        tone="citron"
        tag={<span className="badge badge--encre ds-self-start">Étudiant</span>}
        card={student}
        scribble
      />
      <CtaCard
        tone="bleu"
        tag={client.tag ? <span className="badge ds-badge-blanc ds-self-start">{client.tag}</span> : null}
        card={client}
      />
    </div>
  )
}
