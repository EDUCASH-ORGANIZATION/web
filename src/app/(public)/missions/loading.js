import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import { VitrineProvider } from "@/components/vitrine/vitrine-provider"
import { VitrineNavbar } from "@/components/vitrine/vitrine-navbar"
import { VitrineFooter } from "@/components/vitrine/vitrine-footer"

function Bone({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <Box sx={{
      width, height, borderRadius: `${radius}px`,
      bgcolor: "rgba(0,0,0,0.07)", flexShrink: 0, ...style
    }} />
  )
}

export default function MissionsPublicLoading() {
  return (
    <VitrineProvider>
      <VitrineNavbar />

      {/* Hero skeleton */}
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", py: { xs: 6, md: 8 },
        background: "linear-gradient(135deg,#f0faf5 0%,#e8f5ee 100%)" }}>
        <Container>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 560,
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.5 } } }}>
            <Bone width={140} height={28} radius={20} />
            <Bone width="80%" height={48} radius={12} />
            <Bone width="70%" height={48} radius={12} />
            <Bone width="60%" height={20} radius={8} />
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {[80, 120, 100, 90].map((w, i) => <Bone key={i} width={w} height={32} radius={20} />)}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Filtres + grille skeleton */}
      <Box sx={{ bgcolor: "#F8FAFB", minHeight: "60vh" }}>
        <Container sx={{ py: { xs: 5, md: 7 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.5 } } }}>

            {/* Search bar */}
            <Bone height={48} radius={12} />

            {/* Chips type */}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {[70, 110, 90, 130, 80, 120, 100].map((w, i) => (
                <Bone key={i} width={w} height={32} radius={20} />
              ))}
            </Box>

            {/* Filtres secondaires */}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {[160, 160, 160, 200].map((w, i) => <Bone key={i} width={w} height={40} radius={10} />)}
            </Box>

            {/* Grille */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }, gap: 2.5 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid", borderColor: "divider",
                  p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Bone width={80} height={24} radius={8} />
                    <Bone width={70} height={24} radius={8} />
                  </Box>
                  <Bone width="85%" height={20} radius={6} />
                  <Bone width="70%" height={16} radius={6} />
                  <Bone width="50%" height={14} radius={6} />
                  <Bone height={40} radius={10} />
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      <VitrineFooter />
    </VitrineProvider>
  )
}
