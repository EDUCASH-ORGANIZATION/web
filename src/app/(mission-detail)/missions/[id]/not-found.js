import { VitrineNotFound } from "@/components/vitrine/shared/vitrine-not-found"

export default function MissionNotFound() {
  return (
    <VitrineNotFound
      title="Mission introuvable"
      text="Cette mission n'existe pas, ou elle a été retirée. Retrouve les missions ouvertes en ce moment."
      backHref="/missions"
      backLabel="Voir les missions"
    />
  )
}
