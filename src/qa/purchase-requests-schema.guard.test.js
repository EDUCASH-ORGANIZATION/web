import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Script 94 de RD-ACHATS-01 NON appliqué en production : le schéma de référence (supabase/schema.sql, section 13,
// bornée par les marqueurs « SCRIPT 94 ») décrit la table purchase_requests, l'extension de messages, de reports et de
// notifications, et le compartiment purchase-proofs tels que le script 94 les crée. Ce garde vérifie les éléments qui
// portent la sécurité : statuts, montant, unicités, RLS sans politique, aucun droit pour anon ni authenticated,
// trigger en SECURITY INVOKER à search_path vide, compartiment privé avec sa seule politique d'insertion, CHECK de
// messages à 6 types avec CHECK de lien et clé étrangère composite, aucun droit UPDATE de authenticated sur
// purchase_request_id, 4 motifs d'achats dans reports, 21 types de notifications.
// Les lignes d'origine de messages_type_check, notifications_type_check et des CHECK de reports plus haut dans le
// fichier décrivent l'état d'avant le 94 (gardes de RD-MSG-01 et de RD-NOTIF-01) : ce garde lit la section 13.
// Après l'application du script 94 : retirer « NON appliqué » de l'en-tête de schema.sql et de ce commentaire.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

const START = "-- >>> SCRIPT 94 (RD-ACHATS-01) : début"
const END = "-- <<< SCRIPT 94 (RD-ACHATS-01) : fin"
const startAt = SCHEMA.indexOf(START)
const endAt = SCHEMA.indexOf(END)
const BLOCK = startAt >= 0 && endAt > startAt ? SCHEMA.slice(startAt, endAt) : ""
const blockLines = BLOCK.split("\n")

const listOf = (text) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

// Texte d'une instruction ou d'une définition : de sa première ligne jusqu'au « ; » de fin de ligne.
function statement(startPattern, source = BLOCK) {
  const match = source.match(startPattern)
  expect(match, `instruction absente : ${startPattern}`).not.toBeNull()
  const from = match.index
  const to = source.indexOf(";\n", from)
  expect(to).toBeGreaterThan(from)
  return source.slice(from, to + 1)
}

// Corps d'une contrainte nommée (create table ou alter table du bloc).
function constraint(name) {
  const at = BLOCK.indexOf(`constraint ${name} `)
  expect(at, `contrainte ${name} absente`).toBeGreaterThan(-1)
  let depth = 0
  let i = BLOCK.indexOf("(", at)
  for (; i < BLOCK.length; i++) {
    if (BLOCK[i] === "(") depth++
    if (BLOCK[i] === ")") {
      depth--
      if (depth === 0) break
    }
  }
  return BLOCK.slice(at, i + 1).replace(/\s+/g, " ")
}

function tableBody() {
  const start = BLOCK.indexOf("create table public.purchase_requests (")
  expect(start).toBeGreaterThan(-1)
  return BLOCK.slice(start, BLOCK.indexOf("\n);", start))
}

function guardFunction() {
  const start = BLOCK.indexOf("CREATE OR REPLACE FUNCTION public.guard_purchase_requests()")
  expect(start).toBeGreaterThan(-1)
  const end = BLOCK.indexOf("$function$;", BLOCK.indexOf("$function$", start) + 1)
  expect(end).toBeGreaterThan(start)
  return BLOCK.slice(start, end)
}

describe("schéma de référence : section du script 94", () => {
  it("la section est bornée par ses marqueurs et placée avant la liste des objets propres à Supabase", () => {
    expect(startAt).toBeGreaterThan(-1)
    expect(endAt).toBeGreaterThan(startAt)
    expect(endAt).toBeLessThan(SCHEMA.indexOf("OBJETS PROPRES À SUPABASE À ADAPTER POUR NEON"))
  })

  it("l'en-tête signale le script 94 comme NON appliqué en production, après le 93", () => {
    const head = lines.slice(0, 40).join("\n")
    expect(head).toContain("Script 94 de RD-ACHATS-01 NON appliqué en production")
    expect(head).toContain("strictement après le script 93")
    expect(SCHEMA).toContain("-- 13. SCRIPT 94 DE RD-ACHATS-01 (NON appliqué en production")
  })
})

describe("schéma de référence : table purchase_requests (script 94)", () => {
  it("les statuts sont exactement pending, paid, received, reported, cancelled, par défaut pending", () => {
    expect(listOf(constraint("purchase_requests_status_check"))).toEqual([
      "pending",
      "paid",
      "received",
      "reported",
      "cancelled",
    ])
    expect(tableBody()).toContain("status text not null default 'pending',")
  })

  it("le montant est un entier de 100 à 500 000, le numéro de demande de 1 à 99", () => {
    expect(tableBody()).toContain("amount integer not null,")
    expect(constraint("purchase_requests_amount_check")).toContain("amount between 100 and 500000")
    expect(tableBody()).toContain("seq integer not null,")
    expect(constraint("purchase_requests_seq_check")).toContain("seq between 1 and 99")
  })

  it("un numéro par mission et la paire (id, mission_id) sont uniques, la version démarre à 1", () => {
    expect(tableBody()).toContain("constraint purchase_requests_mission_seq_key unique (mission_id, seq),")
    expect(tableBody()).toContain("constraint purchase_requests_id_mission_key unique (id, mission_id),")
    expect(tableBody()).toContain("version integer not null default 1,")
    expect(constraint("purchase_requests_version_check")).toContain("(version = 1) = (edited_at is null)")
  })

  it("les formats du numéro à payer, du vendeur et des photos sont bornés par la base", () => {
    expect(listOf(constraint("purchase_requests_payee_kind_check"))).toEqual(["merchant", "personal"])
    const payee = constraint("purchase_requests_payee_number_check")
    expect(payee).toContain("'^[0-9]{4,10}$'")
    expect(payee).toContain("'^\\+22901[0-9]{8}$'")
    expect(constraint("purchase_requests_vendor_name_check")).toContain("between 2 and 80")
    expect(constraint("purchase_requests_items_check")).toContain("between 1 and 120")
    for (const name of ["payee_photo", "ticket_photo", "sms_photo"]) {
      const photo = constraint(`purchase_requests_${name}_check`)
      expect(photo, name).toContain("<= 200")
      expect(photo, name).toContain("strpos(")
      expect(photo, name).toContain("starts_with(")
    }
    expect(constraint("purchase_requests_payee_photo_check")).toContain("student_id::text")
    expect(constraint("purchase_requests_sms_photo_check")).toContain("client_id::text")
    expect(constraint("purchase_requests_paid_reference_check")).toContain("'^[A-Za-z0-9-]{1,40}$'")
  })

  it("les CHECK de cohérence lient chaque statut à ses colonnes", () => {
    expect(constraint("purchase_requests_paid_fields_check")).toContain(
      "paid_at is not null and sms_photo_path is not null and beneficiary_confirmed"
    )
    expect(constraint("purchase_requests_received_fields_check")).toContain("paid_at is not null and received_at is not null")
    expect(constraint("purchase_requests_cancelled_fields_check")).toContain("cancelled_at is not null and paid_at is null")
    expect(constraint("purchase_requests_reported_fields_check")).toContain("reported_at is not null")
    expect(constraint("purchase_requests_end_check")).toContain("(reported_at is not null) = (status = 'reported')")
    expect(constraint("purchase_requests_parties_check")).toContain("student_id <> client_id")
  })

  it("la suppression d'une mission ou d'un compte emporte les demandes (cascade), jamais un DELETE direct", () => {
    expect(tableBody()).toContain("foreign key (mission_id)\n    references public.missions (id) on delete cascade")
    expect(tableBody()).toContain("foreign key (student_id)\n    references public.profiles (user_id) on delete cascade")
    expect(tableBody()).toContain("foreign key (client_id)\n    references public.profiles (user_id) on delete cascade")
    expect(tableBody()).not.toContain("auth.users")
    expect(guardFunction()).toContain("Demande d''achats : suppression interdite.")
  })

  it("la RLS est activée sans aucune politique sur la table", () => {
    expect(BLOCK).toContain("alter table public.purchase_requests enable row level security;")
    expect(
      lines.filter((l) => /^create policy/i.test(l) && l.includes("on public.purchase_requests")),
      "politique sur purchase_requests"
    ).toHaveLength(0)
  })

  it("aucun droit pour anon, authenticated ni public : service_role SELECT, INSERT, UPDATE seulement", () => {
    expect(BLOCK).toContain("revoke all on table public.purchase_requests from public, anon, authenticated, service_role;")
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("public.purchase_requests"))
    expect(grants).toEqual(["grant select, insert, update on table public.purchase_requests to service_role;"])
    expect(grants.some((l) => /\b(anon|authenticated)\b/.test(l))).toBe(false)
    expect(grants.some((l) => /delete|truncate|references|trigger/i.test(l))).toBe(false)
  })

  it("la table n'est pas dans la publication realtime", () => {
    const realtime = lines.filter((l) => /alter publication supabase_realtime/i.test(l))
    expect(realtime).toEqual(["alter publication supabase_realtime add table public.messages;"])
  })
})

