// Composants d'affichage partagés de l'espace connecté : rendu statique, états, accessibilité, citron.
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { missionStatusView } from "@/lib/app/mission-status"
import { applicationStatusView } from "@/lib/app/application-status"
import { StatusBadge } from "./status-badge"
import { Amount, splitAmount } from "./amount"
import { MoneyCard } from "./money-card"
import { Stat, StatGroup } from "./stats"
import { Item, ItemList } from "./item-list"
import { EmptyState, ErrorState, retry } from "./state-block"
import { SkeletonHero, SkeletonRows, SkeletonStats } from "./skeletons"
import { PageHead } from "./page-head"
import { Avatar, initialsOf } from "./avatar"
import { SectionCard } from "./section-card"
import { Lines } from "./lines"
import { HeroDecision } from "./hero-decision"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const html = (node) => renderToStaticMarkup(node)
const THIN = "\u202F"
const NBSP = "\u00A0"
const MINUS = "−"

describe("StatusBadge", () => {
  it("rend le libellé et le ton de missionStatusView", () => {
    const view = missionStatusView({ status: "in_progress" }, "2026-10-08")
    const out = html(<StatusBadge {...view} />)
    expect(out).toContain("badge badge--bleu badge--sm")
    expect(out).toContain("En cours")
  })

  it("rend le ton de applicationStatusView", () => {
    expect(html(<StatusBadge {...applicationStatusView("accepted")} />)).toContain("badge--succes")
    expect(html(<StatusBadge {...applicationStatusView("pending")} />)).toContain("badge--alerte")
  })

  it("n'émet jamais citron, même si le ton le demande", () => {
    const out = html(<StatusBadge label="X" tone="citron" />)
    expect(out).not.toContain("citron")
    expect(out).toContain("badge--neutre")
  })
})

describe("Amount et formatage", () => {
  it("47 600 avec espace fine insécable et unité en petit", () => {
    const out = html(<Amount value={47600} />)
    expect(out).toContain(`47${THIN}600<small>FCFA</small>`)
    expect(out).toContain("amount amount--m")
  })

  it("débit avec un vrai signe moins, crédit avec plus et couleur de succès", () => {
    expect(html(<Amount value={500} sign="debit" size="s" />)).toContain(`${MINUS}500`)
    const credit = html(<Amount value={500} sign="credit" />)
    expect(credit).toContain("+500")
    expect(credit).toContain("amount--plus")
    expect(html(<Amount value={500} sign="debit" />)).not.toContain("-500")
  })

  it("splitAmount sépare chiffres et unité", () => {
    expect(splitAmount(1200)).toEqual({ text: `1${THIN}200`, unit: "FCFA" })
    expect(NBSP).not.toBe(THIN)
  })
})

describe("Stat et StatGroup", () => {
  it("rend un groupe de stats avec montant et valeur libre", () => {
    const out = html(
      <StatGroup label="Missions">
        <Stat label="Disponible" amount={12500} sub="pour publier" />
        <Stat label="Actives" value={4} />
      </StatGroup>,
    )
    expect(out).toContain('class="stats2" aria-label="Missions"')
    expect(out).toContain(`12${THIN}500<small>FCFA</small>`)
    expect(out).toContain('<span class="stat2__value">4</span>')
    expect(out).toContain("stat2__sub")
  })
})

describe("MoneyCard", () => {
  it("variante partagée : bleue, disponible et séquestre, bouton blanc en tête", () => {
    const out = html(
      <MoneyCard title="Votre argent" available={12500} escrow={54000} action={{ label: "Recharger", href: "/client/wallet", icon: "i-plus" }} />,
    )
    expect(out).toContain("money2 money2--split")
    expect(out).toContain("Disponible")
    expect(out).toContain("En séquestre")
    expect(out).toContain(`54${THIN}000`)
    expect(out).toContain("btn btn--blanc btn--sm")
    expect(out).not.toContain("money2__foot")
  })

  it("pied avec action, action secondaire et mention", () => {
    const out = html(
      <MoneyCard
        available={1}
        escrow={2}
        actionIn="foot"
        action={{ label: "Recharger", href: "/a" }}
        secondaryAction={{ label: "Retirer", href: "/b" }}
        hint="Retrait sous 48 h"
      />,
    )
    expect(out).toContain("money2__foot")
    expect(out).toContain("btn--ghost-blanc")
    expect(out).toContain("money2__hint")
  })

  it("variante simple : chiffre en FCFA et sans bouton par défaut", () => {
    const out = html(<MoneyCard label="Solde" amount={9000} note="en séquestre" />)
    expect(out).toContain("hero2__figure")
    expect(out).toContain(`9${THIN}000<small>FCFA</small>`)
    expect(out).not.toContain("<a ")
    expect(out).not.toContain("<button")
  })
})

