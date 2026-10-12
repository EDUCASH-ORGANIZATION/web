import { Html, Body, Container, Text, Button, Heading, Hr, Section, Img } from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   studentName: string,
 *   amount: string | number,
 *   missionTitle: string,
 *   paidAt: string,
 * }} props
 */
export default function PaymentReceived({
  studentName = "Étudiant",
  amount = "0",
  missionTitle = "la mission",
  paidAt = "",
}) {
  const formattedDate = paidAt
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(paidAt))
    : ""

  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Paiement reçu 💰</Heading>

          <Text style={text}>Bonjour {studentName},</Text>

          <Text style={text}>
            Bonne nouvelle ! Votre paiement pour la mission{" "}
            <strong>« {missionTitle} »</strong> a été effectué avec succès.
          </Text>

          <Section style={amountBlock}>
            <Text style={amountLabel}>Montant reçu</Text>
            <Text style={amountValue}>{amount} FCFA</Text>
            {formattedDate && (
              <Text style={amountDate}>Le {formattedDate}</Text>
            )}
          </Section>

          <Text style={text}>
            Le montant sera disponible sur votre compte Mobile Money sous peu.
            Merci d&apos;avoir utilisé EduCash !
          </Text>

          <Button href={`${APP_URL}/dashboard`} style={button}>
            Voir mon tableau de bord →
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
const amountBlock = { backgroundColor: COLORS.menthe, borderRadius: "12px", padding: "20px 24px", margin: "20px 0", textAlign: "center" }
const amountLabel = { color: COLORS.encre, fontSize: "13px", margin: "0 0 4px" }
const amountValue = { color: COLORS.encre, fontSize: "28px", fontWeight: "700", margin: "0 0 4px" }
const amountDate = { color: COLORS.encre, fontSize: "12px", margin: 0 }
