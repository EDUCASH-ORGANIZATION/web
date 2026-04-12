"use client"

import { useEffect } from "react"
import { X, SendHorizonal } from "lucide-react"

/**
 * Affiche une preview de l'image sélectionnée avant l'envoi.
 *
 * @param {{
 *   file: File,
 *   previewUrl: string,
 *   isUploading: boolean,
 *   onConfirm: () => void,
 *   onCancel:  () => void,
 * }} props
 */
export function ImagePreviewModal({ file, previewUrl, isUploading, onConfirm, onCancel }) {
  // Ferme avec Echap
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  const sizeMb = (file.size / 1024 / 1024).toFixed(1)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Fond */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panneau */}
      <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-sm font-black text-gray-900">Envoyer cette image ?</p>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors touch-manipulation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center bg-gray-50 py-4 px-5" style={{ minHeight: "220px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Aperçu"
            className="max-h-64 max-w-full object-contain rounded-xl shadow-sm"
          />
        </div>

        {/* Meta fichier */}
        <div className="px-5 py-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">{file.name}</p>
            <p className="text-[11px] text-gray-400">{sizeMb} Mo</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 touch-manipulation"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUploading}
            className="flex-1 py-3 rounded-xl bg-[#1A6B4A] text-white text-sm font-bold hover:bg-[#155a3d] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 touch-manipulation"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Envoi…
              </span>
            ) : (
              <>
                <SendHorizonal size={15} />
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
