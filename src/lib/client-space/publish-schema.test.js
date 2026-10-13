import { describe, it, expect } from "vitest"
import {
  BUDGET_MAX,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  STEPS,
  STEP_FIELDS,
  TITLE_MAX,
  URGENCY_OPTIONS,
  duplicateValues,
  emptyValues,
  initialValues,
  makePublishSchema,
  maxDeadline,
  parseDuplicateId,
  toMissionInput,
  typeIcon,
  urgencyLabel,
  validateFields,
  validatePublish,
  validateStep,
} from "./publish-schema"
import { CITIES, MIN_MISSION_BUDGET, MISSION_TYPES } from "../supabase/database.constants.js"

const TODAY = "2026-10-13"
const DESC = "x".repeat(DESCRIPTION_MIN)
const valid = {
  type: "Traduction",
  title: "Traduire un flyer",
  description: DESC,
  city: "Cotonou",
  budget: 10000,
  urgency: "low",
  deadline: "2026-10-31",
}

const errorOf = (field, patch) => validateFields({ ...valid, ...patch }, [field], TODAY)[field]

describe("étapes", () => {
  it("l'assistant a quatre étapes et chaque champ saisi appartient à une seule", () => {
    expect(STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4])
    const fields = [1, 2, 3, 4].flatMap((s) => STEP_FIELDS[s])
    expect(new Set(fields).size).toBe(fields.length)
    expect([...fields].sort()).toEqual(Object.keys(valid).sort())
  })

  it("accepte des valeurs complètes", () => {
    expect(makePublishSchema(TODAY).safeParse(valid).success).toBe(true)
    expect(validatePublish(valid, TODAY)).toEqual({ ok: true, data: toMissionInput(valid) })
  })
})

describe("type", () => {
  it.each(MISSION_TYPES)("accepte %s", (type) => expect(errorOf("type", { type })).toBeUndefined())
  it.each(["", "Piratage", undefined, 3])("refuse %s", (type) => expect(errorOf("type", { type })).toBe("Choisissez le type de mission."))
})

describe("titre", () => {
  it("refuse un titre vide ou fait d'espaces", () => {
    expect(errorOf("title", { title: "" })).toBe("Indiquez le titre de votre mission.")
    expect(errorOf("title", { title: "   " })).toBe("Indiquez le titre de votre mission.")
  })
  it("borne la longueur à celle du serveur", () => {
    expect(TITLE_MAX).toBe(120)
    expect(errorOf("title", { title: "a".repeat(TITLE_MAX) })).toBeUndefined()
    expect(errorOf("title", { title: "a".repeat(TITLE_MAX + 1) })).toMatch(/ne doit pas dépasser 120/)
  })
})

describe("description", () => {
  it("exige au moins 50 caractères (espaces de bord exclus)", () => {
    expect(errorOf("description", { description: "x".repeat(DESCRIPTION_MIN - 1) })).toMatch(/au moins 50/)
    expect(errorOf("description", { description: ` ${"x".repeat(DESCRIPTION_MIN - 1)} ` })).toMatch(/au moins 50/)
    expect(errorOf("description", { description: DESC })).toBeUndefined()
  })
  it("borne la longueur à celle du serveur", () => {
    expect(DESCRIPTION_MAX).toBe(3000)
    expect(errorOf("description", { description: "x".repeat(DESCRIPTION_MAX) })).toBeUndefined()
    expect(errorOf("description", { description: "x".repeat(DESCRIPTION_MAX + 1) })).toMatch(/ne doit pas dépasser 3.000 caractères/)
  })
})

describe("ville", () => {
  it.each(CITIES)("accepte %s", (city) => expect(errorOf("city", { city })).toBeUndefined())
  it.each(["", "Paris", undefined])("refuse %s", (city) => expect(errorOf("city", { city })).toBe("Choisissez la ville de la mission."))
})

