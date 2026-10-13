// Squelettes de chargement fidèles à la v2.1. Un seul bloc par page est annoncé « Chargement » aux lecteurs
// d'écran : les autres passent `announce={false}` et rendent un bloc nu `aria-hidden`.

function Busy({ announce = true, children }) {
  if (!announce) return <div aria-hidden="true">{children}</div>
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement en cours</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

export function SkeletonHero({ announce = true }) {
  return (
    <Busy announce={announce}>
      <div className="skel skel2-hero" />
    </Busy>
  )
}

export function SkeletonStats({ announce = true }) {
  return (
    <Busy announce={announce}>
      <div className="skel skel2-stats" />
    </Busy>
  )
}

export function SkeletonRows({ count = 4, announce = true }) {
  return (
    <Busy announce={announce}>
      <div className="col2">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skel skel2-row" />
        ))}
      </div>
    </Busy>
  )
}
