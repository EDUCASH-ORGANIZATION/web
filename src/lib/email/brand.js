// Identité EduCash pour les emails Resend (charte graphique v1.0).
// Source unique des couleurs, de la police, des logos et des styles communs :
// les gabarits n'écrivent aucune couleur en dur.
// Règles : le vert ne sert jamais de texte sur fond clair (1,35:1 sur blanc),
// le logo n'est jamais retapé en texte, largeur affichée >= 150 px.

// Hôte canonique : https://educash.bj redirige (307) vers www, et certains clients mail
// ne suivent pas la redirection (logo absent). Un hôte nu configuré en variable est donc ramené à www.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.educash.bj")
  .replace(/\/$/, "")
  .replace(/^https:\/\/educash\.bj(?=\/|$)/, "https://www.educash.bj")

export const COLORS = {
  bleu: "#1028F0",
  vert: "#C1EE3E",
  encre: "#17213A",
  brume: "#F3F5FC",
  blanc: "#FFFFFF",
  // Texte secondaire sur clair (10,55:1 sur blanc, 9,68:1 sur brume)
  ardoise: "#3A3E52",
  ligne: "#E3E5EE",
  // Pastels sémantiques de la charte (texte encre dessus, contraste >= 12:1)
  lavande: "#E6E9FF",
  menthe: "#CDF0DC",
  rose: "#FFD6DE",
  peche: "#FFE4C7",
}

// Police d'origine des emails : Arial (les clients mail ne chargent pas de police web).
export const FONT_FAMILY = "Arial, sans-serif"

export const LOGO_WIDTH = 160
export const LOGO_HEIGHT = 39

export const LOGO_URLS = {
  bleu: `${APP_URL}/email/educash-logo-bleu.png`,
  blanc: `${APP_URL}/email/educash-logo-blanc.png`,
}

/** Propriétés de <Img> pour le logo (bleu sur fond clair, blanc sur fond bleu). */
export function logoProps(variant = "bleu") {
  return {
    src: LOGO_URLS[variant],
    alt: "EduCash",
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    style: { display: "block", border: 0, outline: "none", textDecoration: "none", margin: "0 0 24px" },
  }
}

export const styles = {
  body: { backgroundColor: COLORS.brume, fontFamily: FONT_FAMILY, margin: 0, padding: "24px 0" },
  container: {
    backgroundColor: COLORS.blanc,
    margin: "0 auto",
    padding: "32px",
    borderRadius: "12px",
    maxWidth: "520px",
  },
  h1: { color: COLORS.encre, fontSize: "22px", fontWeight: "700", lineHeight: "1.3", margin: "0 0 8px" },
  text: { color: COLORS.encre, fontSize: "15px", lineHeight: "1.6", margin: "12px 0" },
  secondary: { color: COLORS.ardoise, fontSize: "14px", lineHeight: "1.55", margin: "0 0 12px" },
  button: {
    backgroundColor: COLORS.bleu,
    color: COLORS.blanc,
    padding: "12px 24px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "700",
    textDecoration: "none",
    display: "inline-block",
    margin: "16px 0",
  },
  hr: { borderColor: COLORS.ligne, margin: "24px 0" },
  footer: { color: COLORS.ardoise, fontSize: "12px", textAlign: "center", margin: 0 },
}
