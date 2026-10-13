// @ds-screen RD-CLIENT-01
import { getClientDashboard } from "@/lib/actions/client-dashboard.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { todayInBenin } from "@/lib/app/format"
import { ClientDashboardView } from "@/components/client-space/dashboard/client-dashboard-view"

export const metadata = { title: "Espace client - EduCash" }

// Page mince : les données viennent de l'action (requireRole client), la vue est pure.
export default async function ClientDashboardPage() {
  const result = await getClientDashboard()
  return (
    <ClientDashboardView
      data={result.data}
      error={result.error}
      today={todayInBenin()}
      paymentsEnabled={paymentsEnabled()}
    />
  )
}
