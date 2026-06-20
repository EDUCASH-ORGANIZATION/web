"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import Typography from "@mui/material/Typography"
import LinearProgress from "@mui/material/LinearProgress"
import CircularProgress from "@mui/material/CircularProgress"
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded"
import { Stack } from "@/components/vitrine/stack"
import { useToast } from "@/components/shared/toaster"
import { useSupabase } from "@/components/shared/supabase-provider"
import { CITIES, MISSION_TYPES } from "@/lib/supabase/database.constants"
import { getUniversities } from "@/lib/actions/university.actions"
import { CardUploadZone } from "@/components/auth/card-upload-zone"
import { BRAND } from "@/components/vitrine/theme"

const STUDY_LEVELS = [
  "Licence 1", "Licence 2", "Licence 3",
  "Master 1", "Master 2", "BTS", "Doctorat", "Autre",
]

// ─── Étape 1 ─────────────────────────────────────────────────────────────────

function Step1({ initial = {}, onNext }) {
  const [avatarFile, setAvatarFile] = useState(initial.avatarFile ?? null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fullName, setFullName] = useState(initial.fullName ?? "")
  const [city, setCity] = useState(initial.city ?? "")
  const [phone, setPhone] = useState(initial.phone ?? "")
  const [bio, setBio] = useState(initial.bio ?? "")
  const [error, setError] = useState("")
  const avatarInputRef = useRef(null)

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  function handleNext() {
    if (!fullName.trim()) { setError("Le nom complet est requis."); return }
    if (!city) { setError("Veuillez choisir une ville."); return }
    setError("")
    onNext({ avatarFile, fullName: fullName.trim(), city, phone: phone.trim(), bio })
  }

  return (
    <Stack spacing={2.5}>
      {/* Progression */}
      <Box>
        <LinearProgress variant="determinate" value={50} sx={{ height: 6, borderRadius: 999, mb: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Ton profil <Box component="span" sx={{ color: "text.disabled", fontWeight: 400, fontSize: "0.9rem" }}>(1/2)</Box>
        </Typography>
      </Box>

      {/* Avatar */}
      <Stack spacing={1} sx={{ alignItems: "center" }}>
        <Box component="button" type="button" onClick={() => avatarInputRef.current?.click()}
          aria-label="Choisir une photo de profil"
          sx={{ width: 96, height: 96, borderRadius: "50%", cursor: "pointer", overflow: "hidden",
            border: "2px dashed", borderColor: "divider", bgcolor: "#F8FAFB", display: "grid", placeItems: "center",
            transition: "border-color .15s ease", "&:hover": { borderColor: BRAND.green } }}>
          {previewUrl
            ? <Box component="img" src={previewUrl} alt="Aperçu avatar" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <PhotoCameraRoundedIcon sx={{ fontSize: 28, color: "text.disabled" }} />}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>Photo de profil (optionnel)</Typography>
        <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
      </Stack>

      <TextField label="Nom complet" required value={fullName} onChange={(e) => setFullName(e.target.value)}
        placeholder="Ex : Kokou Mensah" fullWidth />

      <TextField select label="Ville" required value={city} onChange={(e) => setCity(e.target.value)} fullWidth
        slotProps={{ select: { displayEmpty: true } }}>
        <MenuItem value="">Sélectionner une ville</MenuItem>
        {CITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>

      <TextField label="Téléphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="+229 XX XX XX XX" fullWidth />

      <TextField label="Bio courte" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))}
        placeholder="Dis quelques mots sur toi..." fullWidth multiline minRows={3}
        helperText={`${bio.length}/200`} slotProps={{ formHelperText: { sx: { textAlign: "right", mr: 0 } } }} />

      {error && <Alert severity="error" sx={{ borderRadius: 2.5 }}>{error}</Alert>}

      <Button variant="contained" size="large" fullWidth onClick={handleNext}>Suivant →</Button>
    </Stack>
  )
}

// ─── Étape 2 ─────────────────────────────────────────────────────────────────

