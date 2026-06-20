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
import MenuRoundedIcon from "@mui/icons-material/MenuRounded"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import { Logo } from "@/components/shared/logo"
import { BRAND } from "./theme"

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

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 12) }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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

            <Box sx={{ flexGrow: 1 }} />

            {/* Liens desktop */}
            <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, mr: 2 }}>
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

            {/* Actions desktop */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }}>
              <Button component={Link} href="/auth/login" color="inherit"
                sx={{ color: "text.primary", "&:hover": { background: "rgba(15,23,42,0.04)", transform: "none" } }}>
                Se connecter
              </Button>
              <Button component={Link} href="/auth/register" variant="contained" color="primary">
                S&apos;inscrire
              </Button>
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
          <Button component={Link} href="/auth/login" variant="outlined" color="primary" fullWidth
            onClick={() => setOpen(false)}>
            Se connecter
          </Button>
          <Button component={Link} href="/auth/register" variant="contained" color="primary" fullWidth
            onClick={() => setOpen(false)}>
            S&apos;inscrire gratuitement
          </Button>
        </Stack>
      </Drawer>
    </>
  )
}
