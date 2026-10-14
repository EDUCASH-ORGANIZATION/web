export const dynamic = "force-dynamic"

// Sonde de santé : aucune donnée, aucune variable d'environnement exposée.
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } })
}
