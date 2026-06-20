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
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded"
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded"
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded"
import { Stack } from "@/components/vitrine/stack"
import { login } from "@/lib/actions/auth.actions"
import { useToast } from "@/components/shared/toaster"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

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

    const result = await login(formData)

    // Si login() redirige, ce code n'est jamais atteint.
    // On arrive ici uniquement en cas d'erreur retournée.
    if (result?.error) {
      setServerError(result.error)
    }
  }

  function handleForgotPassword() {
    toast({ message: "La réinitialisation de mot de passe arrive bientôt.", type: "info" })
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate suppressHydrationWarning>
      <Stack spacing={2.5}>
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
          slotProps={{ input: { startAdornment: (
            <InputAdornment position="start"><MailOutlineRoundedIcon sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>
          ) } }}
        />

        {/* Mot de passe */}
        <Box>
          <TextField
            {...rhf("password", {
              required: "Le mot de passe est requis.",
              minLength: { value: 8, message: "Le mot de passe doit contenir au moins 8 caractères." },
            })}
            label="Mot de passe"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            slotProps={{ input: { endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showPassword ? <VisibilityOffRoundedIcon sx={{ fontSize: 19 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 19 }} />}
                </IconButton>
              </InputAdornment>
            ) } }}
          />
          <Box sx={{ textAlign: "right", mt: 0.5 }}>
            <MuiLink component="button" type="button" onClick={handleForgotPassword} underline="hover"
              sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
              Mot de passe oublié ?
            </MuiLink>
          </Box>
        </Box>

        {/* Erreur serveur */}
        {serverError && (
          <Alert severity="error" sx={{ borderRadius: 1, fontSize: "0.875rem", alignItems: "center" }}>
            {serverError}
          </Alert>
        )}

        {/* Submit */}
        <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}>
          Se connecter
        </Button>

        {/* Lien inscription */}
        <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary" }}>
          Pas encore inscrit ?{" "}
          <MuiLink component={Link} href="/auth/register" sx={{ fontWeight: 700 }}>S&apos;inscrire</MuiLink>
        </Typography>
      </Stack>
    </Box>
  )
}
