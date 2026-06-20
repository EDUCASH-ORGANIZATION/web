"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded"
import { Stack } from "./stack"
import { MISSION_TYPES, CITIES } from "@/lib/supabase/database.constants"
import { BRAND } from "./theme"

const BUDGETS = [
  { value: "", label: "Budget : tous" },
  { value: "5000", label: "≤ 5 000 FCFA" },
  { value: "15000", label: "≤ 15 000 FCFA" },
  { value: "30000", label: "≤ 30 000 FCFA" },
  { value: "50000", label: "≤ 50 000 FCFA" },
]

const URGENCIES = [
  { value: "", label: "Urgence : toutes" },
  { value: "high", label: "Urgent" },
  { value: "medium", label: "Moyen" },
  { value: "low", label: "Normal" },
]

const SORTS = [
  { value: "recent", label: "Tri : plus récentes" },
  { value: "budget_desc", label: "Tri : budget décroissant" },
  { value: "budget_asc", label: "Tri : budget croissant" },
]

const selectSx = { minWidth: 150, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }

export function MissionsFilters({ totalCount = 0 }) {
  const router = useRouter()
  const params = useSearchParams()
  const [search, setSearch] = useState(params.get("q") ?? "")

  // Garde le champ de recherche synchronisé avec l'URL (ex. après « Réinitialiser »)
  useEffect(() => { setSearch(params.get("q") ?? "") }, [params])

  const set = useCallback((key, value) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete("page")
    const qs = next.toString()
    router.push(qs ? `/missions?${qs}` : "/missions")
  }, [params, router])

  const activeType    = params.get("type") ?? ""
  const activeCity    = params.get("city") ?? ""
  const activeUrgency = params.get("urgency") ?? ""
  const activeBudget  = params.get("budget") ?? ""
  const activeSort    = params.get("sort") ?? "recent"
  const activeSearch  = params.get("q") ?? ""

  const activeCount = [activeType, activeCity, activeUrgency, activeBudget, activeSearch].filter(Boolean).length

  function handleSearch(e) {
    e.preventDefault()
    set("q", search.trim())
  }

  function clearSearch() {
    setSearch("")
    set("q", "")
  }

  function reset() {
    setSearch("")
    router.push("/missions")
  }

  return (
    <Stack spacing={2.5}>
      {/* Recherche */}
      <Box component="form" onSubmit={handleSearch} sx={{ display: "flex", gap: 1.5 }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          placeholder="Quel job recherchez-vous ?"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Effacer la recherche" onClick={clearSearch} edge="end">
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 3, bgcolor: "#fff" },
            },
          }}
        />
        <Button type="submit" variant="contained" color="primary" sx={{ px: 3, flexShrink: 0 }}>
          Rechercher
        </Button>
      </Box>

      {/* Chips type */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: { xs: "nowrap", md: "wrap" },
        overflowX: { xs: "auto", md: "visible" }, pb: { xs: 0.5, md: 0 },
        "&::-webkit-scrollbar": { display: "none" } }}>
        <Chip
          label="Tout voir"
          clickable
          onClick={() => set("type", "")}
          variant={activeType ? "outlined" : "filled"}
          sx={!activeType
            ? { bgcolor: BRAND.green, color: "#fff", fontWeight: 700, flexShrink: 0, "&:hover": { bgcolor: BRAND.greenDark } }
            : { fontWeight: 600, flexShrink: 0 }}
        />
        {MISSION_TYPES.map((type) => {
          const active = activeType === type
          return (
            <Chip
              key={type}
              label={type}
              clickable
              onClick={() => set("type", active ? "" : type)}
              variant={active ? "filled" : "outlined"}
              sx={active
                ? { bgcolor: BRAND.green, color: "#fff", fontWeight: 700, flexShrink: 0, "&:hover": { bgcolor: BRAND.greenDark } }
                : { fontWeight: 600, flexShrink: 0 }}
            />
          )
        })}
      </Box>

      {/* Filtres secondaires + tri */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <TextField select size="small" value={activeCity} onChange={(e) => set("city", e.target.value)} sx={selectSx}
            slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Ville : toutes</MenuItem>
            {CITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <TextField select size="small" value={activeBudget} onChange={(e) => set("budget", e.target.value)} sx={selectSx}
            slotProps={{ select: { displayEmpty: true } }}>
            {BUDGETS.map((b) => <MenuItem key={b.value || "all"} value={b.value}>{b.label}</MenuItem>)}
          </TextField>

          <TextField select size="small" value={activeUrgency} onChange={(e) => set("urgency", e.target.value)} sx={selectSx}
            slotProps={{ select: { displayEmpty: true } }}>
            {URGENCIES.map((u) => <MenuItem key={u.value || "all"} value={u.value}>{u.label}</MenuItem>)}
          </TextField>

          <TextField select size="small" value={activeSort}
            onChange={(e) => set("sort", e.target.value === "recent" ? "" : e.target.value)} sx={{ ...selectSx, minWidth: 200 }}>
            {SORTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
          </TextField>

          {activeCount > 0 && (
            <Button onClick={reset} size="small" color="inherit" startIcon={<RestartAltRoundedIcon />}
              sx={{ color: "text.secondary", fontWeight: 600 }}>
              Réinitialiser
            </Button>
          )}
        </Stack>

        <Typography variant="body2" sx={{ color: "text.secondary", flexShrink: 0, whiteSpace: "nowrap" }}>
          <Box component="strong" sx={{ color: "text.primary", fontWeight: 800 }}>{totalCount}</Box> résultat{totalCount > 1 ? "s" : ""}
        </Typography>
      </Stack>
    </Stack>
  )
}
