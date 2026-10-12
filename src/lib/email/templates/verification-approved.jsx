import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column, Img,
} from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

/**
 * @param {{
 *   name:          string,
 *   school:        string | null,
 *   verifiedUntil: string | null,
 *   appUrl:        string,
 * }} props
 */
export default function VerificationApproved({
  name          = "Étudiant",
  school        = null,
  verifiedUntil = null,
  appUrl        = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj",
}) {
  const firstName = name.split(" ")[0]

  const verifiedUntilFormatted = verifiedUntil
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(verifiedUntil))
    : null

  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>

          {/* ── Logo ──────────────────────────────────────────────── */}
          <Img {...logoProps()} />

          {/* ── Icône checkmark ───────────────────────────────────── */}
          <Section style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={iconCircle}>
              <span style={iconCheck}>✓</span>
            </div>
          </Section>

          {/* ── Titre ─────────────────────────────────────────────── */}
          <Heading style={h1}>Félicitations {firstName} ! 🎉</Heading>

          {/* ── Corps ─────────────────────────────────────────────── */}
          <Text style={text}>
            Ton profil EduCash a été <strong>vérifié par notre équipe</strong>.
            Tu peux maintenant postuler à toutes les missions disponibles sur la plateforme.
          </Text>

          {/* ── Encadré vert ──────────────────────────────────────── */}
          <Section style={greenBox}>
            {verifiedUntilFormatted && (
              <Row style={{ marginBottom: "8px" }}>
                <Column>
                  <Text style={boxLabel}>Badge vérifié actif jusqu&apos;au</Text>
                  <Text style={boxValue}>{verifiedUntilFormatted}</Text>
                </Column>
              </Row>
            )}
            {school && (
              <Row>
                <Column>
                  <Text style={boxLabel}>Établissement confirmé</Text>
                  <Text style={boxValue}>{school}</Text>
                </Column>
              </Row>
            )}
          </Section>

          <Text style={text}>
            Ce badge renforce ta crédibilité auprès des clients et augmente tes chances
            d&apos;être sélectionné(e). Les étudiants vérifiés sont <strong>3× plus souvent choisis</strong>.
          </Text>

          {/* ── CTA ───────────────────────────────────────────────── */}
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={appUrl + "/student/missions"} style={buttonGreen}>
              Explorer les missions →
            </Button>
          </Section>

          <Hr style={hr} />

          {/* ── Note expiration ───────────────────────────────────── */}
          <Text style={note}>
            Ton badge de vérification est valable 1 an.
            Tu recevras un rappel avant son expiration.
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
const iconCircle = { width: "72px", height: "72px", borderRadius: "50%", backgroundColor: COLORS.bleu, display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }
const iconCheck  = { color: COLORS.blanc, fontSize: "36px", fontWeight: "700", lineHeight: 1 }
const h1         = { ...styles.h1, margin: "0 0 16px" }
const text       = { ...styles.text, lineHeight: "1.65" }
const greenBox   = { backgroundColor: COLORS.menthe, borderRadius: "10px", padding: "16px 20px", margin: "20px 0" }
const boxLabel   = { color: COLORS.encre, fontSize: "13px", fontWeight: "700", margin: "0 0 2px" }
const boxValue   = { color: COLORS.encre, fontSize: "14px", fontWeight: "700", margin: "0 0 12px" }
const buttonGreen = styles.button
const hr         = { ...styles.hr, margin: "28px 0 16px" }
const note       = { ...styles.secondary, fontSize: "13px", textAlign: "center" }
const footer     = styles.footer
