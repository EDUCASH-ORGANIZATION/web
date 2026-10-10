// Domaines d'adresses jetables refusés à l'inscription. JS pur : importable côté client.
export const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "temp-mail.org", "throwaway.com", "mailinator.com", "guerrillamail.com",
  "yopmail.com", "sharklasers.com", "getairmail.com", "10minutemail.com", "burnermail.io",
  "tempmailaddress.com", "fakeemail.com", "emailfake.com", "tempinbox.com", "dispostable.com",
  "maildrop.cc", "getnada.com", "tempail.com", "tmpmail.org", "mailnesia.com",
  "tempm.com", "mailsac.com", "inboxkitten.com", "trashmail.com", "anonaddy.me",
  "simplelogin.com", "simplelogin.io", "mozmail.com", "duck.com",
])

export function isDisposableDomain(domain = "") {
  return DISPOSABLE_DOMAINS.has(String(domain).toLowerCase())
}
