import { Html, Body, Container, Text, Button, Heading, Hr, Section } from "@react-email/components"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{ name: string, reason: string }} props
 */
export default function VerificationRejected({ name = "Étudiant", reason = "" }) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Vérification non aboutie</Heading>

          <Text style={text}>Bonjour {name},</Text>

          <Text style={text}>
            Nous avons examiné votre dossier de vérification, mais nous ne sommes pas en mesure
            de le valider pour le moment.
          </Text>

          {reason && (
            <Section style={reasonBlock}>
              <Text style={reasonLabel}>Motif :</Text>
              <Text style={reasonText}>{reason}</Text>
            </Section>
          )}

          <Text style={text}>
            Vous pouvez soumettre un nouveau dossier avec les documents corrects depuis votre profil.
            Notre équipe l&apos;examinera dans les meilleurs délais.
          </Text>

          <Button href={APP_URL + "/profile"} style={button}>
            Mettre à jour mon profil →
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
const h1 = { color: "#dc2626", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }
const text = { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "12px 0" }
const reasonBlock = { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px 16px", margin: "16px 0" }
const reasonLabel = { color: "#6b7280", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", margin: "0 0 4px" }
const reasonText = { color: "#374151", fontSize: "14px", margin: 0 }
const button = { backgroundColor: "#1A6B4A", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block", margin: "16px 0" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" }
