import clsx from "clsx"

const paddingClasses = {
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
}

export function Card({ children, className, padding = "md", onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white rounded-xl shadow-sm",
        paddingClasses[padding],
        onClick &&
          "cursor-pointer hover:shadow-md transition-shadow duration-200",
        className
      )}
    >
      {children}
    </div>
  )
}
