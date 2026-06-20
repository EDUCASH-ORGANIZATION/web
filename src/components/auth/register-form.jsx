"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import Typography from "@mui/material/Typography"
import MuiLink from "@mui/material/Link"
import CircularProgress from "@mui/material/CircularProgress"
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded"
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded"
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded"
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded"
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import CancelRoundedIcon from "@mui/icons-material/CancelRounded"
import { Stack } from "@/components/vitrine/stack"
import { register as registerAction } from "@/lib/actions/auth.actions"
import { BRAND } from "@/components/vitrine/theme"

const ROLE_OPTIONS = [
  { value: "student", label: "Je suis étudiant", description: "Je cherche des missions rémunérées", icon: SchoolRoundedIcon },
  { value: "client", label: "Je cherche un prestataire", description: "Je publie des missions ponctuelles", icon: BusinessCenterRoundedIcon },
]

const PASSWORD_RULES = [
  { key: "length", label: "Au moins 8 caractères", test: (v) => v.length >= 8 },
  { key: "uppercase", label: "Une majuscule (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { key: "lowercase", label: "Une minuscule (a-z)", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "Un chiffre (0-9)", test: (v) => /[0-9]/.test(v) },
  { key: "special", label: "Un caractère spécial (!@#$...)", test: (v) => /[^A-Za-z0-9]/.test(v) },
]

function PasswordRules({ value }) {
  return (
    <Box sx={{ mt: 1.2, display: "flex", flexDirection: "column", gap: 0.6 }}>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary" }}>
        Votre mot de passe doit contenir :
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {PASSWORD_RULES.map((rule) => {
          const valid = value ? rule.test(value) : false
          return (
            <Box key={rule.key} sx={{ display: "flex", alignItems: "center", gap: 0.5,
              fontSize: "0.75rem", color: valid ? BRAND.green : "text.secondary" }}>
              {valid ? <CheckCircleRoundedIcon sx={{ fontSize: 14, color: BRAND.green }} />
                : <CancelRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
              <Typography component="span" sx={{ fontSize: "0.75rem" }}>{rule.label}</Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function RoleCard({ selected, onClick, icon: Icon, label, description }) {
  return (
    <Box component="button" type="button" onClick={onClick}
      sx={{
        textAlign: "left", cursor: "pointer", width: "100%", borderRadius: 1, p: 2,
        display: "flex", flexDirection: "row", alignItems: "center", gap: 1.5, transition: "all .15s ease",
        border: "1.5px solid", borderColor: selected ? BRAND.green : "rgba(15,23,42,0.12)",
        bgcolor: selected ? BRAND.greenSoft : "#fff",
        boxShadow: selected ? "0 4px 12px -4px rgba(26,107,74,0.2)" : "none",
        "&:hover": { borderColor: selected ? BRAND.green : BRAND.greenLight, bgcolor: selected ? BRAND.greenSoft : "rgba(26,107,74,0.02)" },
      }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center",
        bgcolor: selected ? BRAND.green : "rgba(15,23,42,0.04)", color: selected ? "#fff" : "text.secondary",
        transition: "all .15s ease" }}>
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: selected ? BRAND.greenDark : "text.primary", lineHeight: 1.25 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", mt: 0.2, lineHeight: 1.4 }}>{description}</Typography>
      </Box>
    </Box>
  )
}

export function RegisterForm({ defaultRole = null }) {
  const [role, setRole] = useState(defaultRole)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onChange" })

  const password = watch("password")

  // Adapte react-hook-form aux champs MUI (ref → inputRef)
  const rhf = (name, rules) => {
    const { ref, ...rest } = register(name, rules)
    return { inputRef: ref, ...rest }
  }

  async function onSubmit(values) {
    setServerError(null)

    const formData = new FormData()
    formData.set("email", values.email)
    formData.set("password", values.password)
    formData.set("confirmPassword", values.confirmPassword)
    formData.set("role", role)

    const result = await registerAction(formData)

    if (result?.error) {
      setServerError(result.error)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate suppressHydrationWarning>
      <Stack spacing={2.5}>
        {/* Sélection du rôle */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          {ROLE_OPTIONS.map((opt) => (
            <RoleCard key={opt.value} {...opt} selected={role === opt.value} onClick={() => setRole(opt.value)} />
          ))}
        </Box>

        {/* Email */}
        <TextField
          {...rhf("email", {
            required: "L'adresse email est requise.",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "L'adresse email n'est pas valide." },
          })}
          label="Adresse email"
          type="email"
          placeholder="toi@example.com"
          fullWidth
          error={!!errors.email}
          helperText={errors.email?.message}
        />

        {/* Mot de passe */}
        <Box>
          <TextField
            {...rhf("password", {
              required: "Le mot de passe est requis.",
              validate: (value) => {
                const allValid = PASSWORD_RULES.every((rule) => rule.test(value))
                return allValid || "Le mot de passe ne respecte pas toutes les règles de sécurité."
              },
            })}
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            placeholder="Min. 8 caractères, majuscule, minuscule, chiffre, symbole"
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            slotProps={{ input: { endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" aria-label={showPassword ? "Masquer" : "Afficher"}>
                  {showPassword ? <VisibilityOffRoundedIcon sx={{ fontSize: 19 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 19 }} />}
                </IconButton>
              </InputAdornment>
            ) } }}
          />
          <PasswordRules value={password} />
        </Box>

        {/* Confirmer */}
        <TextField
          {...rhf("confirmPassword", {
            required: "Veuillez confirmer ton mot de passe.",
            validate: (value) => value === password || "Les mots de passe ne correspondent pas.",
          })}
          label="Confirmer le mot de passe"
          type={showConfirm ? "text" : "password"}
          placeholder="Répète ton mot de passe"
          fullWidth
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          slotProps={{ input: { endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end" aria-label={showConfirm ? "Masquer" : "Afficher"}>
                {showConfirm ? <VisibilityOffRoundedIcon sx={{ fontSize: 19 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 19 }} />}
              </IconButton>
            </InputAdornment>
          ) } }}
        />

        {/* Erreur serveur */}
        {serverError && (
          <Alert severity="error" sx={{ borderRadius: 1, fontSize: "0.875rem", alignItems: "center" }}>
            {serverError}
          </Alert>
        )}

        <Button type="submit" variant="contained" size="large" fullWidth disabled={!role || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}>
          Créer mon compte
        </Button>

        <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary" }}>
          Déjà inscrit ?{" "}
          <MuiLink component={Link} href="/auth/login" sx={{ fontWeight: 700 }}>Se connecter</MuiLink>
        </Typography>
      </Stack>
    </Box>
  )
}
