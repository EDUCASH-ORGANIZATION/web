import { COMMISSION_RATE, netAmount } from "@/lib/constants/missions"
import { formatFcfa } from "@/lib/vitrine/format"

const COMMISSION = Math.round(COMMISSION_RATE * 100)
const SHARE = 100 - COMMISSION
const BILL_BUDGET = 25000

// Exemples de budgets, à titre indicatif : le net vient de netAmount().
const EXAMPLES = [
  { label: "Marché du samedi à Dantokpa", budget: 5000 },
  { label: "Cours de maths, 8 séances", budget: 25000 },
  { label: "200 fiches clients à mettre en forme", budget: 15000 },
]

// « Tes gains » (maquette V05 v3) : pourcentages et montants calculés depuis COMMISSION_RATE.
export function EtudiantsGains() {
  const net = netAmount(BILL_BUDGET)
  return (
    <section className="section" id="gains">
      <div className="v05-split">
        <div className="stack stack--6">
          <span className="eyebrow eyebrow--bleu">Tes gains</span>
          <h2 className="display display--l">
            {SHARE} % pour toi.<br /><span className="hl-bleu">Affiché d&rsquo;avance.</span>
          </h2>
          <p className="body-l">
            EduCash prend une commission unique de {COMMISSION} % sur le budget du client. Tout le reste est pour toi,
            et tu le vois sur chaque mission avant de postuler.
          </p>
          <p className="muted">
            Inscription gratuite. Pas d&rsquo;abonnement. Tu n&rsquo;avances jamais d&rsquo;argent, même pour le marché.
          </p>
        </div>
        <div className="v05-bill">
          <div className="v05-bill__total">
            <span className="ds-h3">Le client publie</span>
            <span className="amount amount--xl">{formatFcfa(BILL_BUDGET)}</span>
          </div>
          <div className="v05-bar">
            <div className="v05-bar__etu">
              {formatFcfa(net)}
              <small>{SHARE} % pour toi</small>
            </div>
            <div className="v05-bar__edu">
              {COMMISSION} %
              <small>{formatFcfa(BILL_BUDGET - net)}</small>
            </div>
          </div>
          <div className="recap">
            {EXAMPLES.map(({ label, budget }) => (
              <div className="recap__line" key={label}>
                <span>{label} · budget {formatFcfa(budget)}</span>
                <b>Tu touches {formatFcfa(netAmount(budget))}</b>
              </div>
            ))}
          </div>
          <p className="caption muted">
            Exemples de budgets, à titre indicatif. Le montant que tu touches est affiché sur chaque mission, avant de
            postuler.
          </p>
        </div>
      </div>
    </section>
  )
}