describe("schéma de référence : trigger de la machine à états (script 94)", () => {
  it("la fonction de garde est en SECURITY INVOKER à search_path vide, sans droit pour les rôles de l'API", () => {
    const fn = guardFunction()
    const header = fn.slice(0, fn.indexOf("AS $function$"))
    expect(header).toContain("RETURNS trigger")
    expect(header).toContain("SET search_path TO ''")
    expect(header).not.toMatch(/SECURITY DEFINER/i)
    expect(BLOCK).toContain(
      "revoke all on function public.guard_purchase_requests() from public, anon, authenticated, service_role;"
    )
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("function public.guard_purchase_requests()"))
    expect(grants).toEqual(["grant execute on function public.guard_purchase_requests() to service_role;"])
  })

  it("le trigger garde INSERT, UPDATE et DELETE, l'horodatage est posé par update_updated_at", () => {
    expect(BLOCK).toContain(
      "CREATE TRIGGER guard_purchase_requests BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_requests\n  FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_requests();"
    )
    expect(BLOCK).toContain(
      "CREATE TRIGGER trg_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests\n  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();"
    )
  })

  it("la machine à états refuse les transitions interdites et le signalement sans ligne reports", () => {
    const fn = guardFunction()
    expect(fn).toContain("old.status = 'pending' and new.status = 'cancelled'")
    expect(fn).toContain("old.status = 'pending' and new.status = 'paid'")
    expect(fn).toContain("old.status = 'paid' and new.status = 'received'")
    expect(fn).toContain("old.status in ('pending', 'paid', 'received') and new.status = 'reported'")
    expect(fn).toContain("r.target_type = 'purchase_request' and r.purchase_request_id = new.id")
    expect(fn).toContain("transition interdite")
    expect(fn).toContain("v_mission_status is distinct from 'in_progress'")
    expect(fn).toContain("v_estimate is null")
    expect(fn).toContain("new.version is distinct from old.version + 1")
    expect(fn.match(/errcode = '42501'/g).length).toBeGreaterThanOrEqual(10)
  })
})

