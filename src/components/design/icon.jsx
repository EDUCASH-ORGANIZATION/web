// EduCash - icône SVG inline, référence un <symbol> du sprite global
// monté par <DesignSprite/> dans le layout racine.
// Usage : <Icon name="i-search" /> → <svg class="ic"><use href="#i-search"/></svg>

export function Icon({ name, className = "ic" }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`#${name}`} />
    </svg>
  )
}

export default Icon
