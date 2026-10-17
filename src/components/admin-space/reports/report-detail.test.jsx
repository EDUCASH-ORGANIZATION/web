// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@/qa/dom/setup.test.support"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }))

const takeReport = vi.fn()
const resolveReport = vi.fn()
const dismissReport = vi.fn()
vi.mock("@/lib/actions/admin-reports.actions", () => ({
  takeReport: (...a) => takeReport(...a),
  resolveReport: (...a) => resolveReport(...a),
  dismissReport: (...a) => dismissReport(...a),
}))

const { ToastProvider } = await import("@/components/app-ui/toast")
const { ReportDetailView } = await import("./report-detail-view")
const { ReportDecisionDialog } = await import("./report-decision-dialog")

const RID = "20000000-0000-4000-8000-000000000001"
const REPORTED = "00000000-0000-4000-8000-000000000002"
const REPORTER = "00000000-0000-4000-8000-000000000001"
const MISSION = "10000000-0000-4000-8000-000000000001"

const report = (over = {}) => ({
  id: RID,
  reference: "SIG-0001",
  source: "user",
  reason: "scam",
  reasonLabel: "Arnaque ou demande d'argent",
  status: "open",
  createdAt: "2026-10-10T08:00:00Z",
  missionId: MISSION,
  missionTitle: "Aide au déménagement",
  reporter: { id: REPORTER, name: "Koffi C." },
  reported: { id: REPORTED, name: "Esther E." },
  handledBy: null,
  handledAt: null,
  targetType: "message",
  details: "Il demande de l'argent",
  resolutionNote: null,
  updatedAt: "2026-10-10T08:00:00Z",
  ...over,
})

const textMessage = { id: "m1", type: "text", text: "Appelez-moi au [coordonnées masquées]", mediaUrl: null, mediaAvailable: null, lat: null, lng: null, senderId: REPORTED, createdAt: "2026-10-09T08:00:00Z" }

const view = (data, error) =>
  render(
    <ToastProvider>
      <ReportDetailView data={data} error={error} />
    </ToastProvider>,
  )

beforeEach(() => {
  refresh.mockClear()
  takeReport.mockReset()
  resolveReport.mockReset()
  dismissReport.mockReset()
})

