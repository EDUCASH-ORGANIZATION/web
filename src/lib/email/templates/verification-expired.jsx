import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column, Img,
} from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

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
          <Img {...logoProps()} />

          {/* ── Icône expiration ──────────────────────────────────── */}
          <Section style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={iconCircle}>
              <span style={iconMark}>↻</span>
            </div>
          </Section>

          {/* ── Titre ─────────────────────────────────────────────── */}
          <Heading style={h1}>Votre badge EduCash a expiré</Heading>

          {/* ── Corps ─────────────────────────────────────────────── */}
          <Text style={text}>Bonjour {firstName},</Text>

          <Text style={text}>
            Votre badge de vérification EduCash a expiré. Pour continuer à postuler
            aux missions et maintenir votre crédibilité auprès des clients, vous devez
            soumettre une nouvelle carte étudiante.
          </Text>

          {/* ── Encadré amber ─────────────────────────────────────── */}
          <Section style={amberBox}>
            <Row>
              <Column>
                <Text style={boxLabel}>Pourquoi renouveler ?</Text>
                <Text style={boxValue}>
                  Les étudiants vérifiés sont <strong>3× plus souvent choisis</strong> par les clients.
                  Gardez votre avantage compétitif.
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
            EduCash - Marketplace étudiant au Bénin · educash.bj
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const body       = styles.body
const container  = styles.container
const iconCircle = { width: "72px", height: "72px", borderRadius: "50%", backgroundColor: COLORS.vert, display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }
const iconMark   = { color: COLORS.encre, fontSize: "36px", fontWeight: "700", lineHeight: 1 }
const h1         = { ...styles.h1, margin: "0 0 16px" }
const text       = { ...styles.text, lineHeight: "1.65" }
const amberBox   = { backgroundColor: COLORS.peche, borderRadius: "10px", padding: "16px 20px", margin: "20px 0" }
const boxLabel   = { color: COLORS.encre, fontSize: "13px", fontWeight: "700", margin: "0 0 6px" }
const boxValue   = { color: COLORS.encre, fontSize: "14px", margin: 0, lineHeight: "1.55" }
const buttonAmber = styles.button
const hr         = { ...styles.hr, margin: "28px 0 16px" }
const note       = { ...styles.secondary, fontSize: "13px", textAlign: "center" }
const footer     = styles.footer
