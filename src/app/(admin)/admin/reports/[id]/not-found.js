// @ds-screen RD-ADMIN-01
import { EmptyState } from "@/components/app-ui/empty-state"
import { adminReportsHref } from "@/lib/app/admin-routes"

export const metadata = { title: "Signalement introuvable - Admin EduCash" }

export default function ReportNotFound() {
  return (
    <div className="a2-10">
      <EmptyState
        icon="i-flag"
        titleAs="h1"
        title="Ce signalement est introuvable"
        text="Il a peut-être été supprimé ou le lien est incorrect."
        action={{ href: adminReportsHref(), label: "Retour aux signalements" }}
      />
    </div>
  )
}
