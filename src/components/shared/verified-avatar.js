import { Check } from "lucide-react"

// ─── Tables de tailles ────────────────────────────────────────────────────────

const sizeClasses = {
  sm: "w-8 h-8",       // 32px — sidebar, listes compactes
  md: "w-12 h-12",     // 48px — cartes candidats, conversations
  lg: "w-20 h-20",     // 80px — pages profil
  xl: "w-[120px] h-[120px]", // 120px — header profil public
}

const textSizeClasses = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
}

const badgeSizeClasses = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-[22px] h-[22px]",
  xl: "w-7 h-7",
}

const iconSizeClasses = {
  sm: 7,
  md: 10,
  lg: 13,
  xl: 16,
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Avatar universel avec badge de vérification optionnel.
 *
 * @param {{
 *   avatarUrl:    string | null,
 *   fullName:     string,
 *   isVerified:   boolean,
 *   verifiedUntil?: string | null,
 *   size?:        'sm' | 'md' | 'lg' | 'xl',
 *   showBadge?:   boolean,
 * }} props
 */
export function VerifiedAvatar({
  avatarUrl,
  fullName,
  isVerified = false,
  verifiedUntil = null,
  size = "md",
  showBadge = true,
}) {
  const initial = fullName?.charAt(0)?.toUpperCase() ?? "?"

  // Le badge est affiché uniquement si la vérification n'est pas expirée
  const isStillValid = !verifiedUntil || new Date(verifiedUntil) > new Date()
  const showVerifiedBadge = isVerified && isStillValid && showBadge

  const tooltipText = verifiedUntil
    ? `Vérifié jusqu'au ${new Intl.DateTimeFormat("fr-FR").format(new Date(verifiedUntil))}`
    : "Profil EduCash vérifié ✓"

  return (
    <div className="relative inline-block shrink-0">
      {/* Avatar */}
      <div className={`rounded-full overflow-hidden ${sizeClasses[size]}`}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#1A6B4A] flex items-center justify-center">
            <span className={`text-white font-bold ${textSizeClasses[size]}`}>
              {initial}
            </span>
          </div>
        )}
      </div>

      {/* Badge vérifié */}
      {showVerifiedBadge && (
        <div
          title={tooltipText}
          className={`absolute bottom-0 right-0 bg-[#1A6B4A] rounded-full border-2 border-white flex items-center justify-center cursor-help ${badgeSizeClasses[size]}`}
        >
          <Check
            size={iconSizeClasses[size]}
            color="white"
            strokeWidth={3}
          />
        </div>
      )}
    </div>
  )
}
