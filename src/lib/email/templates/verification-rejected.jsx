import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column, Img,
} from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"
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
          <Img {...logoProps()} />

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
            <Button href={appUrl + "/profile/verify"} style={buttonAmber}>
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
const iconMark   = { color: COLORS.encre, fontSize: "38px", fontWeight: "700", lineHeight: 1 }
const h1         = { ...styles.h1, margin: "0 0 16px" }
const text       = { ...styles.text, lineHeight: "1.65" }
const amberBox   = { backgroundColor: COLORS.rose, borderRadius: "10px", padding: "16px 20px", margin: "16px 0" }
const amberLabel = { color: COLORS.encre, fontSize: "13px", fontWeight: "700", margin: "0 0 6px" }
const amberValue = { color: COLORS.encre, fontSize: "14px", fontWeight: "700", margin: 0, lineHeight: "1.55" }
const customMsg  = { color: COLORS.ardoise, fontSize: "14px", fontStyle: "italic", backgroundColor: COLORS.brume, borderLeft: `3px solid ${COLORS.vert}`, borderRadius: "0 6px 6px 0", padding: "10px 14px", margin: "12px 0" }
const subTitle   = { color: COLORS.encre, fontSize: "15px", fontWeight: "700", margin: "20px 0 8px" }
const tipsBox    = { backgroundColor: COLORS.brume, borderRadius: "10px", padding: "14px 16px", margin: "0 0 16px" }
const tipBullet  = { color: COLORS.bleu, fontSize: "18px", fontWeight: "700", margin: 0, lineHeight: "1.4" }
const tipText    = { color: COLORS.encre, fontSize: "14px", lineHeight: "1.55", margin: 0 }
const buttonAmber = styles.button
const hr         = { ...styles.hr, margin: "28px 0 16px" }
const note       = { ...styles.secondary, fontSize: "13px", textAlign: "center" }
const footer     = styles.footer
