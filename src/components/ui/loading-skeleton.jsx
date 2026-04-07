import clsx from "clsx"

export function LoadingSkeleton({ className }) {
  return (
    <div className={clsx("animate-pulse bg-gray-200 rounded-lg", className)} />
  )
}
