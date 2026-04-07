import Link from "next/link"
import { Button } from "@/components/ui/button"

export function EmptyState({ icon: Icon, title, message, ctaLabel, onCta, ctaHref }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      {Icon && <Icon size={48} className="text-gray-300" strokeWidth={1.5} />}

      {title && (
        <p className="text-base font-semibold text-gray-700">{title}</p>
      )}

      {message && (
        <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      )}

      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="mt-2">
          <Button variant="primary">{ctaLabel}</Button>
        </Link>
      )}

      {ctaLabel && onCta && !ctaHref && (
        <Button variant="primary" onClick={onCta} className="mt-2">
          {ctaLabel}
        </Button>
      )}
    </div>
  )
}
