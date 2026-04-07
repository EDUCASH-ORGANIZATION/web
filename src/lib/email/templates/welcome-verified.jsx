import { Html, Body, Container, Text, Button, Heading, Hr } from "@react-email/components"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{ name: string }} props
 */
export default function WelcomeVerified({ name = "Étudiant" }) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Profil vérifié ✓</Heading>

          <Text style={text}>Bonjour {name} 👋</Text>

          <Text style={text}>
            Bonne nouvelle ! Votre profil EduCash a été <strong>vérifié</strong> par notre équipe.
            Vous pouvez désormais postuler à toutes les missions disponibles sur la plateforme.
          </Text>

          <Text style={text}>
            Consultez les missions près de chez vous et commencez à gagner de l&apos;argent dès aujourd&apos;hui.
          </Text>

          <Button href={APP_URL + "/missions"} style={button}>
            Voir les missions →
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
