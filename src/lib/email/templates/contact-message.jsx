import { Html, Body, Container, Text, Heading, Hr } from "@react-email/components"

/**
 * @param {{
 *   name: string,
 *   email: string,
 *   subjectLabel: string,
 *   message: string,
 *   receivedAt?: string,
 * }} props
 */
export default function ContactMessage({
  name = "",
  email = "",
  subjectLabel = "",
  message = "",
  receivedAt = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Porto-Novo" }),
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Nouveau message de contact</Heading>

          <Text style={text}>
            <strong>Nom :</strong> {name}
          </Text>
          <Text style={text}>
            <strong>Email :</strong> {email}
          </Text>
          <Text style={text}>
            <strong>Sujet :</strong> {subjectLabel}
          </Text>
          <Text style={text}>
            <strong>Reçu le :</strong> {receivedAt}
          </Text>

          <Hr style={hr} />
          <Text style={messageStyle}>{message}</Text>

          <Hr style={hr} />
          <Text style={footer}>
            Répondre à cet email écrit directement à l&apos;expéditeur.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif", margin: 0 }
const container = { backgroundColor: "#ffffff", margin: "40px auto", padding: "32px", borderRadius: "12px", maxWidth: "520px" }
const h1 = { color: "#1A6B4A", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }
const text = { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "6px 0" }
const messageStyle = { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "12px 0", whiteSpace: "pre-wrap" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" }
