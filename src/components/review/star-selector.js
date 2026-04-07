"use client"

import { useState } from "react"
import { Star } from "lucide-react"

const LABELS = ["", "Très décevant", "Décevant", "Correct", "Bien", "Excellent"]

/**
 * @param {{ onRate: (rating: number) => void }} props
 */
export function StarSelector({ onRate }) {
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)

  const active = hovered || selected

  function handleClick(index) {
    setSelected(index)
    onRate(index)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => {
          const index = i + 1
          return (
            <button
              key={index}
              type="button"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => handleClick(index)}
              className="p-1 transition-transform hover:scale-110 touch-manipulation"
              aria-label={LABELS[index]}
            >
              <Star
                size={32}
                className={
                  index <= active
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200"
                }
              />
            </button>
          )
        })}
      </div>
      <p className="text-sm font-medium text-gray-600 h-5">
        {LABELS[active] ?? ""}
      </p>
    </div>
  )
}