describe("schéma de référence : messages d'achat (script 94)", () => {
  it("messages_type_check passe à 6 types et un CHECK de lien impose le type d'achat si et seulement si purchase_request_id", () => {
    const alter = statement(/alter table public\.messages\n  add constraint messages_purchase_request_fkey/)
    expect(listOf(constraint("messages_type_check"))).toEqual([
      "text",
      "voice",
      "image",
      "location",
      "purchase_request",
      "purchase_event",
    ])
    expect(alter).toContain("drop constraint messages_type_check,")
    expect(constraint("messages_purchase_link_check")).toContain(
      "(type in ('purchase_request', 'purchase_event')) = (purchase_request_id is not null)"
    )
  })

  it("la clé étrangère composite impose la même mission", () => {
    expect(BLOCK).toContain(
      "add constraint messages_purchase_request_fkey foreign key (purchase_request_id, mission_id)\n    references public.purchase_requests (id, mission_id) on delete cascade,"
    )
    expect(BLOCK).toContain("alter table public.messages add column purchase_request_id uuid null;")
    expect(BLOCK).toContain(
      "create index messages_purchase_request_idx\n  on public.messages (purchase_request_id) where purchase_request_id is not null;"
    )
  })

  it("authenticated n'a aucun droit sur purchase_request_id, ni INSERT : seul UPDATE (read) subsiste", () => {
    const toAuthenticated = lines.filter(
      (l) => /^grant /i.test(l) && /public\.messages/.test(l) && /\bto authenticated\b/.test(l)
    )
    expect(toAuthenticated).toEqual([
      "grant SELECT on table public.messages to authenticated;",
      "grant update (read) on table public.messages to authenticated;",
    ])
    expect(BLOCK).not.toMatch(/grant[^;]*public\.messages/i)
    expect(lines.some((l) => /^grant .*purchase_request_id/i.test(l))).toBe(false)
  })

  it("le trigger messages_rules reste le seul trigger de messages", () => {
    const triggers = lines.filter((l) => /^create trigger/i.test(l) && l.includes("ON public.messages "))
    expect(triggers).toHaveLength(1)
    expect(triggers[0]).toContain("messages_rules")
    expect(BLOCK).not.toMatch(/create trigger[^;]*on public\.messages\b/i)
  })
})

