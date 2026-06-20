import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "@/components/vitrine/stack"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Card from "@mui/material/Card"
import EmailRoundedIcon from "@mui/icons-material/EmailRounded"
import WhatsAppIcon from "@mui/icons-material/WhatsApp"
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded"
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { ContactForm } from "@/components/vitrine/contact-form"
import { BRAND, GRADIENTS } from "@/components/vitrine/theme"

export const metadata = {
  title: "Contact — EduCash",
  description: "Contactez l'équipe EduCash pour toute question ou suggestion.",
}

const CONTACT_INFO = [
  { icon: EmailRoundedIcon, label: "Email", value: "contact@educash.bj", desc: "Réponse sous 24h ouvrées" },
  { icon: WhatsAppIcon, label: "WhatsApp", value: "+229 XX XX XX XX", desc: "Lun–Ven, 8h–18h" },
  { icon: PlaceRoundedIcon, label: "Adresse", value: "Cotonou, Bénin", desc: "Haie Vive, Cotonou" },
  { icon: AccessTimeRoundedIcon, label: "Disponibilité", value: "Lun–Sam", desc: "8h – 20h (WAT)" },
]

const FAQ = [
  "Comment vérifier mon profil étudiant ?",
  "Quels sont les délais de paiement ?",
  "Comment signaler un problème avec une mission ?",
]

export default function ContactPage() {
  return (
    <VitrineProvider>
      <VitrineNavbar />

      {/* Hero */}
      <Box component="section" sx={{ background: GRADIENTS.hero, py: { xs: 7, md: 10 } }}>
        <Container>
          <Stack alignItems="center" spacing={2} sx={{ textAlign: "center", maxWidth: 620, mx: "auto" }}>
            <Chip label="On vous répond" sx={{ bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem" }} />
            <Typography variant="h1" sx={{ fontSize: { xs: "2.3rem", md: "3rem" } }}>Contactez-nous</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 460 }}>
              Une question, un problème, une suggestion ? L&apos;équipe EduCash est là pour vous.
              Écrivez-nous, on répond rapidement.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Content */}
      <Box component="section" sx={{ py: { xs: 7, md: 11 }, bgcolor: "#fff" }}>
        <Container>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 4, md: 6 } }}>
            {/* Infos */}
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" sx={{ mb: 1 }}>Informations de contact</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Plusieurs façons de nous joindre, choisissez celle qui vous convient.
                </Typography>
              </Box>
              <Stack spacing={2}>
                {CONTACT_INFO.map(({ icon: Icon, label, value, desc }) => (
                  <Stack key={label} direction="row" alignItems="center" spacing={2}
                    sx={{ bgcolor: "#F8FAFB", borderRadius: 3, px: 2.5, py: 2 }}>
                    <Box sx={{ width: 46, height: 46, borderRadius: 2.5, bgcolor: BRAND.greenSoft, color: BRAND.green,
                      display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon />
                    </Box>
                    <Box>
                      <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1.2, display: "block" }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{value}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{desc}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>

              <Box sx={{ bgcolor: BRAND.greenSoft, borderRadius: 3, px: 3, py: 2.5, border: "1px solid", borderColor: "rgba(26,107,74,0.12)" }}>
                <Typography sx={{ fontWeight: 700, color: BRAND.green, mb: 1.5 }}>Questions fréquentes</Typography>
                {FAQ.map((q, i) => (
                  <Typography key={q} variant="body2" sx={{ color: "text.secondary", py: 1,
                    borderBottom: i < FAQ.length - 1 ? "1px solid rgba(26,107,74,0.1)" : "none" }}>
                    → {q}
                  </Typography>
                ))}
              </Box>
            </Stack>

            {/* Formulaire */}
            <Card sx={{ p: { xs: 3, md: 4 }, boxShadow: "0 24px 56px -28px rgba(15,23,42,0.25)" }}>
              <Typography variant="h6" sx={{ mb: 3 }}>Envoyer un message</Typography>
              <ContactForm />
            </Card>
          </Box>
        </Container>
      </Box>

      <VitrineFooter />
    </VitrineProvider>
  )
}
