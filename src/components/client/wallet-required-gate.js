import Link from "next/link"
import { Wallet, ShieldCheck, ArrowRight } from "lucide-react"

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0)
}

export function WalletRequiredGate({ available = 0 }) {
  return (
    <div className="max-w-md mx-auto py-16 px-4 flex flex-col items-center text-center gap-6">

      {/* Icône */}
      <div className="w-20 h-20 rounded-2xl bg-[#f0faf5] border border-green-100 flex items-center justify-center">
        <Wallet size={40} className="text-[#1A6B4A]" />
      </div>

      {/* Texte */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-black text-gray-900 leading-snug">
          Rechargez votre wallet pour publier une mission
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          EduCash bloque les fonds lors de la publication pour garantir
          le paiement aux étudiants. Rechargez votre wallet avant de continuer.
        </p>
      </div>

      {/* Solde actuel */}
      <div className="w-full bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">Solde disponible actuel</p>
        <p className="text-base font-black text-gray-900">
          {fmt(available)} <span className="text-sm font-bold text-gray-400">FCFA</span>
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/client/wallet"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors touch-manipulation"
      >
        <Wallet size={16} />
        Recharger mon wallet
        <ArrowRight size={16} />
      </Link>

      {/* Info sécurité */}
      <div className="w-full flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-left">
        <ShieldCheck size={16} className="text-[#1A6B4A] shrink-0 mt-0.5" />
        <p className="text-xs text-green-800 leading-relaxed">
          <strong>Système d&apos;escrow sécurisé :</strong> vos fonds sont bloqués à la publication
          et libérés uniquement quand vous confirmez que la mission est terminée.
          Si la mission est annulée, vous êtes intégralement remboursé.
        </p>
      </div>
    </div>
  )
}
