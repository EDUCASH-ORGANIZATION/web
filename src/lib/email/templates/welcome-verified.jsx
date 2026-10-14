import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{ name: string }} props
 */
export default function WelcomeVerified({ name = "Étudiant" }) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Profil vérifié</Heading>

          <Text style={text}>Bonjour {name},</Text>

          <Text style={text}>
            Bonne nouvelle ! Votre profil EduCash a été <strong>vérifié</strong> par notre équipe.
            Vous pouvez désormais postuler à toutes les missions disponibles sur la plateforme.
          </Text>

          <Text style={text}>
            Consultez les missions près de chez vous et commencez à gagner de l&apos;argent dès aujourd&apos;hui.
          </Text>

          <Button href={APP_URL + "/missions"} style={button}>
            Voir les missions
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
