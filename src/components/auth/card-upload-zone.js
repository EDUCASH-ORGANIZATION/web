"use client"

import { useRef, useState } from "react"
import { Upload, FileText, AlertCircle, X, ImageIcon } from "lucide-react"
import { CARD_UPLOAD_INSTRUCTIONS } from "@/lib/supabase/database.constants"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"]
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * @param {{
 *   onFileSelect: (file: File) => void,
 *   file: File | null,
 * }} props
 */
export function CardUploadZone({ onFileSelect, file }) {
  const inputRef  = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [validationError, setValidationError] = useState("")
  const [previewUrl, setPreviewUrl] = useState(null)

  function validate(f) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return "Format non accepté. Utilise JPG, PNG ou PDF."
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Fichier trop lourd (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum : 10 MB.`
    }
    return null
  }

  function handleFile(f) {
    if (!f) return
    const err = validate(f)
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError("")
    onFileSelect(f)

    if (f.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreviewUrl(null)
    }
  }

  function handleInputChange(e) {
    handleFile(e.target.files?.[0])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleClear() {
    onFileSelect(null)
    setPreviewUrl(null)
    setValidationError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const isImage = file?.type?.startsWith("image/")
  const isPdf   = file?.type === "application/pdf"

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Zone principale */}
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={[
            "flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed px-4 py-8 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/30",
            dragging
              ? "border-[#1A6B4A] bg-[#f0faf5]"
              : "border-gray-300 hover:border-[#1A6B4A] hover:bg-gray-50",
          ].join(" ")}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#f0faf5] flex items-center justify-center">
            <Upload size={24} className="text-[#1A6B4A]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-700">Uploade ta carte étudiante</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Photo ou scan — JPG, PNG, PDF — max 10 MB
            </p>
          </div>
          <p className="text-xs text-[#1A6B4A] font-semibold">
            {dragging ? "Relâche ici" : "Clique ou glisse-dépose"}
          </p>
        </button>
      ) : (
        /* Préview */
        <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          {isImage && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Aperçu carte"
              className="w-full max-h-48 object-contain"
            />
          )}

          {isPdf && (
            <div className="flex items-center gap-3 px-4 py-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <FileText size={20} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  PDF · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* Overlay infos */}
          {isImage && (
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-2">
              <ImageIcon size={13} className="text-gray-400 shrink-0" />
              <p className="text-xs text-gray-500 truncate flex-1">{file.name}</p>
              <p className="text-xs text-gray-400 shrink-0">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {/* Bouton changer */}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
            aria-label="Supprimer"
          >
            <X size={13} className="text-gray-500" />
          </button>
        </div>
      )}

      {/* Erreur de validation */}
      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{validationError}</p>
        </div>
      )}

      {/* Bouton "Changer" quand fichier sélectionné */}
      {file && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-semibold text-[#1A6B4A] hover:underline self-start"
        >
          Changer de fichier
        </button>
      )}

      {/* Conseils */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-xs font-bold text-amber-800">Pour une vérification rapide :</p>
        </div>
        <ul className="flex flex-col gap-1">
          {CARD_UPLOAD_INSTRUCTIONS.map((tip) => (
            <li key={tip} className="flex items-start gap-1.5 text-xs text-amber-700">
              <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