describe("ItemList et Item", () => {
  it("liste avec titre, compteur, lien et rangées accessibles", () => {
    const out = html(
      <ItemList title="À traiter" count={2} more={{ href: "/client/missions", label: "Tout voir" }}>
        <Item icon="i-users" title="Traduire un flyer" subtitle="3 candidatures" meta="Depuis le 6 oct." action={{ href: "/client/missions/1", label: "Examiner" }} />
        <Item title="Cours" muted />
      </ItemList>,
    )
    expect(out).toContain('<h2 class="list2__title">À traiter<span>2</span></h2>')
    expect(out).toContain('role="list"')
    expect(out).toContain('role="listitem"')
    expect(out).toContain("item2__ic")
    expect(out).toContain('aria-label="Examiner : Traduire un flyer"')
    expect(out).toContain("item2 item2--muted")
    expect(out).toContain('href="/client/missions"')
  })

  it("variante mission : badge, montant avec mention, actions groupées", () => {
    const out = html(
      <Item
        variant="mission"
        title="Garde"
        line={<StatusBadge label="Échéance dépassée" tone="erreur" />}
        amount={6000}
        amountNote="en séquestre"
        actions={[{ href: "/a", label: "Annuler" }, { href: "/b", label: "Prolonger" }]}
      />,
    )
    expect(out).toContain("item2 item2--mission")
    expect(out).toContain("item2__line")
    expect(out).toContain(`6${THIN}000<small>FCFA</small><span>en séquestre</span>`)
    expect(out).toContain("item2__cell")
  })
})

describe("États vide, erreur, chargement", () => {
  it("vide : texte et lien, sans alerte", () => {
    const out = html(<EmptyState icon="i-book" title="Aucune mission" text="Publiez-en une." action={{ href: "/client/missions/new", label: "Rédiger" }} compact />)
    expect(out).toContain("empty2 empty2--sm")
    expect(out).toContain("Aucune mission")
    expect(out).toContain('href="/client/missions/new"')
    expect(out).not.toContain('role="alert"')
    expect(out).not.toContain("Réessayer")
  })

  it("erreur : alerte, pictogramme d'erreur et bouton Réessayer", () => {
    const out = html(<ErrorState />)
    expect(out).toContain('role="alert"')
    expect(out).toContain("empty2__ic--erreur")
    expect(out).toContain("Réessayer")
    expect(out).toContain("fonds ne sont pas touchés")
  })

  it("retry appelle le callback puis router.refresh", () => {
    const order = []
    retry({ refresh: () => order.push("refresh") }, () => order.push("cb"))
    expect(order).toEqual(["cb", "refresh"])
    const router = { refresh: vi.fn() }
    retry(router)
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it("squelettes : statut annoncé, dimensions par classes du système", () => {
    expect(html(<SkeletonHero />)).toContain("skel skel2-hero")
    expect(html(<SkeletonStats />)).toContain("skel skel2-stats")
    const rows = html(<SkeletonRows count={3} />)
    expect(rows.match(/skel2-row/g)).toHaveLength(3)
    expect(rows).toContain('role="status"')
    expect(rows).toContain('aria-busy="true"')
    expect(rows).toContain("Chargement en cours")
  })
})

describe("PageHead, SectionCard, Lines", () => {
  it("un seul h1 en classe head2__title, date et actions", () => {
    const out = html(<PageHead date="Jeudi 8 octobre" title="Bonjour, Rosine" actions={<a href="/x">Publier</a>} />)
    expect(out.match(/<h1/g)).toHaveLength(1)
    expect(out).toContain('class="head2__title"')
    expect(out).toContain("head2__date")
    expect(out).toContain("detail-head__actions")
  })

  it("carte : titre h2 relié par aria-labelledby, variante flush", () => {
    const out = html(<SectionCard title="Total dépensé" count={8} flush>contenu</SectionCard>)
    expect(out).toContain("card2 card2--flush")
    expect(out).toMatch(/aria-labelledby="([^"]+)"/)
    const id = out.match(/aria-labelledby="([^"]+)"/)[1]
    expect(out).toContain(`id="${id}"`)
    expect(out).toContain("<h2")
  })

  it("lignes : montants formatés, débit avec vrai moins, total en gras", () => {
    const out = html(
      <Lines rows={[{ label: "Séquestre", value: 15000 }, { label: "Frais", value: 1800, sign: "debit" }]} total={{ label: "Total", value: 13200 }} />,
    )
    expect(out).toContain(`15${THIN}000${NBSP}FCFA`)
    expect(out).toContain(`${MINUS}1${THIN}800${NBSP}FCFA`)
    expect(out).toContain("lines2__row lines2__row--total")
  })
})

