import Image from "next/image"
import Link from "next/link"

// Charte EduCash : symbole >= 32 px. Ratio du symbole 104,88/100.
const SIZES = { sm: 32, md: 36, lg: 52 }
const RATIO = 1.0488

/**
 * Logo EduCash (symbole, public/logo.svg).
 *
 * @param {{ size?: 'sm'|'md'|'lg', href?: string, className?: string }} props
 */
export function Logo({ size = "md", href, className = "" }) {
  const px = SIZES[size] ?? SIZES.md

  const img = (
    <Image
      src="/logo.svg"
      alt="EduCash"
      width={Math.round(px * RATIO)}
      height={px}
      className={className}
      priority
    />
  )

  if (href) {
    return <Link href={href} className="inline-flex">{img}</Link>
  }
  return img
}
