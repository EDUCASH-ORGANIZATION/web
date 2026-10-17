import { Html, Body, Container, Text, Heading, Hr, Img, Link } from "@react-email/components"
import { logoProps, styles } from "@/lib/email/brand"

const CONTACT = "contact@educash.bj"

/**
 * Date limite lisible en français (fuseau du Bénin). Valeur absente ou invalide : null, le texte reste neutre.
 *
 * @param {string | number | Date | null | undefined} value
 * @returns {string | null}
 */
function formatDeadline(value) {
  if (value === null || value === undefined || value === "") return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Porto-Novo",
  }).format(date)
}

/**
 * Confirmation de fermeture d'un compte. Aucun montant, aucun lien de connexion : la réactivation se demande par
 * écrit à l'équipe.
 *
 * @param {{
 *   name?: string,
 *   reactivationDeadline?: string | number | Date | null,
 * }} props `reactivationDeadline` : date limite de réactivation, reçue en donnée.
 */
export default function AccountClosed({ name = "", reactivationDeadline = null }) {
  const firstName = typeof name === "string" ? name.trim().split(" ")[0] : ""
  const deadline = formatDeadline(reactivationDeadline)

  return (
    <Html lang="fr">
      <Body style={body}>
        <Container style={container}>
          <Img {...logoProps()} />

          <Heading style={h1}>Votre compte EduCash est fermé</Heading>

          <Text style={text}>{firstName ? `Bonjour ${firstName},` : "Bonjour,"}</Text>

          <Text style={text}>
            Votre compte EduCash a été fermé. L’accès à votre espace est désormais coupé.
          </Text>

          <Text style={text}>
            {deadline
              ? `Vous pouvez demander la réactivation de votre compte jusqu’au ${deadline}.`
              : "Vous pouvez demander la réactivation de votre compte pendant le délai de grâce."}{" "}
            Pour cela, écrivez-nous à <Link href={`mailto:${CONTACT}`}>{CONTACT}</Link> : la réactivation se fait
            sur demande, après examen par l’équipe.
          </Text>

          <Text style={text}>
            À l’issue de ce délai, les données personnelles de votre compte seront effacées : votre nom, vos
            coordonnées, votre photo et votre carte étudiante. La réactivation ne sera alors plus possible.
          </Text>

          <Text style={text}>
            Certaines informations restent conservées : les données comptables pendant 10 ans, les demandes
            d’achats, ainsi que vos messages et vos avis, qui apparaîtront sous la mention « Compte clôturé ».
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
