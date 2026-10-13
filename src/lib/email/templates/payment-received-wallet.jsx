import { Html, Body, Container, Text, Button, Heading, Hr, Section, Img } from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

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
          <Img {...logoProps()} />

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
            Ces fonds sont disponibles dans votre portefeuille EduCash.
          </Text>

          <Button href={`${APP_URL}/student/wallet`} style={button}>
            Retirer mes gains →
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
const amountValue = { color: COLORS.encre, fontSize: "28px", fontWeight: "700", margin: 0 }
