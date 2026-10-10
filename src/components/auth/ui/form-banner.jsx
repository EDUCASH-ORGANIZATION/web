import { Icon } from "@/components/design/icon"

const TONES = {
  info: { icon: "i-info", role: "status" },
  erreur: { icon: "i-alert-circle", role: "alert" },
  alerte: { icon: "i-alert-triangle", role: "alert" },
  succes: { icon: "i-check-circle", role: "status" },
}

/**
 * Bannière de formulaire (`.banner`).
 * @param {{
 *   tone?: "info" | "erreur" | "alerte" | "succes",
 *   icon?: string,
 *   title?: string,
 *   actions?: React.ReactNode,
 *   children?: React.ReactNode,
 * }} props
 */
export function FormBanner({ tone = "info", icon, title, actions, children }) {
  const config = TONES[tone] ?? TONES.info
  return (
    <div className={`banner banner--${TONES[tone] ? tone : "info"}`} role={config.role}>
      <Icon name={icon ?? config.icon} />
      <div className="banner__body">
        {title && <div className="banner__title">{title}</div>}
        {children}
        {actions && <div className="banner__actions">{actions}</div>}
      </div>
    </div>
  )
}
