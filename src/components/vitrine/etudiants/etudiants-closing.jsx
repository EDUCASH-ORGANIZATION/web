import { CtaDouble } from "@/components/vitrine/shared/cta-double"
import { familyAction, studentAction } from "./etudiants-cta"

// Double appel à l'action de /etudiants : carte étudiante (tutoyée) et carte destinée aux familles
// et entreprises (vouvoyée, renvoie vers l'accueil).
export function EtudiantsClosing({ role }) {
  const student = studentAction(role)
  const family = familyAction(role)
  return (
    <CtaDouble
      student={{
        title: (
          <>
            Ton temps<br />vaut de l&rsquo;argent.<br />Prouve-le.
          </>
        ),
        text: "Crée ton profil gratuitement, postule près de ta fac et encaisse sur ton MoMo.",
        href: student.href,
        label: student.label,
        secondary: role === "student" || role === "client" ? undefined : { href: "/missions", label: "Voir les missions" },
        badge: role ? undefined : { value: "0 FCFA", caption: "pour t'inscrire" },
      }}
      client={{
        tag: "Familles et entreprises",
        title: (
          <>
            Vous avez<br /><span className="hl-citron">une mission à confier&nbsp;?</span>
          </>
        ),
        text: "Le marché, les devoirs des enfants, vos documents à mettre en forme : tout est expliqué sur la page d'accueil.",
        href: family.href,
        label: family.label,
      }}
    />
  )
}
