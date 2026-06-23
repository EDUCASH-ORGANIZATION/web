"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import AppBar from "@mui/material/AppBar"
import Toolbar from "@mui/material/Toolbar"
import Container from "@mui/material/Container"
import Box from "@mui/material/Box"
import { Stack } from "./stack"
import Button from "@mui/material/Button"
import IconButton from "@mui/material/IconButton"
import Drawer from "@mui/material/Drawer"
import Divider from "@mui/material/Divider"
import Avatar from "@mui/material/Avatar"
import Tooltip from "@mui/material/Tooltip"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Typography from "@mui/material/Typography"
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded"
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded"
import { Logo } from "@/components/shared/logo"
import { BRAND } from "./theme"
import { createBrowserClient } from "@supabase/ssr"

const NAV_LINKS = [
  { label: "Accueil", href: "/" },
  { label: "Comment ça marche", href: "/#how-it-works" },
  { label: "Missions", href: "/missions" },
  { label: "À propos", href: "/about" },
]

function BrandName({ size = "1.35rem" }) {
  return (
    <Box component="span" sx={{ fontSize: size, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>
      <Box component="span" sx={{ color: BRAND.green }}>Edu</Box>
      <Box component="span" sx={{ color: BRAND.amber }}>Cash</Box>
    </Box>
  )
}

export function VitrineNavbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [anchorEl, setAnchorEl] = useState(null)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 12) }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUser(user)
      supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  const dashboardHref = profile?.role === "client" ? "/client/dashboard" : "/dashboard"
  const initials = profile?.full_name?.charAt(0).toUpperCase() ?? "?"

  function handleMenuOpen(e) { setAnchorEl(e.currentTarget) }
  function handleMenuClose() { setAnchorEl(null) }
  async function handleLogout() {
    handleMenuClose()
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          color: "text.primary",
          backgroundColor: scrolled ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.55)",
          backdropFilter: "saturate(180%) blur(14px)",
          WebkitBackdropFilter: "saturate(180%) blur(14px)",
          borderBottom: "1px solid",
          borderColor: scrolled ? "rgba(15,23,42,0.08)" : "transparent",
          transition: "all .25s ease",
        }}
      >
        <Container>
          <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 } }}>
            {/* Logo */}
            <Stack component={Link} href="/" direction="row" alignItems="center" spacing={1}
              sx={{ textDecoration: "none", flexShrink: 0 }}>
              <Logo size="md" />
              <BrandName />
            </Stack>

            {/* Liens desktop — centré absolument */}
            <Stack direction="row" spacing={0.5} sx={{
              display: { xs: "none", md: "flex" },
              position: "absolute", left: "50%", transform: "translateX(-50%)",
            }}>
              {NAV_LINKS.map(({ label, href }) => {
                const active = pathname === href
                return (
                  <Button
                    key={href}
                    component={Link}
                    href={href}
                    disableRipple
                    sx={{
                      color: active ? "primary.main" : "text.secondary",
                      fontWeight: active ? 700 : 600,
                      px: 1.5,
                      "&:hover": { color: "primary.main", background: "transparent", transform: "none" },
                    }}
                  >
                    {label}
                  </Button>
                )
              })}
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            {/* Actions desktop */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
              {user ? (
                <>
                  <Button
                    component={Link}
                    href={dashboardHref}
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<DashboardRoundedIcon />}
                    sx={{ fontWeight: 700 }}
                  >
                    Mon espace
                  </Button>
                  <Tooltip title={profile?.full_name ?? "Mon compte"}>
                    <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
                      <Avatar
                        src={profile?.avatar_url || undefined}
                        sx={{ width: 36, height: 36, bgcolor: BRAND.green, fontWeight: 800, fontSize: "0.9rem" }}
                      >
                        {initials}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    slotProps={{ paper: { sx: { borderRadius: "16px", mt: 1, minWidth: 220, overflow: "hidden", boxShadow: "0 8px 32px -8px rgba(15,23,42,0.25)" } } }}
                    transformOrigin={{ horizontal: "right", vertical: "top" }}
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                  >
                    <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{profile?.full_name ?? "Mon compte"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>{user.email}</Typography>
                    </Box>
                    <MenuItem component={Link} href={dashboardHref} onClick={handleMenuClose}
                      sx={{ gap: 1.5, py: 1.25, fontWeight: 600 }}>
                      <DashboardRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                      Tableau de bord
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1.25, fontWeight: 600, color: "error.main" }}>
                      <LogoutRoundedIcon sx={{ fontSize: 18 }} />
                      Se déconnecter
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <>
                  <Button component={Link} href="/auth/login" color="inherit"
                    sx={{ color: "text.primary", "&:hover": { background: "rgba(15,23,42,0.04)", transform: "none" } }}>
                    Se connecter
                  </Button>
                  <Button component={Link} href="/auth/register" variant="contained" color="primary">
                    S&apos;inscrire
                  </Button>
                </>
              )}
            </Stack>

            {/* Burger mobile */}
            <IconButton
              onClick={() => setOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" }, color: "text.primary" }}
              aria-label="Ouvrir le menu"
            >
              <MenuRoundedIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Drawer mobile */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 300, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Logo size="sm" />
            <BrandName size="1.15rem" />
          </Stack>
          <IconButton onClick={() => setOpen(false)} aria-label="Fermer"><CloseRoundedIcon /></IconButton>
        </Box>
        <Divider />
        <Stack sx={{ p: 2, flex: 1 }} spacing={0.5}>
          {NAV_LINKS.map(({ label, href }) => (
            <Button
              key={href}
              component={Link}
              href={href}
              onClick={() => setOpen(false)}
              fullWidth
              sx={{ justifyContent: "flex-start", color: "text.primary", fontWeight: 600, py: 1.25,
                "&:hover": { background: BRAND.greenSoft, color: "primary.main", transform: "none" } }}
            >
              {label}
            </Button>
          ))}
        </Stack>
        <Divider />
        <Stack sx={{ p: 2 }} spacing={1}>
          {user ? (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1, py: 0.5, overflow: "hidden" }}>
                <Avatar
                  src={profile?.avatar_url || undefined}
                  sx={{ width: 40, height: 40, bgcolor: BRAND.green, fontWeight: 800, flexShrink: 0 }}
                >
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.2 }}>
                    {profile?.full_name ?? "Mon compte"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: "100%" }}>{user.email}</Typography>
                </Box>
              </Box>
              <Button component={Link} href={dashboardHref} variant="contained" color="primary" fullWidth
                startIcon={<DashboardRoundedIcon />} onClick={() => setOpen(false)}>
                Mon espace
              </Button>
              <Button onClick={handleLogout} variant="outlined" color="error" fullWidth
                startIcon={<LogoutRoundedIcon />}>
                Se déconnecter
              </Button>
            </>
          ) : (
            <>
              <Button component={Link} href="/auth/login" variant="outlined" color="primary" fullWidth
                onClick={() => setOpen(false)}>
                Se connecter
              </Button>
              <Button component={Link} href="/auth/register" variant="contained" color="primary" fullWidth
                onClick={() => setOpen(false)}>
                S&apos;inscrire gratuitement
              </Button>
            </>
          )}
        </Stack>
      </Drawer>
    </>
  )
}
