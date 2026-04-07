import { RegisterForm } from "@/components/auth/register-form"

export const metadata = {
  title: "Inscription — EduCash",
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span>
            <span className="text-[#F59E0B]">Cash</span>
          </span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rejoindre EduCash</h1>
          <p className="mt-1 text-sm text-gray-500">Choisis ton profil</p>
        </div>

        <RegisterForm />
      </div>
    </main>
  )
}
