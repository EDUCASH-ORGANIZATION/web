import { forwardRef } from "react"
import clsx from "clsx"

export const Input = forwardRef(function Input(
  {
    label,
    name,
    type = "text",
    placeholder,
    error,
    disabled = false,
    leftIcon,
    rightIcon,
    className,
    ...props
  },
  ref
) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          suppressHydrationWarning
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          className={clsx(
            "w-full rounded-lg border bg-white text-sm text-gray-900 placeholder:text-gray-400",
            "h-10 px-3 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[#1A6B4A] focus:border-transparent",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 hover:border-gray-400",
            disabled && "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
          {...props}
        />

        {rightIcon && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p id={`${name}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
})
