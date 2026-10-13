// Fixtures de captures C01 Tableau de bord (ST-07). Chaque état est l'objet de props de ClientDashboardView :
// { data | error, today, paymentsEnabled } (data = DashboardData de getClientDashboard). Aucune donnée réelle.
// États : decisions, decisions-paiements-coupes, decision-unique, nouveau-client, nouveau-client-coupes,
// solde-insuffisant, solde-insuffisant-coupes, echeance-depassee, tout-a-jour, erreur.
// Le chargement s'obtient avec le default export de dashboard/loading.js.
const TODAY = "2026-10-13"
const m = (over) => ({
  id: "m0", title: "", status: "open", budget: 0, deadline: null, createdAt: "2026-10-01T10:00:00Z",
  studentName: null, pendingCount: 0, oldestPendingAt: null, ...over,
})
const base = { firstName: "Rosine", wallet: { available: 12500, escrow: 54000 }, totalMissions: 12, active: [], toReview: [] }

const withDecisions = {
  ...base,
  active: [
    m({ id: "m1", title: "Traduire un flyer en anglais", budget: 8000, deadline: "2026-10-25", pendingCount: 3, oldestPendingAt: "2026-10-06T09:00:00Z" }),
    m({ id: "m2", title: "Garde de deux enfants samedi soir", budget: 6000, deadline: "2026-10-03" }),
    m({ id: "m3", title: "Cours de maths niveau 3e", budget: 25000, status: "in_progress", studentName: "Sèna", createdAt: "2026-09-20T10:00:00Z" }),
    m({ id: "m4", title: "Saisie de 200 fiches clients", budget: 15000, status: "in_progress", studentName: "Nadège", createdAt: "2026-09-25T10:00:00Z" }),
  ],
  toReview: [{ id: "d1", title: "Livraison de documents à Ganhi", studentName: "Koffi" }],
}

export const states = {
  decisions: { data: withDecisions, today: TODAY, paymentsEnabled: true },
  "decisions-paiements-coupes": { data: withDecisions, today: TODAY, paymentsEnabled: false },
  "decision-unique": {
    data: { ...base, active: [withDecisions.active[3]] },
    today: TODAY, paymentsEnabled: true,
  },
  "nouveau-client": { data: { ...base, wallet: { available: 0, escrow: 0 }, totalMissions: 0 }, today: TODAY, paymentsEnabled: true },
  "nouveau-client-coupes": { data: { ...base, wallet: { available: 0, escrow: 0 }, totalMissions: 0 }, today: TODAY, paymentsEnabled: false },
  "solde-insuffisant": {
    data: { ...base, wallet: { available: 500, escrow: 8000 }, active: [withDecisions.active[0]] },
    today: TODAY, paymentsEnabled: true,
  },
  "solde-insuffisant-coupes": {
    data: { ...base, wallet: { available: 500, escrow: 8000 }, active: [withDecisions.active[0]] },
    today: TODAY, paymentsEnabled: false,
  },
  "echeance-depassee": {
    data: { ...base, wallet: { available: 12000, escrow: 6000 }, active: [withDecisions.active[1]] },
    today: TODAY, paymentsEnabled: true,
  },
  "tout-a-jour": {
    data: { ...base, active: [m({ id: "m5", title: "Cours d'anglais pour 2 enfants", budget: 18000, deadline: "2026-11-02" })] },
    today: TODAY, paymentsEnabled: true,
  },
  erreur: { error: "Impossible de charger votre tableau de bord.", today: TODAY, paymentsEnabled: true },
}