describe("budget", () => {
  it("accepte le minimum et refuse en dessous", () => {
    expect(errorOf("budget", { budget: MIN_MISSION_BUDGET })).toBeUndefined()
    expect(errorOf("budget", { budget: MIN_MISSION_BUDGET - 1 })).toMatch(/budget minimum est de 2.000.FCFA/)
  })
  it("refuse un budget vide, non entier, négatif ou non numérique", () => {
    expect(errorOf("budget", { budget: null })).toBe("Indiquez le budget de votre mission.")
    expect(errorOf("budget", { budget: undefined })).toBe("Indiquez le budget de votre mission.")
    expect(errorOf("budget", { budget: "5000" })).toBe("Indiquez le budget de votre mission.")
    expect(errorOf("budget", { budget: 2500.5 })).toBe("Indiquez un budget entier.")
    expect(errorOf("budget", { budget: -5000 })).toBeTruthy()
    expect(errorOf("budget", { budget: Number.NaN })).toBeTruthy()
  })
  it("plafonne à 9 chiffres", () => {
    expect(errorOf("budget", { budget: BUDGET_MAX })).toBeUndefined()
    expect(errorOf("budget", { budget: BUDGET_MAX + 1 })).toBe("Ce budget est trop élevé.")
  })
})

describe("urgence", () => {
  it("propose Standard, Urgent et Critique avec les valeurs de la base", () => {
    expect(URGENCY_OPTIONS.map((o) => [o.value, o.label])).toEqual([["low", "Standard"], ["medium", "Urgent"], ["high", "Critique"]])
    expect(urgencyLabel("high")).toBe("Critique")
    expect(urgencyLabel("autre")).toBe("Standard")
  })
  it("refuse une valeur inconnue", () => {
    expect(errorOf("urgency", { urgency: "extreme" })).toBe("Choisissez l'urgence.")
    expect(errorOf("urgency", { urgency: "medium" })).toBeUndefined()
  })
})

describe("date limite", () => {
  it("accepte aujourd'hui et une date future", () => {
    expect(errorOf("deadline", { deadline: TODAY })).toBeUndefined()
    expect(errorOf("deadline", { deadline: "2026-12-01" })).toBeUndefined()
  })
  it("refuse une date passée (jour du Bénin)", () => {
    expect(errorOf("deadline", { deadline: "2026-10-12" })).toBe("La date limite ne peut pas être passée.")
  })
  it("exige une date", () => {
    expect(errorOf("deadline", { deadline: "" })).toBe("Indiquez la date limite.")
    expect(errorOf("deadline", { deadline: undefined })).toBe("Indiquez la date limite.")
  })
  it.each(["31/10/2026", "2026-02-30", "2026-13-01", "2026-10-31T10:00:00Z", "demain"])("refuse le format ou la date invalide %s", (deadline) => {
    expect(errorOf("deadline", { deadline })).toBe("La date limite est invalide.")
  })
  it("refuse une date trop lointaine", () => {
    expect(maxDeadline(TODAY)).toBe("2028-12-31")
    expect(errorOf("deadline", { deadline: "2028-12-31" })).toBeUndefined()
    expect(errorOf("deadline", { deadline: "2029-01-01" })).toBe("La date limite est trop lointaine.")
  })
})

describe("validation par étape et globale", () => {
  it("ne remonte que les champs de l'étape", () => {
    expect(Object.keys(validateStep(1, emptyValues(), TODAY)).sort()).toEqual(["title", "type"])
    expect(Object.keys(validateStep(2, emptyValues(), TODAY)).sort()).toEqual(["city", "description"])
    expect(Object.keys(validateStep(3, emptyValues(), TODAY)).sort()).toEqual(["budget", "deadline"])
    expect(validateStep(4, emptyValues(), TODAY)).toEqual({})
  })
  it("l'urgence par défaut est valide : l'étape 3 n'exige pas de choix", () => {
    expect(validateStep(3, { ...valid, budget: 5000 }, TODAY)).toEqual({})
  })
  it("renvoie la première étape en erreur", () => {
    const res = validatePublish({ ...valid, description: "court", budget: 100 }, TODAY)
    expect(res.ok).toBe(false)
    expect(res.firstStep).toBe(2)
    expect(Object.keys(res.errors).sort()).toEqual(["budget", "description"])
  })
  it("ne plante pas sur des valeurs absentes", () => {
    expect(validatePublish(undefined, TODAY).ok).toBe(false)
    expect(validatePublish({}, TODAY).firstStep).toBe(1)
  })
})

