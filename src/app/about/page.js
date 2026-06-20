import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { Stack } from "@/components/vitrine/stack"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Card from "@mui/material/Card"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded"
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded"
import GpsFixedRoundedIcon from "@mui/icons-material/GpsFixedRounded"
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded"
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded"
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { BRAND, GRADIENTS } from "@/components/vitrine/theme"

export const metadata = {
  title: "À propos — EduCash",
  description: "Découvrez l'histoire, la mission et les valeurs d'EduCash, la marketplace des étudiants au Bénin.",
}

const VALUES = [
  { icon: FavoriteRoundedIcon, title: "Bienveillance", description: "Chaque étudiant mérite une chance de s'autonomiser. On crée des ponts, pas des barrières." },
  { icon: ShieldRoundedIcon, title: "Confiance", description: "Profils vérifiés, paiements sécurisés. Chaque transaction est protégée de bout en bout." },
  { icon: GpsFixedRoundedIcon, title: "Impact local", description: "Nous investissons dans l'économie béninoise en créant des opportunités réelles sur le terrain." },
  { icon: TrendingUpRoundedIcon, title: "Croissance", description: "Nos étudiants ne font pas que gagner de l'argent — ils développent des compétences durables." },
]

const TEAM = [
  { initial: "B", color: BRAND.green, name: "Brandon M.", role: "Fondateur & CEO" },
  { initial: "E", color: BRAND.amber, name: "Éric D.", role: "CTO" },
  { initial: "F", color: BRAND.violet, name: "Fatoumata K.", role: "Head of Operations" },
]

const STATS = [
  { value: "+1 200", label: "Étudiants" },
  { value: "+850", label: "Missions" },
  { value: "3", label: "Villes" },
]

function MiniMission({ initial, color, title, sub, tag, tagColor, tagBg }) {
  return (
    <Card sx={{ px: 2.5, py: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: color, color: "#fff",
          display: "grid", placeItems: "center", fontWeight: 700 }}>{initial}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{sub}</Typography>
        </Box>
        <Chip label={tag} size="small" sx={{ bgcolor: tagBg, color: tagColor, fontWeight: 700 }} />
      </Stack>
    </Card>
  )
}

