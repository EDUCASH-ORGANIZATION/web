import { promises as dns } from "dns"
import { isDisposableDomain } from "@/lib/auth/disposable-domains"

export function isDisposableEmail(email = "") {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false
  return isDisposableDomain(domain)
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
