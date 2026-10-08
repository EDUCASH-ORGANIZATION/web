// En-tête de page intérieure de la vitrine (maquettes V05 à V09).
const TONE_CLASS = {
  bleu: "",
  encre: " v-pagehead--encre",
  citron: " v-pagehead--citron",
}

const EYEBROW_CLASS = {
  bleu: "eyebrow ds-text-blanc",
  encre: "eyebrow ds-text-brume",
  citron: "eyebrow ds-text-encre",
}

export function PageHead({ eyebrow, title, lead, tone = "bleu", size = "l", children }) {
  const toneClass = TONE_CLASS[tone] ?? ""
  return (
    <div className={`v-pagehead grid-bg${toneClass}`}>
      {eyebrow ? <span className={EYEBROW_CLASS[tone] ?? "eyebrow"}>{eyebrow}</span> : null}
      <h1 className={`display display--${size} ds-mt-3`}>{title}</h1>
      {lead ? <p className="body-l ds-mt-4 ds-measure-l">{lead}</p> : null}
      {children}
    </div>
  )
}
