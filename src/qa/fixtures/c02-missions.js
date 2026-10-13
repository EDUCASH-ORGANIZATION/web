// Fixtures de captures C02 Mes missions (ST-08). Chaque état est la valeur `result` de ClientMissionsView
// (réponse de getClientMissions). Aucune donnée réelle.
// États : open-overdue, in-progress, done, cancelled, empty-open, empty-in_progress, empty-done,
// empty-cancelled, search-hit, search-none, search-elsewhere, error.
// Le chargement s'obtient avec <ClientMissionsSkeleton />.
const TODAY = "2026-10-13"
const base = { today: TODAY, q: "" }
const m = (over) => ({
  id: "m0", title: "", type: "Autre", city: "Cadjèhoun, Cotonou", budget: 0, deadline: null, status: "open",
  createdAt: "2026-10-01T10:00:00Z", overdue: false, applicationsCount: 0, pendingCount: 0, studentId: null, reviewed: false, ...over,
})
const counts = { open: 2, in_progress: 2, done: 8, cancelled: 1 }

export const states = {
  "open-overdue": { ...base, onglet: "open", counts, total: 13, missions: [
    m({ id: "m1", title: "Garde de deux enfants samedi soir", type: "Babysitting", budget: 6000, deadline: "2026-10-03", overdue: true }),
    m({ id: "m2", title: "Traduire un flyer en anglais", type: "Traduction", budget: 8000, deadline: "2026-10-15", applicationsCount: 3, pendingCount: 3 }),
  ] },
  "in-progress": { ...base, onglet: "in_progress", counts, total: 13, missions: [
    m({ id: "m3", title: "Saisie de 200 fiches clients", type: "Saisie", budget: 15000, deadline: "2026-10-09", status: "in_progress", studentId: "s1" }),
    m({ id: "m4", title: "Cours de maths niveau 3e", type: "Cours particuliers", budget: 25000, deadline: "2026-10-24", status: "in_progress", studentId: "s2" }),
  ] },
  done: { ...base, onglet: "done", counts, total: 13, missions: [
    m({ id: "m5", title: "Garde d'enfants mercredi après-midi", type: "Babysitting", budget: 10000, status: "done", studentId: "s3" }),
    m({ id: "m6", title: "Inventaire du stock de pagnes", type: "Saisie", budget: 12000, status: "done", studentId: "s2", reviewed: true }),
  ] },
  cancelled: { ...base, onglet: "cancelled", counts, total: 13, missions: [
    m({ id: "m7", title: "Livrer 12 colis entre Ganhi et Cadjèhoun", type: "Livraison", budget: 6000, status: "cancelled" }),
  ] },
  "empty-open": { ...base, onglet: "open", counts: { open: 0, in_progress: 0, done: 0, cancelled: 0 }, total: 0, missions: [] },
  "empty-in_progress": { ...base, onglet: "in_progress", counts: { ...counts, in_progress: 0 }, total: 11, missions: [] },
  "empty-done": { ...base, onglet: "done", counts: { ...counts, done: 0 }, total: 5, missions: [] },
  "empty-cancelled": { ...base, onglet: "cancelled", counts: { ...counts, cancelled: 0 }, total: 12, missions: [] },
  "search-hit": { ...base, onglet: "open", q: "flyer", counts: { open: 1, in_progress: 0, done: 0, cancelled: 0 }, total: 1, missions: [
    m({ id: "m2", title: "Traduire un flyer en anglais", type: "Traduction", budget: 8000, deadline: "2026-10-15", applicationsCount: 3, pendingCount: 3 }),
  ] },
  "search-none": { ...base, onglet: "open", q: "peinture", counts: { open: 0, in_progress: 0, done: 0, cancelled: 0 }, total: 0, missions: [] },
  "search-elsewhere": { ...base, onglet: "open", q: "garde", counts: { open: 0, in_progress: 0, done: 2, cancelled: 0 }, total: 2, missions: [] },
  error: { error: "Impossible de charger vos missions." },
}
