import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"
import { Stack } from "@/components/vitrine/stack"
import { MissionsFilters } from "@/components/vitrine/missions-filters"
import { MissionsGrid } from "@/components/vitrine/missions-grid"
import { MissionsVisual } from "@/components/vitrine/missions-visual"
import { GRADIENTS, BRAND } from "@/components/vitrine/theme"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import { ScrollToResults } from "@/components/shared/scroll-to-results"

const POPULAR_TYPES = ["Cours particuliers", "Babysitting", "Livraison", "Community Management"]

export const metadata = {
  title: "Missions disponibles — EduCash",
  description: "Trouvez des opportunités locales pour financer vos études tout en développant vos compétences au Bénin.",
}

const PAGE_SIZE = 9

export default async function MissionsPage({ searchParams }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  const sp        = (await searchParams) ?? {}
  const q         = sp.q ?? ""
  const type      = sp.type ?? ""
  const city      = sp.city ?? ""
  const urgency   = sp.urgency ?? ""
  const budgetMax = sp.budget ?? ""
  const sort      = sp.sort ?? "recent"
  const page      = Math.max(1, parseInt(sp.page ?? "1") || 1)

  let query = supabase
    .from("missions")
    .select("*", { count: "exact" })
    .eq("status", "open")

  if (q)                      query = query.ilike("title", `%${q}%`)
  if (type && type !== "all") query = query.eq("type", type)
  if (city)                   query = query.eq("city", city)
  if (urgency)                query = query.eq("urgency", urgency)
  if (budgetMax)              query = query.lte("budget", parseInt(budgetMax))

  if (sort === "budget_desc")     query = query.order("budget", { ascending: false })
  else if (sort === "budget_asc") query = query.order("budget", { ascending: true })
  else                            query = query.order("created_at", { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const [{ data: missions, count }, { count: openCount }] = await Promise.all([
    query,
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("status", "open"),
  ])

  const currentSearch = new URLSearchParams()
  if (q)                      currentSearch.set("q", q)
  if (type)                   currentSearch.set("type", type)
  if (city)                   currentSearch.set("city", city)
  if (urgency)                currentSearch.set("urgency", urgency)
  if (budgetMax)              currentSearch.set("budget", budgetMax)
  if (sort && sort !== "recent") currentSearch.set("sort", sort)

  return (
    <VitrineProvider>
      <VitrineNavbar />

      {/* Hero */}
      <Box component="section" sx={{ background: GRADIENTS.hero, borderBottom: "1px solid", borderColor: "divider",
        position: "relative", overflow: "hidden", py: { xs: 6, md: 8 } }}>
        <Container>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" }, gap: { xs: 4, md: 6 }, alignItems: "center" }}>

            {/* Texte */}
            <Stack spacing={2.5}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, alignSelf: "flex-start",
                bgcolor: "rgba(255,255,255,0.7)", border: "1px solid", borderColor: "divider", borderRadius: 999, px: 1.6, py: 0.6 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: BRAND.green }} />
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: BRAND.greenDark }}>
                  {openCount ?? 0} missions actives
                </Typography>
              </Box>

              <Typography variant="h1" sx={{ fontSize: { xs: "2.2rem", md: "3rem" }, lineHeight: 1.12 }}>
                Trouvez la mission{" "}
                <Box component="span" sx={{ background: GRADIENTS.text, WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  qui vous ressemble
                </Box>
              </Typography>

              <Typography sx={{ color: "text.secondary", maxWidth: 520, fontSize: "1.05rem", lineHeight: 1.7 }}>
                Des opportunités locales et rémunérées pour financer vos études tout en
                développant vos compétences professionnelles au Bénin.
              </Typography>

              {/* Stats */}
              <Stack direction="row" useFlexGap spacing={2.5} sx={{ alignItems: "center", flexWrap: "wrap", pt: 0.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: "1.5rem", color: "text.primary", lineHeight: 1 }}>{openCount ?? 0}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>Missions ouvertes</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: "1.5rem", color: "text.primary", lineHeight: 1 }}>{CITIES.length}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>Villes couvertes</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: "1.5rem", color: "text.primary", lineHeight: 1 }}>{MISSION_TYPES.length}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>Catégories</Typography>
                </Box>
              </Stack>

              {/* Accès rapide */}
              <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", pt: 0.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.8rem", color: "text.disabled", fontWeight: 600, mr: 0.5 }}>Populaires :</Typography>
                {POPULAR_TYPES.map((t) => (
                  <Chip key={t} label={t} component="a" href={`/missions?type=${encodeURIComponent(t)}`} clickable
                    sx={{ bgcolor: "#fff", border: "1px solid", borderColor: "divider", fontWeight: 600,
                      "&:hover": { borderColor: BRAND.green, color: BRAND.green } }} />
                ))}
              </Stack>
            </Stack>

            {/* Visuel 3D */}
            <Box sx={{ display: { xs: "none", md: "block" }, height: { md: 320, lg: 360 }, position: "relative" }}>
              <MissionsVisual />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Scroll automatique vers les résultats */}
      <Suspense fallback={null}>
        <ScrollToResults targetId="missions-results" />
      </Suspense>

      {/* Filtres + grille */}
      <Box id="missions-results" sx={{ bgcolor: "#F8FAFB", minHeight: "60vh", scrollMarginTop: "72px" }}>
        <Container sx={{ py: { xs: 5, md: 7 } }}>
          <Stack spacing={5}>
            <Suspense fallback={null}>
                <MissionsFilters
                totalCount={count ?? 0}
                initialQ={q}
                initialType={type}
                initialCity={city}
                initialUrgency={urgency}
                initialBudget={budgetMax}
                initialSort={sort}
              />
            </Suspense>

            <MissionsGrid
              missions={missions ?? []}
              totalCount={count ?? 0}
              page={page}
              isLoggedIn={isLoggedIn}
              searchString={currentSearch.toString()}
            />
          </Stack>
        </Container>
      </Box>

      <VitrineFooter />
    </VitrineProvider>
  )
}
