export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { promises as dns } from "dns"

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email") ?? ""
  const domain = email.split("@")[1]?.toLowerCase()

  if (!domain) {
    return NextResponse.json({ valid: false })
  }

  try {
    const records = await dns.resolveMx(domain)
    const valid = records.length > 0 && records.some((r) => r.exchange?.length > 0)
    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
