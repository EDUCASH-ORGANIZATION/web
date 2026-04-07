import clsx from "clsx"

const variantClasses = {
  primary:
    "bg-[#1A6B4A] text-white hover:bg-[#155a3d] active:bg-[#104530] focus-visible:ring-[#1A6B4A]",
  secondary:
    "border border-[#1A6B4A] text-[#1A6B4A] bg-white hover:bg-[#f0faf5] active:bg-[#d9f2e8] focus-visible:ring-[#1A6B4A]",
  ghost:
    "text-gray-700 bg-transparent hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500",
}

const sizeClasses = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
}

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  children,
  type = "button",
  className,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  )
}
