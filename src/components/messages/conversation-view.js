"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  SendHorizonal, Loader2, ChevronLeft, CreditCard,
  Mic, Image as ImageIcon, MapPin, X, Square,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MessageBubble } from "@/components/messages/message-bubble"
import { ImagePreviewModal } from "@/components/messages/image-preview-modal"
import { LocationPickerModal } from "@/components/messages/location-picker-modal"
import { VerifiedAvatar } from "@/components/shared/verified-avatar"
import { useToast } from "@/components/shared/toaster"

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtRecordingTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function formatDayLabel(iso) {
  const date = new Date(iso)
  const now  = new Date()
  const isToday     = date.toDateString() === now.toDateString()
  const yesterday   = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  if (isToday)     return "Aujourd'hui"
  if (isYesterday) return "Hier"
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  }).format(date)
}

// ─── ConversationView ─────────────────────────────────────────────────────────

export function ConversationView({
  initialMessages,
  missionId,
  currentUserId,
  interlocuteur,
  missionTitle,
  missionStatus,
  userRole,
}) {
  const router      = useRouter()
  const supabase    = useRef(createClient()).current
  const { toast }   = useToast()

  const [messages,         setMessages]         = useState(initialMessages)
  const [newMessage,       setNewMessage]       = useState("")
  const [isSending,        setIsSending]        = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  // Image preview
  const [pendingImage,    setPendingImage]    = useState(null)  // { file, previewUrl }

  // Location picker
  const [showLocPicker,   setShowLocPicker]   = useState(false)

  // Voice recording
  const [isRecording,    setIsRecording]    = useState(false)
  const [recordingTime,  setRecordingTime]  = useState(0)
  const mediaRecorderRef  = useRef(null)
  const audioChunksRef    = useRef([])
  const recordingTimerRef = useRef(null)

  // Refs UI
  const bottomRef    = useRef(null)
  const channelRef   = useRef(null)
  const textareaRef  = useRef(null)
  const imageInputRef = useRef(null)

  // ── Scroll bas ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    channelRef.current = supabase
      .channel(`conv:${missionId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
        filter: `mission_id=eq.${missionId}`,
      }, (payload) => {
        setMessages((prev) =>
          prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelRef.current)
      clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop()
      }
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
      // Libère l'URL blob de preview si elle existe encore
      if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    }
  }, [missionId, supabase])

  // ── Marque comme lu ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("messages")
      .update({ read: true })
      .eq("mission_id", missionId)
      .eq("receiver_id", currentUserId)
      .eq("read", false)
      .then(() => {})
  }, [missionId, currentUserId, supabase])

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function handleTextareaChange(e) {
    setNewMessage(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 120) + "px"
    }
  }

  // ── Upload storage helper ─────────────────────────────────────────────────
  async function uploadToStorage(blob, ext) {
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from("message-media").upload(path, blob)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from("message-media").getPublicUrl(path)
    return publicUrl
  }

  // ── Envoi d'un message (toute sorte) ─────────────────────────────────────
  async function sendMediaMessage({ type, mediaUrl, locationLat, locationLng, content }) {
    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        mission_id:   missionId,
        sender_id:    currentUserId,
        receiver_id:  interlocuteur.user_id,
        content,
        type,
        media_url:    mediaUrl    ?? null,
        location_lat: locationLat ?? null,
        location_lng: locationLng ?? null,
        read: false,
      })
      .select()
      .single()

    if (inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      )
    }
  }

  // ── Texte ─────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const content = newMessage.trim()
    if (!content || isSending) return
    setIsSending(true)

    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        mission_id:  missionId,
        sender_id:   currentUserId,
        receiver_id: interlocuteur.user_id,
        content,
        type: "text",
        read: false,
      })
      .select()
      .single()

    if (inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      )
    }

    setNewMessage("")
    setIsSending(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Note vocale ───────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(100)
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 119) { stopAndSendRecording(); return t }
          return t + 1
        })
      }, 1000)
    } catch {
      toast({ message: "Impossible d'accéder au microphone. Vérifiez les autorisations.", type: "error" })
    }
  }

  function cancelRecording() {
    clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null
    audioChunksRef.current   = []
    setIsRecording(false)
    setRecordingTime(0)
  }

  async function stopAndSendRecording() {
    if (!mediaRecorderRef.current) return
    clearInterval(recordingTimerRef.current)
    setIsRecording(false)

    // Attend que MediaRecorder ait fini de flusher les données
    await new Promise((resolve) => {
      mediaRecorderRef.current.onstop = resolve
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      } else {
        resolve()
      }
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop())
    })

    if (audioChunksRef.current.length === 0) {
      toast({ message: "Enregistrement vide, veuillez réessayer.", type: "error" })
      mediaRecorderRef.current = null
      return
    }

    setIsUploadingMedia(true)
    try {
      const blob      = new Blob(audioChunksRef.current, { type: "audio/webm" })
      const publicUrl = await uploadToStorage(blob, "webm")
      await sendMediaMessage({ type: "voice", mediaUrl: publicUrl, content: "🎵 Note vocale" })
    } catch {
      toast({ message: "Erreur lors de l'envoi de la note vocale.", type: "error" })
    } finally {
      setIsUploadingMedia(false)
      audioChunksRef.current   = []
      mediaRecorderRef.current = null
    }
  }

  // ── Image : affiche la preview, ne uploade pas encore ───────────────────
  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (file.size > 10 * 1024 * 1024) {
      toast({ message: "L'image ne doit pas dépasser 10 Mo.", type: "error" })
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setPendingImage({ file, previewUrl })
  }

  // Confirme l'envoi de l'image depuis le modal preview
  async function confirmSendImage() {
    if (!pendingImage) return
    setIsUploadingMedia(true)
    try {
      const ext       = pendingImage.file.name.split(".").pop() || "jpg"
      const publicUrl = await uploadToStorage(pendingImage.file, ext)
      await sendMediaMessage({ type: "image", mediaUrl: publicUrl, content: "🖼️ Image" })
      URL.revokeObjectURL(pendingImage.previewUrl)
      setPendingImage(null)
    } catch {
      toast({ message: "Erreur lors de l'envoi de l'image.", type: "error" })
    } finally {
      setIsUploadingMedia(false)
    }
  }

  function cancelSendImage() {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  // ── Localisation : confirmation depuis le picker ──────────────────────────
  async function handleLocationConfirm(lat, lng) {
    setShowLocPicker(false)
    setIsUploadingMedia(true)
    try {
      await sendMediaMessage({
        type:        "location",
        locationLat: lat,
        locationLng: lng,
        content:     "📍 Localisation partagée",
      })
    } catch {
      toast({ message: "Erreur lors de l'envoi de la localisation.", type: "error" })
    } finally {
      setIsUploadingMedia(false)
    }
  }

  // ── Helpers affichage ─────────────────────────────────────────────────────
  const backHref  = userRole === "client" ? "/client/messages" : "/messages"
  const payHref   = `/client/payment/${missionId}`

  const interlocuteurIsVerified    = interlocuteur?.is_verified    ?? false
  const interlocuteurVerifiedUntil = interlocuteur?.verified_until ?? null

  function getDateLabel(msg, idx) {
    if (idx === 0) return formatDayLabel(msg.created_at)
    const d1 = new Date(msg.created_at).toDateString()
    const d2 = new Date(messages[idx - 1].created_at).toDateString()
    return d1 !== d2 ? formatDayLabel(msg.created_at) : null
  }

  const isBusy = isSending || isUploadingMedia

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors touch-manipulation"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>

        <VerifiedAvatar
          avatarUrl={interlocuteur?.avatar_url ?? null}
          fullName={interlocuteur?.full_name ?? ""}
          isVerified={interlocuteurIsVerified}
          verifiedUntil={interlocuteurVerifiedUntil}
          size="sm"
          showBadge
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {interlocuteur?.full_name ?? "Interlocuteur"}
          </p>
          <p className="text-xs text-gray-500 truncate">{missionTitle}</p>
        </div>
      </header>

      {/* ── Barre paiement (client, mission en cours) ───────────────────── */}
      {missionStatus === "in_progress" && userRole === "client" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800">
            Mission en cours. Confirmez la fin pour procéder au paiement.
          </p>
          <button
            type="button"
            onClick={() => router.push(payHref)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors touch-manipulation"
          >
            <CreditCard size={12} />
            Confirmer et payer →
          </button>
        </div>
      )}

      {/* ── Zone messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 text-center px-8">
              Aucun message pour l&apos;instant. Démarrez la conversation !
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const dayLabel = getDateLabel(msg, idx)
            return (
              <div key={msg.id}>
                {dayLabel && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">
                      {dayLabel}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <MessageBubble message={msg} currentUserId={currentUserId} />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone saisie ─────────────────────────────────────────────────── */}
      {isRecording ? (
        /* ── État enregistrement ──────────────────────────────────────── */
        <div className="border-t border-gray-100 bg-white px-3 py-3 flex items-center gap-3">
          {/* Annuler */}
          <button
            type="button"
            onClick={cancelRecording}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors touch-manipulation shrink-0"
            aria-label="Annuler"
          >
            <X size={18} />
          </button>

          {/* Indicateur + timer */}
          <div className="flex-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-mono font-bold text-red-500 tabular-nums">
              {fmtRecordingTime(recordingTime)}
            </span>
            <span className="text-xs text-gray-400 truncate">Enregistrement…</span>
          </div>

          {/* Envoyer */}
          <button
            type="button"
            onClick={stopAndSendRecording}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1A6B4A] text-white text-xs font-bold hover:bg-[#155a3d] transition-colors touch-manipulation shrink-0"
          >
            <Square size={12} className="fill-white" />
            Envoyer
          </button>
        </div>
      ) : (
        /* ── État normal ─────────────────────────────────────────────── */
        <div className="border-t border-gray-100 bg-white px-3 py-2.5 flex items-end gap-2">

          {/* Input image caché */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Boutons médias (à gauche) */}
          <div className="flex items-center gap-1 pb-1 shrink-0">
            {/* Image */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isBusy}
              title="Envoyer une image"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1A6B4A] transition-colors disabled:opacity-40 touch-manipulation"
            >
              {isUploadingMedia
                ? <Loader2 size={17} className="animate-spin text-[#1A6B4A]" />
                : <ImageIcon size={17} />
              }
            </button>

            {/* Micro */}
            <button
              type="button"
              onClick={startRecording}
              disabled={isBusy}
              title="Note vocale"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1A6B4A] transition-colors disabled:opacity-40 touch-manipulation"
            >
              <Mic size={17} />
            </button>

            {/* Localisation */}
            <button
              type="button"
              onClick={() => setShowLocPicker(true)}
              disabled={isBusy}
              title="Partager une localisation"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1A6B4A] transition-colors disabled:opacity-40 touch-manipulation"
            >
              {isUploadingMedia
                ? null
                : <MapPin size={17} />
              }
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Écris un message…"
            rows={1}
            disabled={isBusy}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A6B4A]/40 focus:border-[#1A6B4A] disabled:opacity-60 overflow-hidden leading-relaxed transition-colors"
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />

          {/* Envoyer */}
          <button
            type="button"
            onClick={sendMessage}
            disabled={!newMessage.trim() || isBusy}
            className="w-10 h-10 rounded-xl bg-[#1A6B4A] text-white flex items-center justify-center hover:bg-[#155a3d] active:bg-[#104530] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 touch-manipulation"
            aria-label="Envoyer"
          >
            {isSending
              ? <Loader2 size={16} className="animate-spin" />
              : <SendHorizonal size={16} />
            }
          </button>
        </div>
      )}
    </div>

      {/* ── Modal preview image ─────────────────────────────────────────── */}
      {pendingImage && (
        <ImagePreviewModal
          file={pendingImage.file}
          previewUrl={pendingImage.previewUrl}
          isUploading={isUploadingMedia}
          onConfirm={confirmSendImage}
          onCancel={cancelSendImage}
        />
      )}

      {/* ── Modal localisation ──────────────────────────────────────────── */}
      {showLocPicker && (
        <LocationPickerModal
          onConfirm={handleLocationConfirm}
          onClose={() => setShowLocPicker(false)}
        />
      )}
    </>
  )
}
