import Link from "next/link"
import { FooterLink } from "./footer-link"

// Pied de page public de la vitrine (design system Direction A, maquette V01).
export function VitrineFooter() {
  return (
    <footer className="ds site-footer">
      <nav className="site-footer__top" aria-label="Pied de page">
        <div className="site-footer__brand">
          <img className="logo" src="/logo-horizontal-blanc.svg" alt="EduCash" width={171} height={32} />
          <p className="site-footer__pitch">Des petites missions.<br /><span>Du vrai cash.</span></p>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">Étudiants</h2>
          <FooterLink href="/missions">Trouver une mission</FooterLink>
          <FooterLink href="/#etapes">Comment ça marche</FooterLink>
          <Link href="/auth/register?role=student">Se faire vérifier</Link>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">Clients</h2>
          <Link href="/auth/register?role=client">Publier une mission</Link>
          <FooterLink href="/aide#sequestre">Le séquestre</FooterLink>
          <FooterLink href="/clients">Pour les clients</FooterLink>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">EduCash</h2>
          <FooterLink href="/about">À propos</FooterLink>
          <FooterLink href="/aide">Aide</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">Légal</h2>
          <FooterLink href="/legal/mentions">Mentions légales</FooterLink>
          <FooterLink href="/legal/privacy">Confidentialité</FooterLink>
          <FooterLink href="/legal/terms">CGU</FooterLink>
        </div>
      </nav>
      <div className="site-footer__pay">
        Paiements opérés par
        <span className="payer payer--fedapay"><span className="payer__mark">F</span>FedaPay</span>
        <span className="payer payer--mtn"><span className="payer__mark">MTN</span>MTN MoMo</span>
        <span className="payer payer--moov"><span className="payer__mark">M</span>Moov Money</span>
        <span className="ds-grow" />
        Commission unique de 12 %, prélevée sur le paiement de l’étudiant
      </div>
      <div className="site-footer__legal">
        <span>© 2026 EduCash · Cotonou, Bénin</span>
        <span>Fait pour les étudiants de Cotonou, Abomey-Calavi et Porto-Novo</span>
      </div>
    </footer>
  )
}