describe("détail : contenu", () => {
  it("signalement d'un utilisateur : référence en h1, motif, description, message masqué, mission et parties", () => {
    view({ report: report(), message: textMessage, events: null })
    expect(screen.getByRole("heading", { level: 1, name: "SIG-0001" })).toBeTruthy()
    expect(screen.getAllByText("Arnaque ou demande d'argent").length).toBeGreaterThan(0)
    expect(screen.getByText("Il demande de l'argent")).toBeTruthy()
    expect(screen.getByText("Appelez-moi au [coordonnées masquées]")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Aide au déménagement" }).getAttribute("href")).toBe(`/admin/missions/${MISSION}`)
    expect(screen.getByRole("link", { name: "Signalements" }).getAttribute("href")).toBe("/admin/reports")
    const parties = screen.getByRole("list", { name: "Parties concernées" })
    expect(within(parties).getByText("Koffi C.", { exact: false })).toBeTruthy()
    expect(within(parties).getByText("Esther E.", { exact: false })).toBeTruthy()
    expect(screen.queryByText("Détections récentes")).toBeNull()
  })

  it("lien « Voir la fiche » vers la fiche existante du compte visé, aucune suspension proposée", () => {
    view({ report: report(), message: textMessage, events: null })
    expect(screen.getByRole("link", { name: "Voir la fiche" }).getAttribute("href")).toBe(`/admin/users/${REPORTED}`)
    expect(screen.queryByRole("button", { name: /suspendre/i })).toBeNull()
    expect(screen.getByText(/Aucune suspension automatique/)).toBeTruthy()
  })

  it("image : balise image avec l'adresse signée ; média indisponible : texte de repli", () => {
    const image = { ...textMessage, type: "image", text: null, mediaUrl: "https://signed.test/p.jpg?t=1", mediaAvailable: true }
    const { unmount } = view({ report: report(), message: image, events: null })
    expect(screen.getByRole("img", { name: "Image signalée" }).getAttribute("src")).toBe("https://signed.test/p.jpg?t=1")
    unmount()
    view({ report: report(), message: { ...image, mediaUrl: null, mediaAvailable: false }, events: null })
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByText("Image indisponible")).toBeTruthy()
  })

  it("vocal : lecteur audio avec l'adresse signée ; indisponible : texte de repli", () => {
    const voice = { ...textMessage, type: "voice", text: null, mediaUrl: "https://signed.test/v.webm?t=1", mediaAvailable: true }
    const { container, unmount } = view({ report: report(), message: voice, events: null })
    expect(container.querySelector("audio").getAttribute("src")).toBe("https://signed.test/v.webm?t=1")
    unmount()
    view({ report: report(), message: { ...voice, mediaUrl: null, mediaAvailable: false }, events: null })
    expect(screen.getByText("Message vocal indisponible")).toBeTruthy()
  })

  it("position : liens Google Maps et Itinéraire sûrs", () => {
    const place = { ...textMessage, type: "location", text: null, lat: 6.37, lng: 2.39 }
    view({ report: report(), message: place, events: null })
    const open = screen.getByRole("link", { name: /Ouvrir dans Google Maps/ })
    expect(open.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=6.37,2.39")
    expect(open.getAttribute("rel")).toBe("noopener noreferrer")
    expect(open.getAttribute("target")).toBe("_blank")
    expect(screen.getByRole("link", { name: /Itinéraire/ }).getAttribute("href")).toContain("destination=6.37,2.39")
  })

  it("position sans coordonnées valides : « Position indisponible »", () => {
    view({ report: report(), message: { ...textMessage, type: "location", text: null }, events: null })
    expect(screen.getByText("Position indisponible")).toBeTruthy()
  })

  it("message supprimé : texte de repli, le détail reste rendu", () => {
    view({ report: report(), message: null, events: null })
    expect(screen.getByText("Le message signalé n'est plus disponible.")).toBeTruthy()
  })

  it("alerte automatique : compte par type sur 30 jours, jamais de valeur, origine « Analyse automatique »", () => {
    const auto = report({ source: "auto", reporter: null, details: null, reason: "contact_details", reasonLabel: "Coordonnées ou contact hors EduCash" })
    view({ report: auto, message: null, events: { windowDays: 30, total: 4, byKind: { phone: 2, link: 1, contact_keyword: 1 } } })
    const list = screen.getByRole("list", { name: "Détections par type" })
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent)
    expect(rows[0]).toBe("Numéro de téléphone2")
    expect(rows).toContain("Lien1")
    expect(screen.getByText(/30 derniers jours/)).toBeTruthy()
    expect(screen.getByText("Analyse automatique")).toBeTruthy()
    expect(screen.getByText(/ne vise pas un message précis/)).toBeTruthy()
  })

  it("alerte automatique : journal des détections absent", () => {
    view({ report: report({ source: "auto", reporter: null }), message: null, events: null })
    expect(screen.getByText(/journal des détections n'est pas disponible/)).toBeTruthy()
  })

  it("signalement clos : note et auteur du traitement", () => {
    view({ report: report({ status: "resolved", handledBy: { id: "a", name: "Awa A." }, handledAt: "2026-10-11T08:00:00Z", resolutionNote: "Avertissement envoyé" }), message: textMessage, events: null })
    expect(screen.getByText("Résolu")).toBeTruthy()
    expect(screen.getByText("Awa A.")).toBeTruthy()
    expect(screen.getByText("Avertissement envoyé")).toBeTruthy()
  })

  it("états d'erreur et d'indisponibilité", () => {
    const { unmount } = view(null, "Les signalements n'ont pas pu être chargés.")
    expect(screen.getByRole("heading", { level: 1, name: "Ce signalement n'a pas pu être chargé" }).closest('[role="alert"]')).toBeTruthy()
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy()
    unmount()
    view({ unavailable: true, message: "Les signalements ne sont pas disponibles pour le moment." })
    expect(screen.getByRole("heading", { level: 1, name: /pas disponibles/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Prendre en charge/ })).toBeNull()
  })

  it("aucun champ brut du stockage dans le rendu", () => {
    const { container } = view({ report: report(), message: textMessage, events: null })
    expect(container.innerHTML).not.toMatch(/media_url|phone|\+229/)
  })
})

describe("détail : actions selon l'état", () => {
  it("ouvert : « Prendre en charge » seul bouton encre, Résoudre et Classer inactifs", () => {
    view({ report: report(), message: textMessage, events: null })
    const take = screen.getByRole("button", { name: "Prendre en charge" })
    expect(take.className).toContain("btn--dark")
    expect(screen.getByRole("button", { name: "Résoudre" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: /Classer/ }).hasAttribute("disabled")).toBe(true)
    expect(document.querySelectorAll(".btn--dark")).toHaveLength(1)
    expect(screen.getByText("Prenez le signalement en charge pour décider.")).toBeTruthy()
  })

  it("en cours : « Résoudre » seul bouton encre, « Classer » léger, plus de prise en charge", () => {
    view({ report: report({ status: "in_progress" }), message: textMessage, events: null })
    expect(screen.queryByRole("button", { name: "Prendre en charge" })).toBeNull()
    expect(screen.getByRole("button", { name: "Résoudre" }).className).toContain("btn--dark")
    expect(screen.getByRole("button", { name: /Classer/ }).className).toContain("btn--ghost")
    expect(document.querySelectorAll(".btn--dark")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Résoudre" }).hasAttribute("disabled")).toBe(false)
  })

  it("résolu et classé : aucune action", () => {
    for (const status of ["resolved", "dismissed"]) {
      const { unmount } = view({ report: report({ status }), message: textMessage, events: null })
      expect(screen.queryByRole("button")).toBeNull()
      expect(screen.getByText(/signalement est clos/)).toBeTruthy()
      unmount()
    }
  })
})

describe("détail : prendre en charge", () => {
  it("appelle takeReport une seule fois malgré un double clic, puis rafraîchit", async () => {
    let done
    takeReport.mockReturnValue(new Promise((r) => { done = r }))
    view({ report: report(), message: textMessage, events: null })
    const button = screen.getByRole("button", { name: "Prendre en charge" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(takeReport).toHaveBeenCalledTimes(1)
    expect(takeReport).toHaveBeenCalledWith(RID)
    await act(async () => done({ success: true, status: "in_progress" }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("refus de l'action : l'erreur est annoncée et la page rafraîchie", async () => {
    takeReport.mockResolvedValue({ error: "Ce signalement ne peut plus être modifié de cette façon." })
    view({ report: report(), message: textMessage, events: null })
    fireEvent.click(screen.getByRole("button", { name: "Prendre en charge" }))
    await waitFor(() => expect(screen.getByText("Ce signalement ne peut plus être modifié de cette façon.")).toBeTruthy())
    expect(refresh).toHaveBeenCalled()
  })
})

describe("détail : décision avec note", () => {
  const open = (name) => {
    view({ report: report({ status: "in_progress" }), message: textMessage, events: null })
    fireEvent.click(screen.getByRole("button", { name }))
    return screen.getByRole("dialog")
  }

  it("Résoudre : dialogue nommé, note facultative bornée à 500, focus sur Annuler", () => {
    const dialog = open("Résoudre")
    expect(within(dialog).getByRole("heading", { name: "Résoudre SIG-0001 ?" })).toBeTruthy()
    const note = within(dialog).getByRole("textbox", { name: /Note/ })
    expect(note.getAttribute("maxlength")).toBe("500")
    expect(note.hasAttribute("required")).toBe(false)
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Annuler" }))
    expect(within(dialog).getByText(/Aucune suspension n'est appliquée automatiquement/)).toBeTruthy()
  })

  it("Résoudre sans note : envoi avec une note vide, rafraîchissement, fermeture", async () => {
    resolveReport.mockResolvedValue({ success: true, status: "resolved" })
    const dialog = open("Résoudre")
    fireEvent.click(within(dialog).getByRole("button", { name: "Résoudre" }))
    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith(RID, { note: "" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(refresh).toHaveBeenCalled()
    expect(dismissReport).not.toHaveBeenCalled()
  })

  it("Classer avec note : dismissReport reçoit la note nettoyée", async () => {
    dismissReport.mockResolvedValue({ success: true, status: "dismissed" })
    const dialog = open("Classer sans suite")
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Note/ }), { target: { value: "  Doublon de SIG-0000  " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Classer sans suite" }))
    await waitFor(() => expect(dismissReport).toHaveBeenCalledWith(RID, { note: "Doublon de SIG-0000" }))
    expect(resolveReport).not.toHaveBeenCalled()
  })

  it("double clic sur la confirmation : un seul envoi", async () => {
    let done
    resolveReport.mockReturnValue(new Promise((r) => { done = r }))
    const dialog = open("Résoudre")
    const confirm = within(dialog).getByRole("button", { name: "Résoudre" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(resolveReport).toHaveBeenCalledTimes(1)
    await act(async () => done({ success: true }))
  })

  it("erreur du serveur : message dans le dialogue, qui reste ouvert, nouvel essai possible", async () => {
    resolveReport.mockResolvedValueOnce({ error: "Le signalement n'a pas pu être mis à jour. Réessayez dans un instant." })
    const dialog = open("Résoudre")
    fireEvent.click(within(dialog).getByRole("button", { name: "Résoudre" }))
    await waitFor(() => expect(within(dialog).getByText(/n'a pas pu être mis à jour/)).toBeTruthy())
    expect(screen.getByRole("dialog")).toBeTruthy()
    resolveReport.mockResolvedValueOnce({ success: true })
    fireEvent.click(within(dialog).getByRole("button", { name: "Résoudre" }))
    await waitFor(() => expect(resolveReport).toHaveBeenCalledTimes(2))
  })

  it("exception réseau : message générique, verrou libéré", async () => {
    resolveReport.mockRejectedValueOnce(new Error("réseau"))
    const dialog = open("Résoudre")
    fireEvent.click(within(dialog).getByRole("button", { name: "Résoudre" }))
    await waitFor(() => expect(within(dialog).getByText(/Une erreur est survenue/)).toBeTruthy())
  })

  it("Annuler ferme sans rien envoyer", () => {
    const dialog = open("Résoudre")
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(resolveReport).not.toHaveBeenCalled()
  })
})

describe("ReportDecisionDialog", () => {
  it("fermé : rien n'est rendu ; note de plus de 500 caractères refusée sans envoi", async () => {
    const onConfirm = vi.fn()
    const { rerender } = render(<ReportDecisionDialog open={false} kind="resolve" reference="SIG-0001" onClose={() => {}} onConfirm={onConfirm} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    rerender(<ReportDecisionDialog open kind="resolve" reference="SIG-0001" onClose={() => {}} onConfirm={onConfirm} />)
    const note = screen.getByRole("textbox", { name: /Note/ })
    // maxLength borne la saisie ; le contrôle est aussi fait à l'envoi (valeur posée sans passer par le champ).
    fireEvent.change(note, { target: { value: "x".repeat(501) } })
    fireEvent.click(screen.getByRole("button", { name: "Résoudre" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText("La note ne peut pas dépasser 500 caractères.")).toBeTruthy()
  })
})

const STUDENT = "00000000-0000-4000-8000-0000000000a1"
const CLIENT = "00000000-0000-4000-8000-0000000000a2"
const SIGNED = (name) => `https://proj.supabase.co/storage/v1/object/sign/purchase-proofs/${name}?token=t`

const purchaseReport = (over = {}) =>
  report({
    reference: "SIG-0094",
    reason: "purchase_amount_mismatch",
    reasonLabel: "Montant différent du ticket",
    targetType: "purchase_request",
    typeLabel: "Demande de paiement d'achats",
    targetDetail: "N° 2 · Librairie Notre-Dame · 12 500 FCFA",
    reporter: { id: CLIENT, name: "Edwige S." },
    reported: { id: STUDENT, name: "Afiavi D." },
    details: "J'ai payé 12 500 comme demandé, mais le ticket dit 9 500.",
    ...over,
  })

const purchase = (over = {}) => ({
  id: "40000000-0000-4000-8000-000000000001",
  seq: 2,
  number: "N° 2",
  status: "reported",
  statusLabel: "Signalé",
  statusTone: "erreur",
  amount: 12500,
  vendorName: "Librairie Notre-Dame",
  items: "2 cahiers",
  payeeKindLabel: "Numéro marchand MoMo",
  payeeNumber: "123456",
  createdAt: "2026-10-09T10:12:00Z",
  paidAt: "2026-10-09T10:31:00Z",
  paidReference: "MP2610",
  beneficiaryConfirmed: true,
  receivedAt: null,
  reportedAt: "2026-10-10T08:00:00Z",
  student: { id: STUDENT, name: "Afiavi D." },
  client: { id: CLIENT, name: "Edwige S." },
  proofs: [
    { kind: "payee", label: "Photo du numéro marchand", url: SIGNED("payee"), at: "2026-10-09T10:12:00Z" },
    { kind: "ticket", label: "Ticket", url: SIGNED("ticket"), at: "2026-10-09T10:12:00Z" },
    { kind: "sms", label: "Capture du SMS", url: SIGNED("sms"), at: "2026-10-09T10:31:00Z" },
  ],
  ...over,
})

describe("détail : demande de paiement d'achats", () => {
  it("bloc de la demande : montant, vendeur, numéro à payer, statut, référence, parties et lien vers la mission", () => {
    view({ report: purchaseReport(), message: null, events: null, purchase: purchase() })
    expect(screen.getByRole("heading", { level: 1, name: "SIG-0094" })).toBeTruthy()
    expect(screen.getByRole("heading", { level: 2, name: "Demande de paiement d'achats" })).toBeTruthy()
    const card = screen.getByRole("article", { name: "Détail de la demande N° 2" })
    expect(card.textContent).toContain("N° 2 · Librairie Notre-Dame")
    expect(card.textContent).toContain("Numéro marchand MoMo : 123456")
    expect(card.textContent).toMatch(/12\s*500\s*FCFA/)
    expect(card.textContent).toContain("Montant demandé")
    expect(within(card).getByText("Signalé")).toBeTruthy()
    expect(card.className).toContain("is-flagged")
    expect(screen.getByText("MP2610")).toBeTruthy()
    expect(screen.getByText("2 cahiers")).toBeTruthy()
    expect(screen.getByText("Bénéficiaire vérifié par le client").nextElementSibling.textContent).toBe("Oui")
    expect(screen.getByText("Étudiant").nextElementSibling.querySelector("a").getAttribute("href")).toBe(`/admin/users/${STUDENT}`)
    expect(screen.getByText("Client").nextElementSibling.querySelector("a").getAttribute("href")).toBe(`/admin/users/${CLIENT}`)
    expect(screen.getByRole("link", { name: "Voir la mission et ses achats" }).getAttribute("href")).toBe(`/admin/missions/${MISSION}`)
  })

  it("le message signalé n'est pas affiché : la demande le remplace", () => {
    view({ report: purchaseReport(), message: null, events: null, purchase: purchase() })
    expect(screen.queryByText("Message signalé")).toBeNull()
    expect(screen.queryByText(/n'est plus disponible/)).toBeNull()
    expect(screen.getByText(/J'ai payé 12 500 comme demandé/)).toBeTruthy()
  })

  it("trois preuves en images à adresse signée, ouvrables dans un nouvel onglet, jamais de chemin brut", () => {
    const { container } = view({ report: purchaseReport(), message: null, events: null, purchase: purchase() })
    const images = container.querySelectorAll("img")
    expect([...images].map((i) => i.getAttribute("alt"))).toEqual(["Photo du numéro marchand", "Ticket", "Capture du SMS"])
    expect([...images].map((i) => i.getAttribute("src"))).toEqual([SIGNED("payee"), SIGNED("ticket"), SIGNED("sms")])
    for (const link of container.querySelectorAll(".ad-payreq a")) {
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    }
    expect(container.innerHTML).not.toMatch(/payee_photo_path|ticket_photo_path|sms_photo_path|media_url/)
  })

  it("preuve absente ou non signée : vignette « Non disponible », jamais d'image cassée", () => {
    const proofs = purchase().proofs.map((p) => (p.kind === "ticket" ? { ...p, url: null } : p))
    const { container } = view({ report: purchaseReport(), message: null, events: null, purchase: purchase({ proofs }) })
    expect(container.querySelectorAll("img")).toHaveLength(2)
    const missing = screen.getByRole("img", { name: "Ticket : non disponible" })
    expect(missing.className).toContain("is-missing")
    expect(missing.textContent).toContain("Non disponible")
  })

  it("demande non payée : pas de capture du SMS, seulement les deux preuves de l'étudiant", () => {
    const proofs = purchase().proofs.filter((p) => p.kind !== "sms")
    const { container } = view({
      report: purchaseReport(),
      message: null,
      events: null,
      purchase: purchase({ status: "pending", statusLabel: "En attente de paiement", paidAt: null, paidReference: null, beneficiaryConfirmed: false, proofs }),
    })
    expect(container.querySelectorAll("img")).toHaveLength(2)
    expect(screen.queryByText("Payée le")).toBeNull()
    expect(screen.queryByText("Référence de paiement")).toBeNull()
  })

  it("note « hors EduCash », aucun bouton de remboursement, de compensation ni de suspension", () => {
    view({ report: purchaseReport({ status: "in_progress" }), message: null, events: null, purchase: purchase() })
    expect(screen.getByText(/non remboursable par EduCash/)).toBeTruthy()
    expect(screen.getByText(/La clôture prévient les deux parties/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /rembours|compens|suspendre|avertir/i })).toBeNull()
    expect(screen.queryByRole("link", { name: /rembours|compens/i })).toBeNull()
    expect(document.body.textContent).not.toMatch(/AD08/)
    expect(screen.getByRole("link", { name: "Voir la fiche" }).getAttribute("href")).toBe(`/admin/users/${STUDENT}`)
  })

  it("clôture : « Résoudre » seul bouton encre, comme pour un message", () => {
    view({ report: purchaseReport({ status: "in_progress" }), message: null, events: null, purchase: purchase() })
    expect(document.querySelectorAll(".btn--dark")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Résoudre" }).hasAttribute("disabled")).toBe(false)
  })

  it("signalement clos : la carte n'est plus marquée comme à traiter", () => {
    view({ report: purchaseReport({ status: "resolved" }), message: null, events: null, purchase: purchase() })
    expect(screen.getByRole("article", { name: "Détail de la demande N° 2" }).className).not.toContain("is-flagged")
  })

  it("demande introuvable (supprimée, autre mission ou script 94 absent) : texte de repli, le détail reste rendu", () => {
    view({ report: purchaseReport(), message: null, events: null, purchase: null })
    expect(screen.getByText("La demande signalée n'est plus disponible.")).toBeTruthy()
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.getByText(/J'ai payé 12 500 comme demandé/)).toBeTruthy()
  })

  it("un signalement de message n'affiche aucun bloc d'achats, même avec des données d'achats par erreur", () => {
    view({ report: report(), message: textMessage, events: null, purchase: purchase() })
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.queryByText("La clôture prévient les deux parties", { exact: false })).toBeNull()
    expect(screen.getByText("Message signalé")).toBeTruthy()
  })

  it("aucun délai promis, vouvoiement, aucun style en ligne", () => {
    const { container } = view({ report: purchaseReport(), message: null, events: null, purchase: purchase() })
    expect(container.innerHTML).not.toMatch(new RegExp(`style=|${String.fromCharCode(0x2014)}`))
    expect(container.textContent).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/i)
    expect(container.textContent).not.toMatch(/sous \d+ ?(h|heures|jours)|24 ?h|48 ?h|délai/i)
  })
})
