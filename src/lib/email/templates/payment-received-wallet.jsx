import { Html, Body, Container, Text, Button, Heading, Hr, Section } from "@react-email/components"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   firstName: string,
 *   amount: string | number,
 *   missionTitle: string,
 * }} props
 */
export default function PaymentReceivedWallet({
  firstName = "Étudiant",
  amount = "0",
  missionTitle = "la mission",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Paiement reçu 💰</Heading>

          <Text style={text}>Bonjour {firstName},</Text>

          <Text style={text}>
            Bonne nouvelle ! La mission <strong>« {missionTitle} »</strong> a été validée.
          </Text>

          <Section style={amountBlock}>
            <Text style={amountLabel}>Montant reçu</Text>
            <Text style={amountValue}>{amount} FCFA</Text>
          </Section>

          <Text style={text}>
            Ces fonds sont disponibles dans votre wallet EduCash.
          </Text>

          <Button href={`${APP_URL}/student/wallet`} style={button}>
            Retirer mes gains →
          </Button>

          <Hr style={hr} />
          <Text style={footer}>EduCash — Marketplace étudiant au Bénin</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif", margin: 0 }
const container = { backgroundColor: "#ffffff", margin: "40px auto", padding: "32px", borderRadius: "12px", maxWidth: "520px" }
const h1 = { color: "#1A6B4A", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }
const text = { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "12px 0" }
const amountBlock = { backgroundColor: "#f0faf5", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "20px 24px", margin: "20px 0", textAlign: "center" }
const amountLabel = { color: "#6b7280", fontSize: "13px", margin: "0 0 4px" }
const amountValue = { color: "#15803d", fontSize: "32px", fontWeight: "900", margin: 0 }
const button = { backgroundColor: "#1A6B4A", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block", margin: "16px 0" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" }
