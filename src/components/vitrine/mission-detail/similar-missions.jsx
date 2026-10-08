import Link from "next/link"
import { MissionCard } from "@/components/vitrine/mission-card"

/**
 * Bloc « Missions similaires » (jusqu'à 3 cartes du même type).
 * @param {{ missions: Array<object>, type: string }} props
 */
export function SimilarMissions({ missions, type }) {
  if (!missions || missions.length === 0) return null
  return (
    <section aria-labelledby="similaires">
      <div className="block-title">
        <h2 id="similaires">Missions similaires</h2>
        <Link href={`/missions?type=${encodeURIComponent(type)}`}>Toutes les missions de ce type</Link>
      </div>
      <div className="v03-similar">
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    </section>
  )
}
