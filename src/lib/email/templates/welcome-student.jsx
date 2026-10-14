import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{ name: string }} props
 */
export default function WelcomeStudent({ name = "Étudiant" }) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Bienvenue sur EduCash</Heading>

          <Text style={text}>Bonjour {name},</Text>

          <Text style={text}>
            Bienvenue sur EduCash ! Votre profil est en cours de vérification.
            Nous examinons votre carte, vous recevrez un email.
          </Text>

          <Text style={text}>
            Une fois vérifié, vous pourrez postuler à toutes les missions disponibles
            et commencer à gagner de l&apos;argent.
          </Text>

          <Button href={APP_URL + "/missions"} style={button}>
            Explorer les missions
          </Button>

          <Hr style={hr} />

          <Text style={footer}>EduCash - Bénin</Text>
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
