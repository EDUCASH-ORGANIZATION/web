// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/qa/dom/setup.test.support"
import { renderHook } from "@testing-library/react"

const upload = vi.fn()
const from = vi.fn(() => ({ upload }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from } }) }))

const { usePurchaseProofUpload, PROOF_UPLOAD_ERROR, PROOF_NAME_ERROR } = await import("./use-purchase-proof-upload")
const { isOwnedProofPath } = await import("@/lib/purchases/proofs")

const OWNER = "11111111-1111-4111-8111-111111111111"
const REQUEST = "6f1c2a52-8f3e-4c1d-9a55-0d3b6e4a7c10"
const photo = (name = "sms.JPG", type = "image/jpeg", size = 1024) => new File([new Uint8Array(size)], name, { type })
const hook = (owner = OWNER) => renderHook(() => usePurchaseProofUpload(owner)).result.current

beforeEach(() => {
  vi.clearAllMocks()
  upload.mockResolvedValue({ error: null })
})

describe("usePurchaseProofUpload", () => {
  it("téléverse dans le dossier du déposant, sans écraser, et renvoie le chemin", async () => {
    const file = photo()
    const out = await hook()({ requestId: REQUEST, kind: "sms", file })
    expect(from).toHaveBeenCalledWith("purchase-proofs")
    expect(upload).toHaveBeenCalledTimes(1)
    const [path, sent, options] = upload.mock.calls[0]
    expect(out).toEqual({ path })
    expect(sent).toBe(file)
    expect(options).toMatchObject({ upsert: false, contentType: "image/jpeg" })
    expect(isOwnedProofPath(path, { ownerId: OWNER, requestId: REQUEST, kind: "sms" })).toBe(true)
    expect(path.endsWith(".jpg")).toBe(true)
  })

  it("chaque envoi prend un jeton différent", async () => {
    const send = hook()
    const a = await send({ requestId: REQUEST, kind: "sms", file: photo() })
    const b = await send({ requestId: REQUEST, kind: "sms", file: photo() })
    expect(a.path).not.toBe(b.path)
  })

  it("refuse un fichier invalide avant tout téléversement", async () => {
    const out = await hook()({ requestId: REQUEST, kind: "sms", file: photo("note.pdf", "application/pdf") })
    expect(out.error).toMatch(/Format non accepté/)
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuse un fichier vide", async () => {
    const out = await hook()({ requestId: REQUEST, kind: "sms", file: photo("a.jpg", "image/jpeg", 0) })
    expect(out.error).toMatch(/vide/)
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuse un identifiant invalide (chemin impossible)", async () => {
    const out = await hook("pas-un-uuid")({ requestId: REQUEST, kind: "sms", file: photo() })
    expect(out).toEqual({ error: PROOF_NAME_ERROR })
    expect(upload).not.toHaveBeenCalled()
  })

  it("erreur du stockage ou exception : message vouvoyé, jamais de levée", async () => {
    upload.mockResolvedValueOnce({ error: { message: "boom" } })
    expect(await hook()({ requestId: REQUEST, kind: "sms", file: photo() })).toEqual({ error: PROOF_UPLOAD_ERROR })
    upload.mockRejectedValueOnce(new Error("réseau"))
    expect(await hook()({ requestId: REQUEST, kind: "sms", file: photo() })).toEqual({ error: PROOF_UPLOAD_ERROR })
  })
})
