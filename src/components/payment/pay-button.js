"use client"

import { useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { initiatePayment } from "@/lib/actions/payment.actions"
import { useToast } from "@/components/shared/toaster"

/**
 * @param {{ missionId: string }} props
 */
export function PayButton({ missionId }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  async function handlePay() {
    if (isLoading) return
    setIsLoading(true)

    const result = await initiatePayment({ missionId })

    if (result.paymentUrl) {
      window.location.href = result.paymentUrl
      // Ne pas setIsLoading(false) — la page redirige
      return
    }

    toast({ message: result.error ?? "Une erreur est survenue.", type: "error" })
    setIsLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={isLoading}
      className="w-full h-12 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] active:bg-[#104530] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Redirection…
        </>
      ) : (
        <>
          <CreditCard size={16} />
          Payer maintenant
        </>
      )}
    </button>
  )
}
