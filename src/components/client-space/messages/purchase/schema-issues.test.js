import { describe, expect, it } from "vitest"
import { z } from "zod"
import { fieldIssues } from "./schema-issues"

describe("fieldIssues", () => {
  const schema = z.object({
    a: z.string().min(2, "A trop court"),
    b: z.number({ error: "B invalide" }),
  })

  it("renvoie un objet vide pour une entrée valide", () => {
    expect(fieldIssues(schema, { a: "ok", b: 1 })).toEqual({})
  })

  it("indexe le premier message de chaque champ en erreur", () => {
    expect(fieldIssues(schema, { a: "x", b: "1" })).toEqual({ a: "A trop court", b: "B invalide" })
  })

  it("ne lève jamais, même sur une entrée absurde", () => {
    expect(fieldIssues(schema, null)).toBeTypeOf("object")
    expect(fieldIssues(schema, undefined)).toBeTypeOf("object")
  })
})