describe("schéma de référence : signalements d'achats (script 94)", () => {
  it("reports gagne une colonne, une cible, 4 motifs d'achats et une clé étrangère", () => {
    expect(BLOCK).toContain("alter table public.reports add column purchase_request_id uuid null;")
    expect(listOf(constraint("reports_target_type_check"))).toEqual(["message", "purchase_request"])
    expect(listOf(constraint("reports_reason_check"))).toEqual([
      "harassment",
      "scam",
      "contact_details",
      "inappropriate",
      "other",
      "purchase_amount_mismatch",
      "purchase_payee_mismatch",
      "purchase_vendor_not_paid",
      "purchase_items_not_delivered",
    ])
    expect(BLOCK).toContain(
      "add constraint reports_purchase_request_id_fkey foreign key (purchase_request_id)\n    references public.purchase_requests (id) on delete cascade;"
    )
  })

  it("la cible est exclusive et les motifs d'achats ne recoupent ceux de messages que sur « other »", () => {
    const target = constraint("reports_target_check")
    expect(target).toContain("target_type = 'message' and message_id is not null and purchase_request_id is null")
    expect(target).toContain(
      "target_type = 'purchase_request' and purchase_request_id is not null and message_id is null and source = 'user'"
    )
    const byTarget = constraint("reports_reason_target_check")
    const [messageSide, purchaseSide] = byTarget.split("target_type = 'purchase_request'")
    expect(listOf(messageSide.split("reason in")[1])).toEqual([
      "harassment",
      "scam",
      "contact_details",
      "inappropriate",
      "other",
    ])
    expect(listOf(purchaseSide.split("reason in")[1])).toEqual([
      "purchase_amount_mismatch",
      "purchase_payee_mismatch",
      "purchase_vendor_not_paid",
      "purchase_items_not_delivered",
      "other",
    ])
  })

  it("une partie ne signale une demande qu'une fois, l'autre partie peut le faire aussi", () => {
    expect(BLOCK).toContain(
      "create unique index reports_purchase_reporter_idx\n  on public.reports (purchase_request_id, reporter_id) where purchase_request_id is not null;"
    )
  })

  it("l'ancienne contrainte de cible est remplacée et aucun droit n'est ajouté sur reports", () => {
    const alter = statement(/alter table public\.reports\n  drop constraint reports_target_type_check,/)
    expect(alter).toContain("drop constraint reports_message_target_check,")
    expect(alter).toContain("drop constraint reports_reason_check,")
    expect(BLOCK).not.toMatch(/grant[^;]*public\.reports/i)
    expect(BLOCK).not.toMatch(/create policy[^;]*public\.reports/i)
  })
})

