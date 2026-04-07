import { Html, Body, Container, Text, Button, Heading, Hr, Section } from "@react-email/components"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   clientName: string,
 *   studentName: string,
 *   missionTitle: string,
 *   messageExcerpt: string,
 *   missionId: string,
 * }} props
 */
export default function NewApplication({
  clientName = "Client",
  studentName = "Un étudiant",
  missionTitle = "votre mission",
  messageExcerpt = "",
  missionId = "",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Nouvelle candidature 📩</Heading>

          <Text style={text}>Bonjour {clientName},</Text>

          <Text style={text}>
            <strong>{studentName}</strong> vient de postuler à votre mission{" "}
            <strong>« {missionTitle} »</strong>.
          </Text>

          {messageExcerpt && (
            <Section style={quoteBlock}>
              <Text style={quoteText}>« {messageExcerpt}… »</Text>
            </Section>
          )}

          <Text style={text}>
            Consultez sa candidature et son profil pour décider si vous souhaitez le sélectionner.
          </Text>

          <Button href={`${APP_URL}/client/missions/${missionId}`} style={button}>
            Voir les candidatures →
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
const quoteBlock = { backgroundColor: "#f0faf5", borderLeft: "3px solid #1A6B4A", padding: "12px 16px", borderRadius: "0 8px 8px 0", margin: "16px 0" }
const quoteText = { color: "#374151", fontSize: "14px", fontStyle: "italic", margin: 0 }
const button = { backgroundColor: "#1A6B4A", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block", margin: "16px 0" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" }
