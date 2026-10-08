import Link from "next/link"

// Pied de page public de la vitrine (design system Direction A, maquette V01).
export function VitrineFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <img className="logo" src="/logo-horizontal-blanc.svg" alt="EduCash" />
          <p className="site-footer__pitch">Des petites missions.<br /><span>Du vrai cash.</span></p>
        </div>
        <div className="site-footer__col">
          <h4>Étudiants</h4>
          <Link href="/missions">Trouver une mission</Link>
          <Link href="/#etapes">Comment ça marche</Link>
          <Link href="/auth/register?role=student">Se faire vérifier</Link>
        </div>
        <div className="site-footer__col">
          <h4>Clients</h4>
          <Link href="/clients">Publier une mission</Link>
          <Link href="/aide#sequestre">Le séquestre</Link>
          <Link href="/clients">Pour les clients</Link>
        </div>
        <div className="site-footer__col">
          <h4>EduCash</h4>
          <Link href="/about">À propos</Link>
          <Link href="/aide">Aide et FAQ</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div className="site-footer__col">
          <h4>Légal</h4>
          <Link href="/legal/mentions">Mentions légales</Link>
          <Link href="/legal/privacy">Confidentialité</Link>
          <Link href="/legal/terms">CGU</Link>
        </div>
      </div>
      <div className="site-footer__pay">
        Paiements opérés par
        <span className="payer payer--fedapay"><span className="payer__mark">F</span>FedaPay</span>
        <span className="payer payer--mtn"><span className="payer__mark">MTN</span>MTN MoMo</span>
        <span className="payer payer--moov"><span className="payer__mark">M</span>Moov Money</span>
        <span className="grow" />
        Commission unique de 12 %, prélevée sur le paiement de l'étudiant
      </div>
      <div className="site-footer__legal">
        <span>© 2026 EduCash · Cotonou, Bénin</span>
        <span>Fait pour les étudiants de Cotonou, Abomey-Calavi et Porto-Novo</span>
      </div>
    </footer>
  )
}