describe("schéma de référence : notifications d'achats (script 94)", () => {
  it("notifications_type_check passe de 14 à 21 types : les 14 d'origine puis les 7 d'achats", () => {
    const original = lines.find((l) => l.includes("alter table public.notifications add constraint notifications_type_check"))
    expect(original).toBeDefined()
    const before = listOf(original)
    expect(before).toHaveLength(14)
    const after = listOf(constraint("notifications_type_check"))
    expect(after).toHaveLength(21)
    expect(after.slice(0, 14)).toEqual(before)
    expect(after.slice(14)).toEqual([
      "purchase_requested",
      "purchase_updated",
      "purchase_cancelled",
      "purchase_paid",
      "purchase_received",
      "purchase_reported",
      "purchase_report_closed",
    ])
    expect(new Set(after).size).toBe(21)
  })

  it("aucun type de notification pour les administrateurs", () => {
    expect(listOf(constraint("notifications_type_check")).some((t) => /admin/.test(t))).toBe(false)
  })
})

describe("schéma de référence : compartiment purchase-proofs (script 94, partie propre à Supabase)", () => {
  it("le compartiment est privé, limité à 10 Mo et aux images", () => {
    const insert = statement(/insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)\nvalues \('purchase-proofs'/)
    expect(insert).toContain("values ('purchase-proofs', 'purchase-proofs', false, 10485760,")
    expect([...insert.matchAll(/'(image\/[a-z]+)'/g)].map((m) => m[1])).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ])
    expect(insert).not.toMatch(/audio|pdf|gif/)
  })

  it("une seule politique, d'insertion, pour authenticated, dans le dossier de l'utilisateur", () => {
    const policies = lines.filter((l) => /^create policy/i.test(l) && l.includes("storage.objects"))
    const own = policies.filter((l) => l.includes("purchase_proofs_insert_own"))
    expect(own).toHaveLength(1)
    expect(own[0]).toContain("as permissive for insert to authenticated")
    const at = BLOCK.indexOf("create policy purchase_proofs_insert_own")
    const text = BLOCK.slice(at, BLOCK.indexOf(";\n", at))
    expect(text).toContain("with check (bucket_id = 'purchase-proofs' and (auth.uid())::text = (storage.foldername(name))[1])")
    // aucune autre politique du fichier ne mentionne le compartiment : aucune lecture, aucun écrasement, aucune suppression
    const others = [...SCHEMA.matchAll(/create policy[^;]*;/gi)]
      .map((m) => m[0])
      .filter((p) => p.includes("storage.objects") && p.includes("purchase-proofs") && !p.includes("purchase_proofs_insert_own"))
    expect(others).toHaveLength(0)
    expect(text).not.toMatch(/for (select|update|delete|all)/i)
  })
})

describe("schéma de référence : section 13 sans effet de bord", () => {
  it("aucun UPDATE ni DELETE de données, aucun enum, aucun jsonb", () => {
    expect(BLOCK).not.toMatch(/^\s*(update|delete from)\s/im)
    expect(BLOCK).not.toMatch(/create type /i)
    expect(tableBody()).not.toMatch(/jsonb|json\b/)
  })
})
