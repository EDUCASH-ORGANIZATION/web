import { StudentProfileForm } from "@/components/auth/student-profile-form"
import { Logo } from "@/components/shared/logo"

export const metadata = {
  title: "Mon profil étudiant — EduCash",
}

export default function StudentOnboardingPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <Logo size="lg" />
          <span className="text-2xl font-black tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
          </span>
        </div>

        <StudentProfileForm />
      </div>
    </main>
  )
}
