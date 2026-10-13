import { Html, Body, Container, Text, Button, Heading, Hr, Section, Img } from "@react-email/components"
import { COLORS, logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   firstName: string,
 *   amount: string | number,
 *   newBalance: string | number,
 * }} props
 */
export default function WalletDeposited({
  firstName = "Client",
  amount = "0",
  newBalance = "0",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Recharge confirmée 💳</Heading>

          <Text style={text}>Bonjour {firstName},</Text>

          <Text style={text}>
            Votre portefeuille EduCash a bien été crédité.
          </Text>

          <Section style={amountBlock}>
            <Text style={amountLabel}>Montant rechargé</Text>
            <Text style={amountValue}>{amount} FCFA</Text>
            <Text style={balanceLine}>
              Nouveau solde disponible : <strong>{newBalance} FCFA</strong>
            </Text>
          </Section>

          <Button href={`${APP_URL}/client/missions/new`} style={button}>
            Publier une mission →
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
const amountValue = { color: COLORS.encre, fontSize: "28px", fontWeight: "700", margin: "0 0 8px" }
const balanceLine = { color: COLORS.encre, fontSize: "13px", margin: 0 }
