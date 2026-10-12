import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://educash.bj"

/**
 * @param {{
 *   studentName: string,
 *   missionTitle: string,
 * }} props
 */
export default function ApplicationRejected({
  studentName = "Étudiant",
  missionTitle = "la mission",
}) {
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Mise à jour de votre candidature</Heading>

          <Text style={text}>Bonjour {studentName},</Text>

          <Text style={text}>
            Nous vous informons que votre candidature pour la mission{" "}
            <strong>« {missionTitle} »</strong> n&apos;a malheureusement pas été retenue.
          </Text>

          <Text style={text}>
            Ne vous découragez pas, de nombreuses autres missions vous attendent sur EduCash.
            Chaque candidature est une opportunité de vous démarquer !
          </Text>

          <Button href={`${APP_URL}/missions`} style={button}>
            Explorer d&apos;autres missions →
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
