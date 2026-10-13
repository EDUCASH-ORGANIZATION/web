// QA indépendante RD-CLIENT-01 : composants d'affichage ST-04 dans leurs états limites (rendu statique).
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup as r } from "react-dom/server"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/client/dashboard" }))
import { Avatar } from "@/components/app-ui/avatar"
import { Amount } from "@/components/app-ui/amount"
import { ItemList, Item } from "@/components/app-ui/item-list"
import { EmptyState } from "@/components/app-ui/empty-state"
import { ErrorState } from "@/components/app-ui/state-block"
import { SectionCard } from "@/components/app-ui/section-card"
import { Stat, StatGroup } from "@/components/app-ui/stats"
import { HeroDecision } from "@/components/app-ui/hero-decision"
import { MoneyCard } from "@/components/app-ui/money-card"
import { Lines } from "@/components/app-ui/lines"
import { PageHead } from "@/components/app-ui/page-head"
import { StatusBadge } from "@/components/app-ui/status-badge"
import { SkeletonHero, SkeletonStats, SkeletonRows } from "@/components/app-ui/skeletons"

const BAD = /undefined|NaN|\[object|null</
const XSS = '<img src=x onerror=alert(1)>'
const cases = {
  avatarEmpty: <Avatar name="" />, avatarNull: <Avatar name={null} verified />, avatarXss: <Avatar name={XSS} />,
  amountZero: <Amount value={0} />, amountNeg: <Amount value={-5} sign="debit" />, amountBig: <Amount value={12345678901} />,
  amountNaN: <Amount value={NaN} />, amountNull: <Amount value={null} />, amountFloat: <Amount value={1234.56} />,
  itemListEmpty: <ItemList title="M" count={0} />, itemListNoTitle: <ItemList>{[]}</ItemList>,
  itemMin: <ItemList title="x"><Item title="T" /></ItemList>, itemXss: <ItemList title="x"><Item title={XSS} subtitle={XSS} amount={10} /></ItemList>,
  itemMuted: <ItemList title="x"><Item title="T" muted amount={0} amountSign="credit" amountNote="n" action={{ href: "/a", label: "Go" }} /></ItemList>,
  empty: <EmptyState title="Rien" />, emptyCompact: <EmptyState title="R" text="t" compact titleAs="h2" action={{ label: "A", href: "/x" }} />,
  err: <ErrorState />, errCustom: <ErrorState title="E" text="t" />,
  section: <SectionCard title="S" />, sectionFlush: <SectionCard title="S" flush count={0} more={{ label: "m", href: "/m" }}>c</SectionCard>,
  stats: <StatGroup label="L"><Stat label="a" value="0" /><Stat label="b" amount={0} /><Stat label="c" amount={-1} sign="debit" sub="s" /></StatGroup>,
  statEmpty: <StatGroup label="L" />, statNoValue: <Stat label="a" />,
  hero: <HeroDecision title="T" />, heroFull: <HeroDecision label="l" ariaLabel="a" figureAmount={5000} metaLines={[{ count: 0, text: "x" }, { count: 2, text: "y" }]} flag={{ label: "f" }} title={XSS} text="t" action={{ label: "A", href: "/a" }} secondary={{ label: "B", href: "/b" }} />,
  money: <MoneyCard available={0} escrow={0} />, moneyFoot: <MoneyCard available={1} escrow={2} actionIn="foot" action={{ label: "R", href: "/w" }} secondaryAction={{ label: "S", href: "/s" }} hint="h" />,
  moneyNull: <MoneyCard available={null} escrow={undefined} />,
  lines: <Lines />, linesRows: <Lines rows={[{ label: "a", value: 0 }, { label: "b", value: -3, sign: "debit" }]} total={{ label: "T", value: 0 }} />,
  head: <PageHead title="T" />, headFull: <PageHead date="d" title={XSS} actions={<a href="/x">x</a>} />,
  badges: <>{["neutre", "bleu", "citron", "rouge", "vert", "zzz", undefined].map((t, i) => <StatusBadge key={i} label="L" tone={t} />)}</>,
  skel: <><SkeletonHero /><SkeletonHero announce={false} /><SkeletonStats /><SkeletonRows count={0} /><SkeletonRows count={1} announce={false} /></>,
}
describe("ST-04 états limites", () => {
  for (const [name, el] of Object.entries(cases)) {
    it(`${name} : rend sans exception, sans undefined/NaN et sans HTML injecté`, () => {
      const html = r(el)
      expect(html).toBeTypeOf("string")
      expect(html).not.toMatch(BAD)
      expect(html).not.toContain("<img src=x")
    })
  }
  it("skeleton announce=false : pas de texte de chargement", () => {
    expect(r(<SkeletonRows announce={false} />)).not.toContain("Chargement")
    expect(r(<SkeletonRows />)).toContain("Chargement")
  })
})
