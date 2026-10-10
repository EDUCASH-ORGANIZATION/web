import Link from "next/link"
import { COMMISSION_RATE } from "@/lib/constants/missions"
import { publishHref } from "@/lib/utils/publish-prefill"
import { FooterLink } from "./footer-link"
import { PayerOperators } from "./shared/payers"

const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100)

// Pied de page public de la vitrine (design system Direction A, maquette V01).
// audience : « clients » (défaut) ou « etudiants », qui change l'accroche et le lien « Comment ça marche ».
export function VitrineFooter({ audience = "clients" }) {
  const forStudents = audience === "etudiants"
  return (
    <footer className="ds site-footer">
      <nav className="site-footer__top" aria-label="Pied de page">
        <div className="site-footer__brand">
          <img className="logo" src="/logo-horizontal-blanc.svg" alt="EduCash" width={171} height={32} />
          {forStudents ? (
            <p className="site-footer__pitch">Des petites missions.<br /><span>Du vrai cash.</span></p>
          ) : (
            <p className="site-footer__pitch">Déléguez.<br /><span>Respirez.</span></p>
          )}
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">Familles et entreprises</h2>
          <Link href={publishHref()}>Publier une mission</Link>
          {forStudents ? null : <FooterLink href="/#etapes">Comment ça marche</FooterLink>}
          <FooterLink href="/#services">Services</FooterLink>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">Étudiants</h2>
          <FooterLink href="/etudiants">Pour les étudiants</FooterLink>
          {forStudents ? <FooterLink href="/etudiants#etapes">Comment ça marche</FooterLink> : null}
          <FooterLink href="/missions">Trouver une mission</FooterLink>
          <Link href="/auth/register?role=student">Se faire vérifier</Link>
        </div>
        <div className="site-footer__col">
          <h2 className="site-footer__title">EduCash</h2>
          <FooterLink href="/about">À propos</FooterLink>
          <FooterLink href="/aide">Aide et FAQ</FooterLink>
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
        Paiement Mobile Money
        <PayerOperators />
        <span className="ds-grow" />
        {`Commission unique de ${COMMISSION_PERCENT} %, incluse dans le budget`}
      </div>
      <div className="site-footer__legal">
        <span>© 2026 EduCash, édité par BRANDYBEN · Cotonou, Bénin</span>
      </div>
    </footer>
  )
}
