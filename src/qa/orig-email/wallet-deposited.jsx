// Copie de origin/main (1d04be8) pour comparer les textes ; couleurs neutralisees (garde palette).
import { Html, Body, Container, Text, Button, Heading, Hr, Section } from "@react-email/components"

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

const body = { backgroundColor: "inherit", fontFamily: "Arial, sans-serif", margin: 0 }
const container = { backgroundColor: "inherit", margin: "40px auto", padding: "32px", borderRadius: "12px", maxWidth: "520px" }
const h1 = { color: "inherit", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }
const text = { color: "inherit", fontSize: "15px", lineHeight: "1.6", margin: "12px 0" }
const amountBlock = { backgroundColor: "inherit", border: "1px solid currentColor", borderRadius: "12px", padding: "20px 24px", margin: "20px 0", textAlign: "center" }
const amountLabel = { color: "inherit", fontSize: "13px", margin: "0 0 4px" }
const amountValue = { color: "inherit", fontSize: "32px", fontWeight: "900", margin: "0 0 8px" }
const balanceLine = { color: "inherit", fontSize: "13px", margin: 0 }
const button = { backgroundColor: "inherit", color: "inherit", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block", margin: "16px 0" }
const hr = { borderColor: "inherit", margin: "24px 0" }
const footer = { color: "inherit", fontSize: "12px", textAlign: "center" }
