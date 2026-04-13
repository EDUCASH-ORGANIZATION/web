import Image from "next/image"
import Link from "next/link"

const SIZES = { sm: 28, md: 36, lg: 52 }

/**
 * Logo EduCash (public/logo.svg).
 *
 * @param {{ size?: 'sm'|'md'|'lg', href?: string, className?: string }} props
 */
export function Logo({ size = "md", href, className = "" }) {
  const px = SIZES[size] ?? SIZES.md

  const img = (
    <Image
      src="/logo.svg"
      alt="EduCash"
      width={px}
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
