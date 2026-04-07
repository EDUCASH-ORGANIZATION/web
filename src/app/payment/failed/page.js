"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { XCircle } from "lucide-react"

export default function PaymentFailedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center text-center">

        {/* Icône erreur */}
        <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-5 shadow-lg">
          <XCircle size={40} className="text-white" strokeWidth={2} />
        </div>

        <h1 className="text-2xl font-bold text-red-600 mb-2">
          Paiement échoué
        </h1>
        <p className="text-gray-500 text-sm">
          Une erreur est survenue lors du paiement.
        </p>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full h-11 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors touch-manipulation"
          >
            Réessayer
          </button>

          <Link
            href="/contact"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Contacter le support
          </Link>
        </div>

      </div>
    </div>
  )
}
