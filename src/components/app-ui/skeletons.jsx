// Squelettes de chargement fidèles à la v2.1. Chaque bloc est annoncé « Chargement » aux lecteurs d'écran.

function Busy({ children }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement en cours</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

export function SkeletonHero() {
  return (
    <Busy>
      <div className="skel skel2-hero" />
    </Busy>
  )
}

export function SkeletonStats() {
  return (
    <Busy>
      <div className="skel skel2-stats" />
    </Busy>
  )
}

export function SkeletonRows({ count = 4 }) {
  return (
    <Busy>
      <div className="col2">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skel skel2-row" />
        ))}
      </div>
    </Busy>
  )
}
