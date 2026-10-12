import { Html, Body, Container, Text, Button, Heading, Hr, Section, Img } from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

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
          <Img {...logoProps()} />

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
          <Text style={footer}>EduCash - Marketplace étudiant au Bénin</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = styles.body
const container = styles.container
const h1 = styles.h1
const text = styles.text
const button = styles.button
const hr = styles.hr
const footer = styles.footer
const quoteBlock = { backgroundColor: COLORS.brume, borderLeft: `3px solid ${COLORS.vert}`, padding: "12px 16px", borderRadius: "0 8px 8px 0", margin: "16px 0" }
const quoteText = { color: COLORS.ardoise, fontSize: "14px", fontStyle: "italic", margin: 0 }
