import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import MuiLink from "@mui/material/Link"
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded"
import { AuthShell } from "@/components/vitrine/auth-shell"
import { Stack } from "@/components/vitrine/stack"
import { BRAND } from "@/components/vitrine/theme"

export const metadata = { title: "Vérifiez votre email — EduCash" }

export default function VerifyEmailPage() {
  return (
    <AuthShell maxWidth={440}>
      <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box sx={{ width: 72, height: 72, borderRadius: "50%", bgcolor: BRAND.greenSoft, color: BRAND.green,
          display: "grid", placeItems: "center" }}>
          <MarkEmailReadRoundedIcon sx={{ fontSize: 36 }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800 }}>Vérifiez votre email</Typography>

        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
          Un email de confirmation vous a été envoyé. Cliquez sur le lien dans l&apos;email pour activer
          votre compte et compléter votre profil.
        </Typography>

        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          Vous n&apos;avez pas reçu d&apos;email ?{" "}
          <MuiLink href="/auth/register" sx={{ fontWeight: 700 }}>Réessayer</MuiLink>
        </Typography>
      </Stack>
    </AuthShell>
  )
}
