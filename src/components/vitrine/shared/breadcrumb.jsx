import Link from "next/link"
import { Fragment } from "react"
import { Icon } from "@/components/design/icon"

// Fil d'Ariane : le dernier élément est la page courante (maquette V03).
export function Breadcrumb({ items }) {
  const lastIndex = items.length - 1
  return (
    <nav className="breadcrumb" aria-label="Fil d'Ariane">
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <Icon name="i-chevron-right" /> : null}
          {index === lastIndex || !item.href ? (
            <span aria-current={index === lastIndex ? "page" : undefined}>{item.label}</span>
          ) : (
            <Link href={item.href}>{item.label}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
