import Image from "next/image"

// Logos des opérateurs Mobile Money (fichiers dans public/logos/operators, dimensions réelles en attributs).
const OPERATORS = {
  mtn: { src: "/logos/operators/mtn.png", alt: "MTN Mobile Money", width: 163, height: 166 },
  moov: { src: "/logos/operators/moov.png", alt: "Moov Money", width: 176, height: 159 },
  celtiis: { src: "/logos/operators/celtiis.png", alt: "Celtiis", width: 132, height: 130 },
}

export function OperatorLogo({ operator }) {
  const logo = OPERATORS[operator]
  if (!logo) return null
  return <Image className="payer__logo" src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} />
}
