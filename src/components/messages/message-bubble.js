"use client"

import { MapPin } from "lucide-react"

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
})

// ─── Sous-composants par type ─────────────────────────────────────────────────

function VoiceBubble({ src, isOwn }) {
  return (
    <div
      className={`px-3 py-2.5 ${
        isOwn
          ? "bg-[#E8F5EE] rounded-[16px_16px_4px_16px]"
          : "bg-gray-100 rounded-[16px_16px_16px_4px]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">🎵</span>
        <audio
          src={src}
          controls
          preload="metadata"
          className="h-8 max-w-[200px]"
          style={{ colorScheme: "light" }}
        />
      </div>
    </div>
  )
}

function ImageBubble({ src, isOwn }) {
  return (
    <div
      className={`overflow-hidden ${
        isOwn ? "rounded-[16px_16px_4px_16px]" : "rounded-[16px_16px_16px_4px]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Image"
        className="max-w-[240px] max-h-[220px] object-cover block"
        loading="lazy"
      />
    </div>
  )
}

function LocationBubble({ lat, lng, isOwn }) {
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
  const imgSrc  = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=224x128&markers=${lat},${lng},ol-marker-blue`

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block w-56 overflow-hidden border ${
        isOwn
          ? "border-green-200 rounded-[16px_16px_4px_16px]"
          : "border-gray-200 rounded-[16px_16px_16px_4px]"
      }`}
    >
      {/* Carte statique */}
      <div className="relative h-32 bg-blue-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt="Carte"
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
        {/* Pin centré (toujours visible même si l'image échoue) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <MapPin size={28} className="text-red-500 drop-shadow-md" fill="white" />
        </div>
      </div>

      {/* Footer */}
      <div className={`px-3 py-2 ${isOwn ? "bg-[#E8F5EE]" : "bg-white"}`}>
        <p className="text-xs font-bold text-gray-900">📍 Position partagée</p>
        <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
          Ouvrir dans Google Maps →
        </p>
      </div>
    </a>
  )
}

function TextBubble({ content, isOwn }) {
  return (
    <div
      className={
        isOwn
          ? "bg-[#E8F5EE] text-gray-900 px-4 py-2.5 text-sm leading-relaxed"
          + " rounded-[16px_16px_4px_16px]"
          : "bg-gray-100 text-gray-900 px-4 py-2.5 text-sm leading-relaxed"
          + " rounded-[16px_16px_16px_4px]"
      }
    >
      {content}
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

export function MessageBubble({ message, currentUserId }) {
  const isOwn = message.sender_id === currentUserId
  const type  = message.type ?? "text"

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="flex flex-col gap-1 max-w-[75%]">

        {type === "voice" && (
          <VoiceBubble src={message.media_url} isOwn={isOwn} />
        )}
        {type === "image" && (
          <ImageBubble src={message.media_url} isOwn={isOwn} />
        )}
        {type === "location" && (
          <LocationBubble
            lat={message.location_lat}
            lng={message.location_lng}
            isOwn={isOwn}
          />
        )}
        {type === "text" && (
          <TextBubble content={message.content} isOwn={isOwn} />
        )}

        <span
          className={`text-[11px] text-gray-400 px-1 ${isOwn ? "text-right" : "text-left"}`}
        >
          {TIME_FORMAT.format(new Date(message.created_at))}
        </span>
      </div>
    </div>
  )
}
