import { Html, Body, Container, Text, Heading, Hr, Img, Link } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const CONTACT = "contact@educash.bj"

/**
 * Confirmation de réactivation d'un compte fermé. Aucun montant, aucun lien de connexion.
 *
 * @param {{ name?: string }} props
 */
export default function AccountReopened({ name = "" }) {
  const firstName = typeof name === "string" ? name.trim().split(" ")[0] : ""

  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Votre compte EduCash est réactivé</Heading>

          <Text style={text}>{firstName ? `Bonjour ${firstName},` : "Bonjour,"}</Text>

          <Text style={text}>
            Votre compte EduCash a été réactivé. Vous pouvez de nouveau vous connecter avec votre adresse et votre
            mot de passe habituels.
          </Text>

          <Text style={text}>
            Une question ? Écrivez-nous à <Link href={`mailto:${CONTACT}`}>{CONTACT}</Link>.
          </Text>

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
const hr = styles.hr
const footer = styles.footer
