import {
  Html, Body, Container, Text, Button,
  Heading, Hr, Section, Row, Column,
} from "@react-email/components"

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
          <Row style={{ marginBottom: "28px" }}>
            <Column>
              <Text style={logo}>
                <span style={{ color: "#1A6B4A" }}>Edu</span>
                <span style={{ color: "#F59E0B" }}>Cash</span>
              </Text>
            </Column>
          </Row>

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
const iconCircle = { width: "72px", height: "72px", borderRadius: "50%", backgroundColor: "#1A6B4A", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }
const iconCheck  = { color: "#ffffff", fontSize: "36px", fontWeight: "700", lineHeight: 1 }
const h1         = { color: "#111827", fontSize: "22px", fontWeight: "800", margin: "0 0 16px", letterSpacing: "-0.3px" }
const text       = { color: "#374151", fontSize: "15px", lineHeight: "1.65", margin: "12px 0" }
const greenBox   = { backgroundColor: "#f0faf5", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "16px 20px", margin: "20px 0" }
const boxLabel   = { color: "#6b7280", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }
const boxValue   = { color: "#1A6B4A", fontSize: "14px", fontWeight: "700", margin: "0 0 12px" }
const buttonGreen = { backgroundColor: "#1A6B4A", color: "#ffffff", padding: "13px 28px", borderRadius: "10px", fontSize: "15px", fontWeight: "700", textDecoration: "none", display: "inline-block" }
const hr         = { borderColor: "#e5e7eb", margin: "28px 0 16px" }
const note       = { color: "#6b7280", fontSize: "13px", lineHeight: "1.55", margin: "0 0 12px", textAlign: "center" }
const footer     = { color: "#9ca3af", fontSize: "12px", textAlign: "center", margin: 0 }
