"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserX, Loader2 } from "lucide-react"
import { suspendUser } from "@/lib/actions/admin.actions"
import { useToast } from "@/components/shared/toaster"

/**
 * @param {{ userId: string, name: string, isSuspended: boolean }} props
 */
export function SuspendButton({ userId, name, isSuspended }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  if (isSuspended) {
    return (
      <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-lg">
        Suspendu
      </span>
    )
  }

  async function handleSuspend() {
    if (!confirm(`Suspendre ${name} ?`)) return
    setIsLoading(true)
    const result = await suspendUser(userId)
    setIsLoading(false)
    if (result.error) {
      toast({ message: result.error, type: "error" })
    } else {
      toast({ message: `${name} suspendu(e).`, type: "success" })
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={handleSuspend}
      disabled={isLoading}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 touch-manipulation"
    >
      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} />}
      Suspendre
    </button>
  )
}
