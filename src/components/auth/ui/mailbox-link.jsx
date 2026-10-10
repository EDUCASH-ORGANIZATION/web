import { Icon } from "@/components/design/icon"

const PROVIDERS = [
  { name: "Gmail", href: "https://mail.google.com/", domains: [/^(gmail|googlemail)\.com$/] },
  { name: "Outlook", href: "https://outlook.live.com/mail/", domains: [/^(outlook|hotmail|live|msn)\.[a-z.]+$/] },
  { name: "Yahoo", href: "https://mail.yahoo.com/", domains: [/^(yahoo|ymail|rocketmail)\.[a-z.]+$/] },
]

/**
 * Messagerie web correspondant au domaine de l'adresse, ou null si inconnue.
 * @param {string} [email]
 * @returns {{ name: string, href: string } | null}
 */
export function mailboxFor(email) {
  const domain = String(email ?? "").trim().toLowerCase().split("@")[1]
  if (!domain) return null
  const provider = PROVIDERS.find((p) => p.domains.some((re) => re.test(domain)))
  return provider ? { name: provider.name, href: provider.href } : null
}

/**
 * Bouton « Ouvrir ma messagerie » (Gmail, Outlook, Yahoo selon le domaine). Ne rend rien
 * pour un domaine inconnu.
 * @param {{ email?: string, className?: string }} props
 */
export function MailboxLink({ email, className = "btn btn--primary btn--lg btn--block" }) {
  const mailbox = mailboxFor(email)
  if (!mailbox) return null
  return (
    <a className={className} href={mailbox.href} target="_blank" rel="noopener noreferrer">
      <Icon name="i-external" />
      Ouvrir ma messagerie
      <span className="sr-only"> ({mailbox.name}, nouvel onglet)</span>
    </a>
  )
}
