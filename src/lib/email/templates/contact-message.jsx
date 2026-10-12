import { Html, Body, Container, Text, Heading, Hr, Img } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

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
          <Img {...logoProps()} />

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

const body = styles.body
const container = styles.container
const h1 = styles.h1
const text = styles.text
const hr = styles.hr
const footer = styles.footer
const messageStyle = { ...styles.text, whiteSpace: "pre-wrap" }
