"use client"

import Link from "next/link"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import MuiLink from "@mui/material/Link"
import { Logo } from "@/components/shared/logo"
import { BRAND, GRADIENTS } from "./theme"

const FOOTER_LINKS = [
  {
    title: "Produit",
    links: [
      { label: "Comment ça marche", href: "/#how-it-works" },
      { label: "Voir les missions", href: "/missions" },
      { label: "Pour les étudiants", href: "/auth/register?role=student" },
      { label: "Pour les clients", href: "/auth/register?role=client" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Conditions d'utilisation", href: "/legal/terms" },
      { label: "Politique de confidentialité", href: "/legal/privacy" },
      { label: "Mentions légales", href: "/legal/mentions" },
    ],
  },
]

export function VitrineFooter() {
  return (
    <Box component="footer" sx={{ background: GRADIENTS.dark, color: "#fff", position: "relative", overflow: "hidden" }}>
      <Box sx={{ position: "absolute", top: -120, right: -80, width: 360, height: 360, borderRadius: "50%",
        background: `radial-gradient(circle, ${BRAND.green}55 0%, transparent 70%)`, pointerEvents: "none" }} />
      <Container sx={{ py: { xs: 6, md: 8 }, position: "relative" }}>
        <Box sx={{ display: "grid", gap: 5, gridTemplateColumns: { xs: "1fr 1fr", sm: "2fr 1fr 1fr 1fr" }, mb: 6 }}>
          <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Logo size="lg" />
              <Box component="span" sx={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                <Box component="span" sx={{ color: BRAND.greenLight }}>Edu</Box>
                <Box component="span" sx={{ color: BRAND.amber }}>Cash</Box>
              </Box>
            </Stack>
            <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.62)", maxWidth: 320, lineHeight: 1.6 }}>
              La marketplace des étudiants au Bénin. Des missions rémunérées, un paiement sécurisé.
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2.5 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: BRAND.greenLight,
                boxShadow: `0 0 0 4px ${BRAND.greenLight}33` }} />
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Service actif</Typography>
            </Stack>
          </Box>

          {FOOTER_LINKS.map(({ title, links }) => (
            <Box key={title}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.45)", display: "block", mb: 1.5 }}>
                {title}
              </Typography>
              <Stack spacing={1.2}>
                {links.map(({ label, href }) => (
                  <MuiLink
                    key={label}
                    component={Link}
                    href={href}
                    underline="none"
                    sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem",
                      transition: "color .15s", "&:hover": { color: "#fff" } }}
                  >
                    {label}
                  </MuiLink>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>

        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.1)", pt: 3,
          display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center",
          justifyContent: "space-between", gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
            © {new Date().getFullYear()} EduCash · Fait avec ❤️ au Bénin
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
            Paiement sécurisé via FedaPay · Commission 12%
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
