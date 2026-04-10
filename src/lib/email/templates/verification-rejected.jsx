import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column,
} from "@react-email/components"
import { CARD_UPLOAD_INSTRUCTIONS } from "@/lib/supabase/database.constants"

/**
 * @param {{
 *   name:           string,
 *   rejectionReason: string,
 *   customMessage?: string | null,
 *   appUrl:         string,
 * }} props
 */
export default function VerificationRejected({
  name            = "Étudiant",
  rejectionReason = "Informations insuffisantes.",
  customMessage   = null,
  appUrl          = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj",
}) {
  const firstName = name.split(" ")[0]

  // On prend les 3 premiers conseils pour ne pas alourdir l'email
  const tips = CARD_UPLOAD_INSTRUCTIONS.slice(0, 3)

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

          {/* ── Icône alerte ──────────────────────────────────────── */}
          <Section style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={iconCircle}>
              <span style={iconMark}>!</span>
            </div>
          </Section>

          {/* ── Titre ─────────────────────────────────────────────── */}
          <Heading style={h1}>Action requise sur ton profil</Heading>

          {/* ── Corps ─────────────────────────────────────────────── */}
          <Text style={text}>Bonjour {firstName},</Text>

          <Text style={text}>
            Notre équipe a examiné ton dossier mais n&apos;a pas pu valider ta carte
            étudiante pour la raison suivante :
          </Text>

          {/* ── Motif de rejet ────────────────────────────────────── */}
          <Section style={amberBox}>
            <Text style={amberLabel}>Motif du rejet</Text>
            <Text style={amberValue}>{rejectionReason}</Text>
          </Section>

          {/* ── Message personnalisé de l'admin ───────────────────── */}
          {customMessage && (
            <Text style={customMsg}>
              💬 {customMessage}
            </Text>
          )}

          {/* ── Conseils ──────────────────────────────────────────── */}
          <Text style={subTitle}>Comment corriger ça :</Text>

          <Section style={tipsBox}>
            {tips.map((tip, i) => (
              <Row key={i} style={{ marginBottom: i < tips.length - 1 ? "8px" : 0 }}>
                <Column style={{ width: "20px", verticalAlign: "top", paddingTop: "2px" }}>
                  <Text style={tipBullet}>·</Text>
                </Column>
                <Column>
                  <Text style={tipText}>{tip}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Text style={text}>
            Tu peux soumettre un nouveau document dès maintenant.
          </Text>

          {/* ── CTA ───────────────────────────────────────────────── */}
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={appUrl + "/student/profile/edit"} style={buttonAmber}>
              Soumettre un nouveau document →
            </Button>
          </Section>

          <Hr style={hr} />

          {/* ── Note rassurante ───────────────────────────────────── */}
          <Text style={note}>
            Notre équipe examine chaque dossier avec attention.
            N&apos;hésite pas à nous contacter si tu as des questions.
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
const iconMark   = { color: "#ffffff", fontSize: "38px", fontWeight: "800", lineHeight: 1 }
const h1         = { color: "#111827", fontSize: "22px", fontWeight: "800", margin: "0 0 16px", letterSpacing: "-0.3px" }
const text       = { color: "#374151", fontSize: "15px", lineHeight: "1.65", margin: "12px 0" }
const amberBox   = { backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "16px 20px", margin: "16px 0" }
const amberLabel = { color: "#92400e", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }
const amberValue = { color: "#78350f", fontSize: "14px", fontWeight: "600", margin: 0, lineHeight: "1.55" }
const customMsg  = { color: "#374151", fontSize: "14px", fontStyle: "italic", backgroundColor: "#f9fafb", borderLeft: "3px solid #d1d5db", borderRadius: "0 6px 6px 0", padding: "10px 14px", margin: "12px 0" }
const subTitle   = { color: "#111827", fontSize: "15px", fontWeight: "700", margin: "20px 0 8px" }
const tipsBox    = { backgroundColor: "#f9fafb", borderRadius: "10px", padding: "14px 16px", margin: "0 0 16px" }
const tipBullet  = { color: "#1A6B4A", fontSize: "18px", fontWeight: "700", margin: 0, lineHeight: "1.4" }
const tipText    = { color: "#374151", fontSize: "14px", lineHeight: "1.55", margin: 0 }
const buttonAmber = { backgroundColor: "#F59E0B", color: "#ffffff", padding: "13px 28px", borderRadius: "10px", fontSize: "15px", fontWeight: "700", textDecoration: "none", display: "inline-block" }
const hr         = { borderColor: "#e5e7eb", margin: "28px 0 16px" }
const note       = { color: "#6b7280", fontSize: "13px", lineHeight: "1.55", margin: "0 0 12px", textAlign: "center" }
const footer     = { color: "#9ca3af", fontSize: "12px", textAlign: "center", margin: 0 }
