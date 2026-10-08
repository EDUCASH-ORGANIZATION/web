import { VitrineNotFound } from "@/components/vitrine/shared/vitrine-not-found"

export default function TalentNotFound() {
  return (
    <VitrineNotFound
      title="Ce profil est introuvable"
      text="Le lien est peut-être erroné, ou ce profil n'est plus public."
      backHref="/missions"
      backLabel="Voir les missions"
    />
  )
}
