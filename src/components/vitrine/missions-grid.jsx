"use client"

import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import { Stack } from "./stack"
import Typography from "@mui/material/Typography"
import Pagination from "@mui/material/Pagination"
import PaginationItem from "@mui/material/PaginationItem"
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded"
import { MissionCard } from "./mission-card"
import { BRAND } from "./theme"

const PAGE_SIZE = 9

/**
 * @param {{ missions: any[], totalCount: number, page: number,
 *           isLoggedIn: boolean, searchString: string }} props
 */
export function MissionsGrid({ missions, totalCount, page, isLoggedIn, searchString }) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function goToPage(p) {
    const params = new URLSearchParams(searchString)
    params.set("page", String(p))
    router.push(`/missions?${params.toString()}`)
  }

  function handleApply(mission) {
    if (!isLoggedIn) {
      router.push(`/auth/register?redirect=/missions/${mission.id}`)
      return
    }
    router.push(`/missions/${mission.id}`)
  }

  if (!missions?.length) {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={1.5}
        sx={{ py: 10, textAlign: "center", bgcolor: "#fff", borderRadius: 4, border: "1px solid", borderColor: "divider", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: BRAND.greenSoft, color: BRAND.green,
          display: "grid", placeItems: "center" }}>
          <WorkOutlineRoundedIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6">Aucune mission trouvée</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 360 }}>
          Essayez de modifier vos filtres ou revenez plus tard.
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={4}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }, gap: 2.5 }}>
        {missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            showApplyButton
            onOpen={() => router.push(`/missions/${mission.id}`)}
            onApply={handleApply}
          />
        ))}
      </Box>

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ alignItems: "center" }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => goToPage(p)}
            shape="rounded"
            renderItem={(item) => (
              <PaginationItem
                {...item}
                sx={{
                  fontWeight: 700,
                  "&.Mui-selected": { bgcolor: BRAND.green, color: "#fff", "&:hover": { bgcolor: BRAND.greenDark } },
                }}
              />
            )}
          />
        </Stack>
      )}
    </Stack>
  )
}
