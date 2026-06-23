import { promises as dns } from "dns"

const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "temp-mail.org", "throwaway.com", "mailinator.com", "guerrillamail.com",
  "yopmail.com", "sharklasers.com", "getairmail.com", "10minutemail.com", "burnermail.io",
  "tempmailaddress.com", "fakeemail.com", "emailfake.com", "tempinbox.com", "dispostable.com",
  "maildrop.cc", "getnada.com", "tempail.com", "tmpmail.org", "mailnesia.com",
  "tempm.com", "mailsac.com", "inboxkitten.com", "trashmail.com", "anonaddy.me",
  "simplelogin.com", "simplelogin.io", "mozmail.com", "duck.com",
])

export function isDisposableEmail(email = "") {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}

export async function hasEmailMxRecord(email = "") {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false
  try {
    const records = await dns.resolveMx(domain)
    return records.length > 0 && records.some((r) => r.exchange && r.exchange.length > 0)
  } catch {
    return false
  }
}

export function validateEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