export default function AboutPage() {
  return (
    <VitrineProvider>
      <VitrineNavbar />

      {/* Hero */}
      <Box component="section" sx={{ background: GRADIENTS.hero, py: { xs: 8, md: 12 } }}>
        <Container>
          <Stack alignItems="center" spacing={2.5} sx={{ textAlign: "center", maxWidth: 760, mx: "auto" }}>
            <Chip label="Notre histoire" sx={{ bgcolor: BRAND.greenSoft, color: BRAND.greenDark, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem" }} />
            <Typography variant="h1" sx={{ fontSize: { xs: "2.3rem", md: "3.2rem" } }}>
              On croit en l&apos;avenir des étudiants béninois
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 620 }}>
              EduCash est né d&apos;un constat simple : des milliers d&apos;étudiants talentueux peinent
              à subvenir à leurs besoins, tandis que des particuliers et entreprises cherchent
              des prestataires fiables. Nous avons construit le pont.
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "text.secondary" }}>
              <PlaceRoundedIcon sx={{ fontSize: 18, color: BRAND.green }} />
              <Typography variant="body2">Cotonou, Bénin · Fondé en 2025</Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Mission */}
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: "#fff" }}>
        <Container>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 4, md: 7 }, alignItems: "center" }}>
            <Box>
              <Typography variant="overline" sx={{ color: BRAND.green }}>Notre mission</Typography>
              <Typography variant="h3" sx={{ fontSize: { xs: "1.6rem", md: "2rem" }, mt: 1, mb: 2 }}>
                Démocratiser l&apos;accès au travail pour les étudiants
              </Typography>
              <Typography sx={{ color: "text.secondary", lineHeight: 1.7, mb: 2 }}>
                Au Bénin, plus de 60 000 étudiants sont inscrits dans les universités publiques et privées.
                Beaucoup abandonnent leurs études par manque de ressources financières.
              </Typography>
              <Typography sx={{ color: "text.secondary", lineHeight: 1.7, mb: 3 }}>
                EduCash propose une solution concrète : connecter ces étudiants à des missions
                rémunérées, adaptées à leurs disponibilités, et garantir des paiements sécurisés
                via FedaPay — la référence du paiement mobile en Afrique de l&apos;Ouest.
              </Typography>
              <Stack direction="row" spacing={3} alignItems="center" divider={<Divider orientation="vertical" flexItem />}>
                {STATS.map(({ value, label }) => (
                  <Box key={label} sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.6rem", color: BRAND.green }}>{value}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={{ background: BRAND.greenSoft, borderRadius: 5, p: { xs: 3, md: 4 } }}>
              <Stack spacing={2}>
                <MiniMission initial="K" color={BRAND.green} title="Kokou · Cours particuliers"
                  sub="Mission terminée · 15 000 FCFA" tag="Payé" tagColor={BRAND.greenDark} tagBg="#DCFCE7" />
                <MiniMission initial="M" color={BRAND.amber} title="Marie · Community Mgmt"
                  sub="En cours · 20 000 FCFA" tag="Actif" tagColor="#1D4ED8" tagBg="#DBEAFE" />
                <Typography variant="caption" sx={{ textAlign: "center", color: BRAND.green, fontWeight: 600 }}>
                  +850 missions réussies sur EduCash
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Valeurs */}
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: "#F8FAFB" }}>
        <Container>
          <Stack alignItems="center" spacing={1.5} sx={{ textAlign: "center", mb: 5 }}>
            <Typography variant="overline" sx={{ color: BRAND.green }}>Ce qu&apos;on défend</Typography>
            <Typography variant="h3" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>Nos valeurs</Typography>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
            {VALUES.map(({ icon: Icon, title, description }) => (
              <Card key={title} sx={{ p: 3, display: "flex", gap: 2.5 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: BRAND.greenSoft, color: BRAND.green,
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>{description}</Typography>
                </Box>
              </Card>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Équipe */}
      <Box component="section" sx={{ py: { xs: 8, md: 11 }, bgcolor: "#fff" }}>
        <Container>
          <Stack alignItems="center" spacing={1.5} sx={{ textAlign: "center", mb: 6 }}>
            <Typography variant="overline" sx={{ color: BRAND.green }}>L&apos;équipe</Typography>
            <Typography variant="h3" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>Les visages derrière EduCash</Typography>
          </Stack>
          <Stack direction="row" useFlexGap sx={{ justifyContent: "center", flexWrap: "wrap", gap: 5 }}>
            {TEAM.map(({ initial, color, name, role }) => (
              <Stack key={name} alignItems="center" spacing={1.5}>
                <Box sx={{ width: 84, height: 84, borderRadius: 4, bgcolor: color, color: "#fff",
                  display: "grid", placeItems: "center", fontSize: "1.8rem", fontWeight: 800,
                  boxShadow: "0 16px 32px -16px rgba(15,23,42,0.4)" }}>{initial}</Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>{role}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box component="section" sx={{ background: GRADIENTS.brand, py: { xs: 8, md: 10 } }}>
        <Container>
          <Stack alignItems="center" spacing={2.5} sx={{ textAlign: "center", maxWidth: 560, mx: "auto" }}>
            <Typography variant="h3" sx={{ color: "#fff", fontSize: { xs: "1.8rem", md: "2.2rem" } }}>Rejoins-nous</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>Construis ton avenir financier dès aujourd&apos;hui.</Typography>
            <Button href="/auth/register" size="large" endIcon={<ArrowForwardRoundedIcon />}
              sx={{ bgcolor: "#fff", color: BRAND.green, "&:hover": { bgcolor: "rgba(255,255,255,0.9)" } }}>
              Créer mon compte
            </Button>
          </Stack>
        </Container>
      </Box>

      <VitrineFooter />
    </VitrineProvider>
  )
}
