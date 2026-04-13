import Link from "next/link"
import { Mail } from "lucide-react"
import { Logo } from "@/components/shared/logo"

export const metadata = { title: "Vérifiez votre email — EduCash" }

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10 text-center">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Logo size="lg" />
          <span className="text-2xl font-black tracking-tight">
            <span className="text-[#1A6B4A]">Edu</span><span className="text-[#F59E0B]">Cash</span>
          </span>
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[#f0faf5] flex items-center justify-center">
            <Mail size={32} className="text-[#1A6B4A]" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Un email de confirmation vous a été envoyé. Cliquez sur le lien dans l&apos;email pour activer votre compte et compléter votre profil.
        </p>

        <p className="text-xs text-gray-400">
          Vous n&apos;avez pas reçu d&apos;email ?{" "}
          <Link href="/auth/register" className="text-[#1A6B4A] hover:underline">
            Réessayer
          </Link>
        </p>
      </div>
    </main>
  )
}
