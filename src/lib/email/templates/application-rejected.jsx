import { Html, Body, Container, Text, Button, Heading, Hr } from "@react-email/components"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   studentName: string,
 *   missionTitle: string,
 * }} props
 */
export default function ApplicationRejected({
  studentName = "Étudiant",
  missionTitle = "la mission",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Mise à jour de votre candidature</Heading>

          <Text style={text}>Bonjour {studentName},</Text>

          <Text style={text}>
            Nous vous informons que votre candidature pour la mission{" "}
            <strong>« {missionTitle} »</strong> n&apos;a malheureusement pas été retenue.
          </Text>

          <Text style={text}>
            Ne vous découragez pas — de nombreuses autres missions vous attendent sur EduCash.
            Chaque candidature est une opportunité de vous démarquer !
          </Text>

          <Button href={`${APP_URL}/missions`} style={button}>
            Explorer d'autres missions →
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
const button = { backgroundColor: "#1A6B4A", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block", margin: "16px 0" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" }
