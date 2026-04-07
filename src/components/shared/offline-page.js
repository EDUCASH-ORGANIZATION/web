"use client"

import { WifiOff } from "lucide-react"

export function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
        <WifiOff size={40} className="text-gray-400" strokeWidth={1.5} />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Vous êtes hors ligne</h1>
      <p className="text-sm text-gray-500 max-w-xs mb-8">
        Reconnectez-vous pour accéder à EduCash.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-semibold hover:bg-[#155a3d] transition-colors touch-manipulation"
      >
        Réessayer
      </button>
    </div>
  )
}
