"use client"

import { useState } from "react"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Card from "@mui/material/Card"
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded"
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded"
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded"
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded"
import { BRAND, GRADIENTS } from "./theme"

const STUDENT_STEPS = [
  { icon: AccountCircleRoundedIcon, title: "Crée ton profil", description: "Renseigne tes compétences, ta disponibilité et uploade ta carte étudiante pour être vérifié sous 24h." },
  { icon: SearchRoundedIcon, title: "Postule aux missions", description: "Parcours les offres publiées par des clients près de chez toi et postule en un clic selon ton tarif." },
  { icon: AccountBalanceWalletRoundedIcon, title: "Reçois ton paiement", description: "Une fois la mission validée, l'argent est disponible instantanément sur ton compte EduCash." },
]

const CLIENT_STEPS = [
  { icon: GroupAddRoundedIcon, title: "Crée ton compte", description: "Inscris-toi en 2 minutes. Particulier, entreprise ou association — on a tout prévu." },
  { icon: DescriptionRoundedIcon, title: "Décris ton besoin", description: "Publie une mission avec le budget, la ville et le type de prestation. Reçois des candidatures rapidement." },
  { icon: CreditCardRoundedIcon, title: "Paye en sécurité", description: "Règle via FedaPay. Le paiement est libéré uniquement quand vous validez ensemble la mission." },
]

function StepCard({ step, index }) {
  const Icon = step.icon
  return (
    <Card sx={{ p: 3.5, height: "100%", position: "relative", overflow: "hidden",
      transition: "transform .2s ease, box-shadow .2s ease",
      "&:hover": { transform: "translateY(-6px)", boxShadow: "0 24px 48px -20px rgba(15,23,42,0.25)" } }}>
      <Typography sx={{ position: "absolute", top: 10, right: 18, fontWeight: 900, fontSize: "3.4rem",
        lineHeight: 1, color: BRAND.greenSoft, userSelect: "none" }}>
        0{index + 1}
      </Typography>
      <Box sx={{ width: 56, height: 56, borderRadius: 3, display: "grid", placeItems: "center",
        background: GRADIENTS.brand, color: "#fff", mb: 2.5,
        boxShadow: "0 12px 24px -10px rgba(26,107,74,0.5)" }}>
        <Icon sx={{ fontSize: 28 }} />
      </Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{step.title}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.65 }}>{step.description}</Typography>
    </Card>
  )
}

export function HowItWorks() {
  const [tab, setTab] = useState(0)
  const steps = tab === 0 ? STUDENT_STEPS : CLIENT_STEPS

  return (
    <Box component="section" id="how-it-works" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff" }}>
      <Container>
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", mb: 6 }}>
          <Chip label="Simple & Rapide" sx={{ bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem", maxWidth: "fit-content" }} />
          <Typography variant="h2" sx={{ fontSize: { xs: "2rem", md: "2.6rem" } }}>Comment ça marche ?</Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 520 }}>
            En quelques étapes seulement, commencez à gagner de l&apos;argent ou trouvez le bon profil.
          </Typography>
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "center", mb: 6 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              bgcolor: "rgba(15,23,42,0.04)", borderRadius: 999, p: 0.6, minHeight: 0,
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTab-root": { minHeight: 0, py: 1.2, px: 3, borderRadius: 999, fontWeight: 700,
                color: "text.secondary", textTransform: "none", transition: "all .2s",
                "&.Mui-selected": { bgcolor: "#fff", color: "primary.main", boxShadow: "0 4px 14px -6px rgba(15,23,42,0.2)" } },
            }}
          >
            <Tab value={0} label="Pour l'étudiant" />
            <Tab value={1} label="Pour le client" />
          </Tabs>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
          {steps.map((step, i) => <StepCard key={step.title} step={step} index={i} />)}
        </Box>
      </Container>
    </Box>
  )
}