describe("toMissionInput", () => {
  it("ne garde que les champs de createMission, nettoyés", () => {
    const data = toMissionInput({ ...valid, title: "  Titre  ", description: `  ${DESC} `, client_id: "autre", status: "done" })
    expect(Object.keys(data).sort()).toEqual(["budget", "city", "deadline", "description", "title", "type", "urgency"])
    expect(data.title).toBe("Titre")
    expect(data.description).toBe(DESC)
  })
})

describe("parseDuplicateId", () => {
  const id = "3f2b8c1e-9a4d-4e6b-8c2a-1d5f7e9b0a3c"
  it("accepte un UUID, en minuscules", () => {
    expect(parseDuplicateId(id)).toBe(id)
    expect(parseDuplicateId(id.toUpperCase())).toBe(id)
    expect(parseDuplicateId([id, "autre"])).toBe(id)
  })
  it.each([undefined, null, "", "123", "m-1", `${id}x`, `${id}'; drop`, "../etc/passwd", 42, {}, [], ["x", id]])("ignore %j", (raw) => {
    expect(parseDuplicateId(raw)).toBe("")
  })
})

describe("valeurs de départ", () => {
  it("part du préremplissage de l'URL", () => {
    expect(initialValues({ title: "Faire le marché", city: "Cotonou", type: "Livraison" })).toEqual({
      ...emptyValues(),
      title: "Faire le marché",
      city: "Cotonou",
      type: "Livraison",
    })
    expect(initialValues(undefined)).toEqual(emptyValues())
  })

  it("une mission dupliquée prime sur l'URL pour ses champs", () => {
    const values = initialValues({ title: "URL", city: "Cotonou", type: "" }, { title: "Base", budget: 8000, urgency: "high" })
    expect(values.title).toBe("Base")
    expect(values.city).toBe("Cotonou")
    expect(values.budget).toBe(8000)
    expect(values.urgency).toBe("high")
    expect(values.deadline).toBe("")
  })

  it("duplicateValues borne et filtre une ligne de base, sans échéance", () => {
    const out = duplicateValues({
      title: `  ${"t".repeat(300)}`,
      description: "d".repeat(5000),
      type: "Traduction",
      city: "Cotonou",
      budget: "12000",
      urgency: "medium",
      deadline: "2020-01-01",
      client_id: "autre",
    })
    expect(out.title).toHaveLength(TITLE_MAX)
    expect(out.description).toHaveLength(DESCRIPTION_MAX)
    expect(out).toMatchObject({ type: "Traduction", city: "Cotonou", budget: 12000, urgency: "medium" })
    expect(Object.keys(out)).not.toContain("deadline")
    expect(Object.keys(out)).not.toContain("client_id")
  })

  it("duplicateValues ignore l'inconnu et les valeurs hors bornes", () => {
    expect(duplicateValues({ type: "Piratage", city: "Paris", budget: 100, urgency: "extreme", title: 5 })).toEqual({})
    expect(duplicateValues({ budget: 2500.5 })).toEqual({})
    expect(duplicateValues({ budget: BUDGET_MAX + 1 })).toEqual({})
    expect(duplicateValues(null)).toEqual({})
  })
})

describe("icônes de type", () => {
  it("associe une icône à chaque type de mission, par valeur de la base", () => {
    expect(typeIcon("Babysitting")).toBe("i-baby")
    expect(typeIcon("Livraison")).toBe("i-bike")
    expect(typeIcon("Saisie")).toBe("i-keyboard")
    expect(typeIcon("Community Management")).toBe("i-megaphone")
    expect(typeIcon("Traduction")).toBe("i-languages")
    expect(typeIcon("Cours particuliers")).toBe("i-book")
    expect(typeIcon("Démarches")).toBe("i-file")
    expect(typeIcon("Autre")).toBe("i-sparkles")
    expect(typeIcon("inconnu")).toBe("i-sparkles")
  })
})
