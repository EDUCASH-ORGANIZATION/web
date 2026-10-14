// @ds-screen RD-STUDENT-01
import { StudentApplicationsSkeleton } from "@/components/student-space/applications/applications-view"

// Le segment /applications n'a pas d'enfant dynamique et n'appelle jamais notFound : un loading.js y est sûr.
export default function StudentApplicationsLoading() {
  return <StudentApplicationsSkeleton />
}
