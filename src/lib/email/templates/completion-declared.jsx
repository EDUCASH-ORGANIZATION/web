import { Html, Body, Container, Text, Button, Heading, Hr, Img } from "@react-email/components"
import { APP_URL, logoProps, styles } from "@/lib/email/brand"
import { clientMissionHref } from "@/lib/app/client-routes"
import { paymentsEnabled } from "@/lib/constants/payments"

/**
 * Au client : l'étudiant retenu indique avoir terminé. Aucune donnée de contact de l'étudiant.
 * La phrase sur le séquestre n'apparaît que si les paiements sont activés.
 *
 * @param {{
 *   studentName: string,
 *   missionTitle: string,
 *   missionId: string,
 * }} props `studentName` est un prénom seulement.
 */
export default function CompletionDeclared({
  studentName = "L'étudiant",
  missionTitle = "",
  missionId = "",
}) {
  const what = missionTitle ? `« ${missionTitle} »` : "la mission"
  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Mission terminée</Heading>

          <Text style={text}>Bonjour,</Text>

          <Text style={text}>
            {studentName} indique avoir terminé {what}. Vérifiez le travail puis confirmez la fin
            depuis votre espace.
            {paymentsEnabled() ? " Les fonds restent en séquestre jusqu'à votre validation." : ""}
          </Text>

          <Button href={`${APP_URL}${clientMissionHref(missionId)}`} style={button}>
            Ouvrir la mission →
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