describe("Avatar", () => {
  it("initiales sur av2, libellé accessible", () => {
    const out = html(<Avatar name="Rosine Houngbédji" />)
    expect(out).toContain('class="av2" role="img" aria-label="Rosine Houngbédji"')
    expect(out).toContain(">RH<")
  })

  it("photo via next/image avec alt", () => {
    const out = html(<Avatar name="Nadège Ayi" src="https://abc.supabase.co/storage/v1/object/public/avatars/u/a.jpg" />)
    expect(out).toContain("<img")
    expect(out).toContain('alt="Nadège Ayi"')
  })

  it("badge vérifié via le symbole seal, annoncé dans le libellé", () => {
    const out = html(<Avatar name="Afiavi Dossou" verified size="sm" />)
    expect(out).toContain("av2 av2--sm")
    expect(out).toContain("#seal")
    expect(out).toContain("profil vérifié")
  })

  it("initialsOf : un mot, plusieurs mots, vide", () => {
    expect(initialsOf("sèna")).toBe("SÈ")
    expect(initialsOf("Jean Paul Kouassi")).toBe("JK")
    expect(initialsOf("  ")).toBe("?")
    expect(initialsOf(null)).toBe("?")
  })
})

describe("HeroDecision", () => {
  const base = { label: "En attente de votre décision", figure: 3, metaLines: [{ count: 1, text: "fin à confirmer" }, { count: 2, text: "candidatures" }] }

  it("flag citron seulement si une action est due, bouton encre", () => {
    const out = html(
      <HeroDecision {...base} flag={{ label: "À décider en premier", icon: "i-clock" }} title="Nadège a terminé" text="Vérifiez." action={{ label: "Confirmer la fin", href: "/c", icon: "i-check-circle" }} secondary={{ label: "Signaler", href: "/s" }} />,
    )
    expect(out).toContain('class="flag2"')
    expect(out).toContain("btn btn--dark")
    expect(out).toContain("hero2__link")
    expect(out.match(/<h2/g)).toHaveLength(1)
    expect(out).toContain("<b>1</b> fin à confirmer<br/>")
  })

  it("rien à décider : étiquette neutre et aucun bouton", () => {
    const out = html(<HeroDecision label="Décisions" figure={0} flag={{ label: "Rien à faire", due: false }} title="Tout est à jour" />)
    expect(out).toContain("flag2 flag2--neutre")
    expect(out).not.toContain("btn--dark")
  })

  it("chiffre clé en montant", () => {
    expect(html(<HeroDecision label="Solde" figureAmount={66500} />)).toContain(`66${THIN}500<small>FCFA</small>`)
  })
})

describe("citron et couleurs", () => {
  it("aucun composant n'émet citron hors flag2", () => {
    const all = html(
      <>
        <StatusBadge label="a" tone="citron" />
        <Amount value={1} />
        <MoneyCard available={1} escrow={2} action={{ label: "R", href: "/" }} />
        <StatGroup label="s"><Stat label="x" value={1} /></StatGroup>
        <ItemList title="t"><Item title="i" /></ItemList>
        <EmptyState title="v" />
        <ErrorState />
        <SkeletonHero />
        <PageHead title="t" />
        <Avatar name="A B" verified />
        <SectionCard title="t">c</SectionCard>
        <Lines rows={[{ label: "a", value: 1 }]} />
        <HeroDecision label="l" figure={1} flag={{ label: "f" }} />
      </>,
    )
    expect(all.replace(/flag2(?:--neutre)?/g, "")).not.toMatch(/citron/)
    expect(all).not.toMatch(/style=/)
  })
})
