// @ds-screen RD-STUDENT-01
import { getStudentDashboard } from "@/lib/actions/student-dashboard.actions"
import { paymentsEnabled } from "@/lib/constants/payments"
import { todayInBenin } from "@/lib/app/format"
import { StudentDashboardView } from "@/components/student-space/dashboard/student-dashboard-view"

export const metadata = { title: "Tableau de bord - EduCash" }

// Page mince : les données viennent de l'action (requireRole étudiant), la vue est pure.
export default async function StudentDashboardPage() {
  const result = await getStudentDashboard()
  return (
    <StudentDashboardView
      data={result.data}
      error={result.error}
      today={todayInBenin()}
      paymentsEnabled={paymentsEnabled()}
    />
  )
}
