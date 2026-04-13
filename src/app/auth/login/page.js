import { LoginForm } from "@/components/auth/login-form"
import { Logo } from "@/components/shared/logo"

export const metadata = {
  title: "Connexion — EduCash",
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10">
        {/* Logo + nom */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <Logo size="lg" />
          <span className="text-2xl font-black tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
          </span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bon retour 👋</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connecte-toi à ton compte EduCash
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  )
}
