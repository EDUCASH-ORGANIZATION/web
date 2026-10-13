// En-tête de page : date ou fil, UNIQUE titre h1 en Anton, actions à droite.
export function PageHead({ date, title, actions }) {
  return (
    <div className="head2">
      <div>
        {date ? <div className="head2__date">{date}</div> : null}
        <h1 className="head2__title">{title}</h1>
      </div>
      {actions ? <div className="detail-head__actions">{actions}</div> : null}
    </div>
  )
}

export default PageHead
