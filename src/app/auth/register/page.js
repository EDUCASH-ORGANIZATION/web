import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/vitrine/auth-shell"

export const metadata = {
  title: "Inscription — EduCash",
}

const ERROR_MESSAGES = {
  lien_invalide_ou_expire: "Le lien de confirmation a expiré ou est invalide. Réinscris-toi.",
  access_denied:           "Accès refusé. Le lien a peut-être déjà été utilisé.",
}

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams
  const errorKey = params?.error
  const defaultRole = params?.role === "student" || params?.role === "client" ? params.role : null
  const errorMessage = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? "Une erreur est survenue. Réessaie.")
    : null

  return (
    <AuthShell title="Rejoindre EduCash" subtitle="Choisis ton profil pour commencer" maxWidth={520}>
      {errorMessage && (
        <Box sx={{ mb: 2.5 }}>
          <Alert severity="error" sx={{ borderRadius: 2.5 }}>{errorMessage}</Alert>
        </Box>
      )}
      <RegisterForm defaultRole={defaultRole} />
    </AuthShell>
  )
}