function Step2({ step1Data, onBack }) {
  const router = useRouter()
  const { toast } = useToast()
  const { supabase } = useSupabase()

  const [universities, setUniversities] = useState([])
  const [selectedSchool, setSelectedSchool] = useState("")
  const [customSchool, setCustomSchool] = useState("")
  const [level, setLevel] = useState("")
  const [availability, setAvailability] = useState("")
  const [skills, setSkills] = useState([])
  const [cardFile, setCardFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Charge les universités depuis Supabase au montage
  useEffect(() => {
    getUniversities().then((data) => setUniversities(data))
  }, [])

  function toggleSkill(skill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  // Valeur finale du champ school
  function resolveSchool() {
    if (selectedSchool === "__other__") return customSchool.trim() || null
    return selectedSchool || null
  }

  async function handleSubmit() {
    if (skills.length === 0) { setError("Sélectionne au moins une compétence."); return }
    if (selectedSchool === "__other__" && !customSchool.trim()) {
      setError("Précise le nom de ton établissement."); return
    }
    setError("")
    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié.")
      if (user.user_metadata?.role !== "student") throw new Error("Session incorrecte. Reconnecte-toi en tant qu'étudiant.")

      let avatarUrl = null
      let cardUrl   = null

      // 1. Upload avatar
      if (step1Data.avatarFile) {
        const ext = step1Data.avatarFile.name.split(".").pop()
        const fileName = `${user.id}/avatar.${ext}`
        const { error: avatarError } = await supabase.storage
          .from("avatars")
          .upload(fileName, step1Data.avatarFile, { upsert: true })
        if (avatarError) throw avatarError
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
      }

      // 2. Upload carte étudiante
      if (cardFile) {
        const ext = cardFile.name.split(".").pop()
        const fileName = `${user.id}/card.${ext}`
        const { error: cardError } = await supabase.storage
          .from("student-cards")
          .upload(fileName, cardFile, { upsert: true })
        if (cardError) throw cardError
        const { data: urlData } = supabase.storage.from("student-cards").getPublicUrl(fileName)
        cardUrl = urlData.publicUrl
      }

      // 3. Upsert profiles (avec verification_submitted_at si carte soumise)
      const profilePayload = {
        user_id: user.id,
        full_name: step1Data.fullName,
        phone: step1Data.phone || null,
        city: step1Data.city,
        bio: step1Data.bio || null,
        avatar_url: avatarUrl,
        role: "student",
      }
      if (cardUrl) {
        profilePayload.verification_submitted_at = new Date().toISOString()
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" })
      if (profileError) throw profileError

      // 4. Upsert student_profiles
      const { error: studentError } = await supabase.from("student_profiles").upsert({
        user_id:      user.id,
        school:       resolveSchool(),
        level:        level || null,
        skills,
        card_url:     cardUrl,
        availability: availability.trim() || null,
      }, { onConflict: "user_id" })
      if (studentError) throw studentError

      // 5. Redirect + toast
      toast({ message: "Profil créé ! Vérification en cours sous 24h.", type: "success" })
      router.push("/dashboard")
    } catch (err) {
      setError(err.message ?? "Une erreur est survenue.")
      setIsSubmitting(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      {/* Progression */}
      <Box>
        <LinearProgress variant="determinate" value={100} sx={{ height: 6, borderRadius: 999, mb: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Ton profil <Box component="span" sx={{ color: "text.disabled", fontWeight: 400, fontSize: "0.9rem" }}>(2/2)</Box>
        </Typography>
      </Box>

      {/* Établissement */}
      <Box>
        <TextField select label="Établissement" value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} fullWidth
          slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Sélectionne ton établissement</MenuItem>
          {universities.map((u) => (
            <MenuItem key={u.id} value={u.name}>
              {u.name}{u.short_name ? ` (${u.short_name})` : ""}{u.city ? ` — ${u.city}` : ""}
            </MenuItem>
          ))}
          <MenuItem value="__other__">Autre établissement</MenuItem>
        </TextField>
        {selectedSchool === "__other__" && (
          <TextField value={customSchool} onChange={(e) => setCustomSchool(e.target.value)}
            placeholder="Précise le nom de ton établissement" fullWidth sx={{ mt: 1.5 }} />
        )}
      </Box>

      {/* Niveau d'études */}
      <TextField select label="Niveau d'études" value={level} onChange={(e) => setLevel(e.target.value)} fullWidth
        slotProps={{ select: { displayEmpty: true } }}>
        <MenuItem value="">Sélectionner un niveau</MenuItem>
        {STUDY_LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
      </TextField>

      {/* Compétences */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Compétences <Box component="span" sx={{ color: "error.main" }}>*</Box>{" "}
          <Box component="span" sx={{ color: "text.disabled", fontWeight: 400 }}>(au moins 1)</Box>
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {MISSION_TYPES.map((skill) => {
            const active = skills.includes(skill)
            return (
              <Chip key={skill} label={skill} clickable onClick={() => toggleSkill(skill)}
                variant={active ? "filled" : "outlined"}
                sx={active
                  ? { bgcolor: BRAND.green, color: "#fff", fontWeight: 700, "&:hover": { bgcolor: BRAND.greenDark } }
                  : { fontWeight: 600 }} />
            )
          })}
        </Box>
      </Box>

      {/* Carte étudiante */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Carte étudiante</Typography>
        <CardUploadZone file={cardFile} onFileSelect={setCardFile} />
      </Box>

      {/* Disponibilités */}
      <TextField label="Disponibilités" value={availability} onChange={(e) => setAvailability(e.target.value)}
        placeholder="Ex : Week-ends, mercredis après-midi, vacances scolaires..." fullWidth multiline minRows={2} />

      {error && <Alert severity="error" sx={{ borderRadius: 2.5 }}>{error}</Alert>}

      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" color="inherit" onClick={onBack} disabled={isSubmitting} sx={{ flexShrink: 0 }}>
          ← Retour
        </Button>
        <Button variant="contained" fullWidth onClick={handleSubmit} disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}>
          Terminer mon inscription
        </Button>
      </Stack>
    </Stack>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function StudentProfileForm() {
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState({})

  return step === 1 ? (
    <Step1
      initial={step1Data}
      onNext={(data) => {
        setStep1Data(data)
        setStep(2)
      }}
    />
  ) : (
    <Step2
      step1Data={step1Data}
      onBack={() => setStep(1)}
    />
  )
}
