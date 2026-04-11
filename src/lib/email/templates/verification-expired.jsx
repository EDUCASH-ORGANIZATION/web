import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column,
} from "@react-email/components"

/**
 * @param {{
 *   name:   string,
 *   appUrl: string,
 * }} props
 */
export default function VerificationExpired({
  name   = "Étudiant",
  appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj",
}) {
  const firstName = name.split(" ")[0]

  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>

          {/* ── Logo ──────────────────────────────────────────────── */}
          <Row style={{ marginBottom: "28px" }}>
            <Column>
              <Text style={logo}>
                <span style={{ color: "#1A6B4A" }}>Edu</span>
                <span style={{ color: "#F59E0B" }}>Cash</span>
              </Text>
            </Column>
          </Row>

          {/* ── Icône expiration ──────────────────────────────────── */}
          <Section style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={iconCircle}>
              <span style={iconMark}>↻</span>
            </div>
          </Section>

          {/* ── Titre ─────────────────────────────────────────────── */}
          <Heading style={h1}>Ton badge EduCash a expiré</Heading>

          {/* ── Corps ─────────────────────────────────────────────── */}
          <Text style={text}>Bonjour {firstName},</Text>

          <Text style={text}>
            Ton badge de vérification EduCash a expiré. Pour continuer à postuler
            aux missions et maintenir ta crédibilité auprès des clients, tu dois
            soumettre une nouvelle carte étudiante.
          </Text>

          {/* ── Encadré amber ─────────────────────────────────────── */}
          <Section style={amberBox}>
            <Row>
              <Column>
                <Text style={boxLabel}>Pourquoi renouveler ?</Text>
                <Text style={boxValue}>
                  Les étudiants vérifiés sont <strong>3× plus souvent choisis</strong> par les clients.
                  Garde ton avantage compétitif.
                </Text>
              </Column>
            </Row>
          </Section>

          {/* ── CTA ───────────────────────────────────────────────── */}
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={appUrl + "/profile/edit"} style={buttonAmber}>
              Renouveler mon badge →
            </Button>
          </Section>

          <Hr style={hr} />

          {/* ── Note délai ────────────────────────────────────────── */}
          <Text style={note}>
            La vérification prend généralement <strong>24 à 48 heures</strong>.
            Notre équipe examine chaque dossier avec attention.
          </Text>

          <Text style={footer}>
            EduCash — Marketplace étudiant au Bénin · educash.bj
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const body       = { backgroundColor: "#f3f4f6", fontFamily: "Arial, sans-serif", margin: 0, padding: "24px 0" }
const container  = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px 36px", borderRadius: "16px", maxWidth: "520px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }
const logo       = { fontSize: "22px", fontWeight: "800", margin: "0 0 4px", letterSpacing: "-0.5px" }
const iconCircle = { width: "72px", height: "72px", borderRadius: "50%", backgroundColor: "#F59E0B", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }
const iconMark   = { color: "#ffffff", fontSize: "36px", fontWeight: "800", lineHeight: 1 }
const h1         = { color: "#111827", fontSize: "22px", fontWeight: "800", margin: "0 0 16px", letterSpacing: "-0.3px" }
const text       = { color: "#374151", fontSize: "15px", lineHeight: "1.65", margin: "12px 0" }
const amberBox   = { backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "16px 20px", margin: "20px 0" }
const boxLabel   = { color: "#92400e", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }
const boxValue   = { color: "#78350f", fontSize: "14px", margin: 0, lineHeight: "1.55" }
const buttonAmber = { backgroundColor: "#F59E0B", color: "#ffffff", padding: "13px 28px", borderRadius: "10px", fontSize: "15px", fontWeight: "700", textDecoration: "none", display: "inline-block" }
const hr         = { borderColor: "#e5e7eb", margin: "28px 0 16px" }
const note       = { color: "#6b7280", fontSize: "13px", lineHeight: "1.55", margin: "0 0 12px", textAlign: "center" }
const footer     = { color: "#9ca3af", fontSize: "12px", textAlign: "center", margin: 0 }
