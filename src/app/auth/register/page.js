import { AlertCircle } from "lucide-react"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata = {
  title: "Inscription — EduCash",
}

const ERROR_MESSAGES = {
  lien_invalide_ou_expire: "Le lien de confirmation a expiré ou est invalide. Réinscris-toi.",
  access_denied:           "Accès refusé. Le lien a peut-être déjà été utilisé.",
}

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams
  const errorKey = params?.error
  const errorMessage = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? "Une erreur est survenue. Réessaie.")
    : null

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

        {/* Erreur de callback (lien expiré, etc.) */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 mb-5">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <RegisterForm />
      </div>
    </main>
  )
}
