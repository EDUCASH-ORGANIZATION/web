import Image from "next/image"

// Logos des opérateurs Mobile Money (fichiers dans public/logos/operators, dimensions réelles en attributs).
// Le libellé visible suit toujours le logo : image décorative (alt vide).
const OPERATORS = {
  mtn: { src: "/logos/operators/mtn.png", width: 163, height: 166 },
  moov: { src: "/logos/operators/moov.png", width: 176, height: 159 },
  // prêt pour quand le retrait Celtiis sera branché
  celtiis: { src: "/logos/operators/celtiis.png", width: 132, height: 130 },
}

export function OperatorLogo({ operator }) {
  const logo = OPERATORS[operator]
  if (!logo) return null
  return <Image className="payer__logo" src={logo.src} alt="" width={logo.width} height={logo.height} />
}
