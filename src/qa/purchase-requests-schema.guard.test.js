import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Script 94 de RD-ACHATS-01 appliqué en production le 2026-10-17 : le schéma de référence (supabase/schema.sql) décrit l'état
// APRÈS le 94. Ses objets sont fusionnés dans les sections d'origine (3 tables, 4 contraintes, 5 index, 6 fonction,
// 7 triggers, 8 RLS et politique de stockage, 9 privilèges, 10 compartiment) et repérés par « Script 94 ». Ce garde
// vérifie les éléments qui portent la sécurité : statuts, montant, unicités, RLS sans politique, aucun droit pour anon
// ni authenticated, trigger en SECURITY INVOKER à search_path vide, compartiment privé avec sa seule politique
// d'insertion, CHECK de messages à 6 types avec CHECK de lien et clé étrangère composite, aucun droit UPDATE de
// authenticated sur purchase_request_id, 4 motifs d'achats dans reports, 21 types de notifications.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

const listOf = (text) => [...text.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])

// Position d'un titre de section dans le fichier.
const sectionAt = (title) => {
  const at = SCHEMA.indexOf(title)
  expect(at, `section absente : ${title}`).toBeGreaterThan(-1)
  return at
}

// Ligne `alter table ... add constraint <name> ...;` de la section 4 (une seule par nom).
function constraintLine(name) {
  const found = lines.filter((l) => /^alter table /.test(l) && l.includes(` add constraint ${name} `))
  expect(found, `contrainte ${name} : une seule ligne attendue`).toHaveLength(1)
  return found[0]
}

// Définition complète d'une contrainte : tout ce qui suit `add constraint <name> `, « ; » compris. Comparée avec toBe :
// aucune borne, aucun opérateur ni aucun nombre ne passe par une recherche de sous-chaîne.
const constraintDef = (name) => constraintLine(name).replace(/^alter table \S+ add constraint \S+ /, "")

// Ligne complète d'une colonne dans le corps d'une table (indentation et virgule comprises, comparée par égalité).
const columnLines = (table) => tableBody(table).split("\n").map((l) => l.trim())

// `(<col> = ANY (ARRAY['a'::text, 'b'::text]))` : liste fermée de valeurs telle que l'écrit pg_dump.
const anyOf = (col, values) => `(${col} = ANY (ARRAY[${values.map((v) => `'${v}'::text`).join(", ")}]))`

// Texte d'une instruction multi-lignes : de son premier motif jusqu'au « ; » de fin de ligne.
function statement(startPattern) {
  const match = SCHEMA.match(startPattern)
  expect(match, `instruction absente : ${startPattern}`).not.toBeNull()
  const to = SCHEMA.indexOf(";\n", match.index)
  expect(to).toBeGreaterThan(match.index)
  return SCHEMA.slice(match.index, to + 1)
}

function tableBody(name) {
  const start = SCHEMA.indexOf(`create table public.${name} (`)
  expect(start, `table ${name} absente`).toBeGreaterThan(-1)
  return SCHEMA.slice(start, SCHEMA.indexOf("\n);", start))
}

function guardFunction() {
  const start = SCHEMA.indexOf("CREATE OR REPLACE FUNCTION public.guard_purchase_requests()")
  expect(start).toBeGreaterThan(-1)
  const end = SCHEMA.indexOf("$function$;", SCHEMA.indexOf("$function$", start) + 1)
  expect(end).toBeGreaterThan(start)
  return SCHEMA.slice(start, end)
}

const onPurchaseRequests = lines.filter((l) => l.includes("public.purchase_requests"))

describe("schéma de référence : état après le script 94, fusionné dans les sections d'origine", () => {
  it("l'en-tête signale le script 94 comme appliqué en production le 2026-10-17, après le 93", () => {
    const head = lines.slice(0, 40).join("\n")
    expect(head).toContain("Script 94 de RD-ACHATS-01 appliqué en production le 2026-10-17.")
    expect(head).not.toContain("Script 94 de RD-ACHATS-01 NON appliqué")
    expect(head).not.toContain("à retirer de cet en-tête après application")
    expect(SCHEMA).not.toMatch(/NON appliqu/)
    expect(head).toContain("strictement après le script 93")
  })

  it("aucune section 13 ni marqueur : le script 94 n'est plus un bloc à part", () => {
    expect(SCHEMA).not.toContain("-- 13. SCRIPT 94")
    expect(SCHEMA).not.toMatch(/>>> SCRIPT 94|<<< SCRIPT 94/)
    expect(SCHEMA).not.toContain("les lignes d'origine plus haut décrivent l'état d'avant le 94")
  })

  it("chaque objet est dans la section qui lui revient", () => {
    const s3 = sectionAt("-- 3. TABLES")
    const s4 = sectionAt("-- 4. CONTRAINTES")
    const s5 = sectionAt("-- 5. INDEX")
    const s6 = sectionAt("-- 6. FONCTIONS")
    const s7 = sectionAt("-- 7. TRIGGERS")
    const s8 = sectionAt("-- 8. RLS ET POLITIQUES")
    const s9 = sectionAt("-- 9. PRIVILÈGES")
    const s10 = sectionAt("-- 10. BUCKETS")
    const s11 = sectionAt("-- 11. REALTIME")
    const at = (needle) => {
      const index = SCHEMA.indexOf(needle)
      expect(index, needle).toBeGreaterThan(-1)
      return index
    }
    const within = (index, from, to, label) => {
      expect(index, label).toBeGreaterThan(from)
      expect(index, label).toBeLessThan(to)
    }
    within(at("create table public.purchase_requests ("), s3, s4, "table")
    within(at("purchase_requests_pkey PRIMARY KEY"), s4, s5, "contraintes")
    within(at("CREATE INDEX purchase_requests_student_id_idx"), s5, s6, "index")
    within(at("CREATE OR REPLACE FUNCTION public.guard_purchase_requests()"), s6, s7, "fonction")
    within(at("CREATE TRIGGER guard_purchase_requests"), s7, s8, "trigger")
    within(at("alter table public.purchase_requests enable row level security;"), s8, s9, "RLS")
    within(at("create policy purchase_proofs_insert_own"), s8, s9, "politique de stockage")
    within(at("revoke all on table public.purchase_requests"), s9, s10, "privilèges")
    within(at("values ('purchase-proofs'"), s10, s11, "compartiment")
  })
})

describe("schéma de référence : table purchase_requests (script 94)", () => {
  it("les statuts sont exactement pending, paid, received, reported, cancelled, par défaut pending", () => {
    expect(listOf(constraintLine("purchase_requests_status_check"))).toEqual([
      "pending",
      "paid",
      "received",
      "reported",
      "cancelled",
    ])
    expect(constraintDef("purchase_requests_status_check")).toBe(
      `CHECK (${anyOf("status", ["pending", "paid", "received", "reported", "cancelled"])});`
    )
    expect(columnLines("purchase_requests")).toContain("status text default 'pending'::text not null,")
  })

  it("le montant est un entier de 100 à 500 000, le numéro de demande de 1 à 99", () => {
    expect(columnLines("purchase_requests")).toContain("amount integer not null,")
    expect(constraintDef("purchase_requests_amount_check")).toBe("CHECK (((amount >= 100) AND (amount <= 500000)));")
    expect(columnLines("purchase_requests")).toContain("seq integer not null,")
    expect(constraintDef("purchase_requests_seq_check")).toBe("CHECK (((seq >= 1) AND (seq <= 99)));")
  })

  it("un numéro par mission et la paire (id, mission_id) sont uniques, la version démarre à 1", () => {
    expect(constraintDef("purchase_requests_pkey")).toBe("PRIMARY KEY (id);")
    expect(constraintDef("purchase_requests_mission_seq_key")).toBe("UNIQUE (mission_id, seq);")
    expect(constraintDef("purchase_requests_id_mission_key")).toBe("UNIQUE (id, mission_id);")
    expect(columnLines("purchase_requests")).toContain("version integer default 1 not null,")
    expect(constraintDef("purchase_requests_version_check")).toBe(
      "CHECK (((version >= 1) AND ((version = 1) = (edited_at IS NULL))));"
    )
  })

  it("les formats du numéro à payer, du vendeur et des photos sont bornés par la base", () => {
    expect(listOf(constraintLine("purchase_requests_payee_kind_check"))).toEqual(["merchant", "personal"])
    expect(constraintDef("purchase_requests_payee_kind_check")).toBe(
      `CHECK (${anyOf("payee_kind", ["merchant", "personal"])});`
    )
    expect(constraintDef("purchase_requests_payee_number_check")).toBe(
      "CHECK ((((payee_kind = 'merchant'::text) AND (payee_number ~ '^[0-9]{4,10}$'::text)) OR ((payee_kind = 'personal'::text) AND (payee_number ~ '^\\+22901[0-9]{8}$'::text))));"
    )
    expect(constraintDef("purchase_requests_vendor_name_check")).toBe(
      "CHECK (((char_length(vendor_name) >= 2) AND (char_length(vendor_name) <= 80)));"
    )
    expect(constraintDef("purchase_requests_items_check")).toBe(
      "CHECK (((items IS NULL) OR ((char_length(items) >= 1) AND (char_length(items) <= 120))));"
    )
    // chemin d'une photo : 200 caractères au plus, pas de « .. », dossier <propriétaire>/<id de la demande>/
    const photoPath = (name, owner) =>
      `(char_length(${name}_path) <= 200) AND (strpos(${name}_path, '..'::text) = 0) AND starts_with(${name}_path, ((((${owner})::text || '/'::text) || (id)::text) || '/'::text))`
    expect(constraintDef("purchase_requests_payee_photo_check")).toBe(`CHECK ((${photoPath("payee_photo", "student_id")}));`)
    expect(constraintDef("purchase_requests_ticket_photo_check")).toBe(`CHECK ((${photoPath("ticket_photo", "student_id")}));`)
    expect(constraintDef("purchase_requests_sms_photo_check")).toBe(
      `CHECK (((sms_photo_path IS NULL) OR (${photoPath("sms_photo", "client_id")})));`
    )
    expect(constraintDef("purchase_requests_paid_reference_check")).toBe(
      "CHECK (((paid_reference IS NULL) OR (paid_reference ~ '^[A-Za-z0-9-]{1,40}$'::text)));"
    )
  })

  it("les CHECK de cohérence lient chaque statut à ses colonnes", () => {
    expect(constraintDef("purchase_requests_paid_fields_check")).toBe(
      "CHECK (((status <> 'paid'::text) OR ((paid_at IS NOT NULL) AND (sms_photo_path IS NOT NULL) AND beneficiary_confirmed)));"
    )
    expect(constraintDef("purchase_requests_received_fields_check")).toBe(
      "CHECK (((status <> 'received'::text) OR ((paid_at IS NOT NULL) AND (received_at IS NOT NULL))));"
    )
    expect(constraintDef("purchase_requests_cancelled_fields_check")).toBe(
      "CHECK (((status <> 'cancelled'::text) OR ((cancelled_at IS NOT NULL) AND (paid_at IS NULL))));"
    )
    expect(constraintDef("purchase_requests_reported_fields_check")).toBe(
      "CHECK (((status <> 'reported'::text) OR (reported_at IS NOT NULL)));"
    )
    expect(constraintDef("purchase_requests_end_check")).toBe(
      "CHECK ((((cancelled_at IS NOT NULL) = (status = 'cancelled'::text)) AND ((reported_at IS NOT NULL) = (status = 'reported'::text)) AND ((received_at IS NULL) OR ((paid_at IS NOT NULL) AND (status = ANY (ARRAY['received'::text, 'reported'::text]))))));"
    )
    expect(constraintDef("purchase_requests_parties_check")).toBe("CHECK ((student_id <> client_id));")
  })

  it("la suppression d'une mission emporte les demandes (cascade) ; celle d'un compte est refusée (RESTRICT, script 96)", () => {
    expect(constraintDef("purchase_requests_mission_id_fkey")).toBe(
      "FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;"
    )
    expect(constraintDef("purchase_requests_student_id_fkey")).toBe(
      "FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;"
    )
    expect(constraintDef("purchase_requests_client_id_fkey")).toBe(
      "FOREIGN KEY (client_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;"
    )
    expect(onPurchaseRequests.some((l) => l.includes("auth.users"))).toBe(false)
    expect(guardFunction()).toContain("Demande d''achats : suppression interdite.")
  })

  it("la RLS est activée sans aucune politique sur la table", () => {
    expect(lines).toContain("alter table public.purchase_requests enable row level security;")
    expect(
      lines.filter((l) => /^create policy/i.test(l) && l.includes("on public.purchase_requests")),
      "politique sur purchase_requests"
    ).toHaveLength(0)
  })

  it("aucun droit pour anon, authenticated ni public : service_role INSERT, SELECT, UPDATE seulement", () => {
    expect(lines).toContain("revoke all on table public.purchase_requests from public, anon, authenticated, service_role;")
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("public.purchase_requests"))
    expect(grants).toEqual(["grant INSERT, SELECT, UPDATE on table public.purchase_requests to service_role;"])
    expect(grants.some((l) => /\b(anon|authenticated|public)\b/.test(l.replace("public.purchase_requests", "")))).toBe(false)
    expect(grants.some((l) => /delete|truncate|references|trigger/i.test(l))).toBe(false)
  })

  it("la table n'est pas dans la publication realtime", () => {
    const realtime = lines.filter((l) => /alter publication supabase_realtime/i.test(l))
    expect(realtime).toEqual(["alter publication supabase_realtime add table public.messages;"])
  })

  it("les index des deux parties existent", () => {
    expect(lines).toContain(
      "CREATE INDEX purchase_requests_student_id_idx ON public.purchase_requests USING btree (student_id);"
    )
    expect(lines).toContain(
      "CREATE INDEX purchase_requests_client_id_idx ON public.purchase_requests USING btree (client_id);"
    )
  })
})

describe("schéma de référence : trigger de la machine à états (script 94)", () => {
  it("la fonction de garde est en SECURITY INVOKER à search_path vide, sans droit pour les rôles de l'API", () => {
    const fn = guardFunction()
    const header = fn.slice(0, fn.indexOf("AS $function$"))
    expect(header).toContain("RETURNS trigger")
    expect(header).toContain("SET search_path TO ''")
    expect(header).not.toMatch(/SECURITY DEFINER/i)
    expect(lines).toContain(
      "revoke all on function public.guard_purchase_requests() from public, anon, authenticated, service_role;"
    )
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("function public.guard_purchase_requests()"))
    expect(grants).toEqual(["grant execute on function public.guard_purchase_requests() to service_role;"])
  })

  it("le trigger garde INSERT, UPDATE et DELETE, l'horodatage est posé par update_updated_at", () => {
    expect(lines).toContain(
      "CREATE TRIGGER guard_purchase_requests BEFORE INSERT OR DELETE OR UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_requests();"
    )
    expect(lines).toContain(
      "CREATE TRIGGER trg_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();"
    )
    const triggers = lines.filter((l) => /^CREATE TRIGGER/.test(l) && l.includes("ON public.purchase_requests "))
    expect(triggers).toHaveLength(2)
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
    expect(fn).toMatch(/new\.version is distinct from old\.version \+ 1\b/)
    expect(fn.match(/errcode = '42501'/g).length).toBeGreaterThanOrEqual(10)
  })
})

describe("schéma de référence : messages d'achat (script 94)", () => {
  it("messages_type_check passe à 6 types et un CHECK de lien impose le type d'achat si et seulement si purchase_request_id", () => {
    expect(listOf(constraintLine("messages_type_check"))).toEqual([
      "text",
      "voice",
      "image",
      "location",
      "purchase_request",
      "purchase_event",
    ])
    expect(constraintDef("messages_type_check")).toBe(
      `CHECK (${anyOf("type", ["text", "voice", "image", "location", "purchase_request", "purchase_event"])});`
    )
    expect(constraintDef("messages_purchase_link_check")).toBe(
      "CHECK (((type = ANY (ARRAY['purchase_request'::text, 'purchase_event'::text])) = (purchase_request_id IS NOT NULL)));"
    )
  })

  it("la clé étrangère composite impose la même mission", () => {
    expect(constraintLine("messages_purchase_request_fkey")).toBe(
      "alter table public.messages add constraint messages_purchase_request_fkey FOREIGN KEY (purchase_request_id, mission_id) REFERENCES public.purchase_requests(id, mission_id) ON DELETE CASCADE;"
    )
    expect(columnLines("messages")).toContain("purchase_request_id uuid")
    expect(lines).toContain(
      "CREATE INDEX messages_purchase_request_idx ON public.messages USING btree (purchase_request_id) WHERE (purchase_request_id IS NOT NULL);"
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
    expect(lines.some((l) => /^grant .*purchase_request_id/i.test(l))).toBe(false)
    const toAnon = lines.filter((l) => /^grant /i.test(l) && /public\.messages/.test(l) && /\bto anon\b/.test(l))
    expect(toAnon).toEqual(["grant SELECT on table public.messages to anon;"])
  })

  it("le trigger messages_rules reste le seul trigger de messages", () => {
    const triggers = lines.filter((l) => /^create trigger/i.test(l) && l.includes("ON public.messages "))
    expect(triggers).toHaveLength(1)
    expect(triggers[0]).toContain("messages_rules")
  })
})

describe("schéma de référence : signalements d'achats (script 94)", () => {
  it("reports gagne une colonne, une cible, 4 motifs d'achats et une clé étrangère", () => {
    expect(columnLines("reports")).toContain("purchase_request_id uuid")
    expect(listOf(constraintLine("reports_target_type_check"))).toEqual(["message", "purchase_request"])
    expect(constraintDef("reports_target_type_check")).toBe(
      `CHECK (${anyOf("target_type", ["message", "purchase_request"])});`
    )
    expect(constraintDef("reports_details_check")).toBe("CHECK ((char_length(details) <= 1000));")
    expect(listOf(constraintLine("reports_reason_check"))).toEqual([
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
    expect(constraintDef("reports_reason_check")).toBe(
      `CHECK (${anyOf("reason", [
        "harassment",
        "scam",
        "contact_details",
        "inappropriate",
        "other",
        "purchase_amount_mismatch",
        "purchase_payee_mismatch",
        "purchase_vendor_not_paid",
        "purchase_items_not_delivered",
      ])});`
    )
    expect(constraintLine("reports_purchase_request_id_fkey")).toBe(
      "alter table public.reports add constraint reports_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;"
    )
  })

  it("la cible est exclusive et les motifs d'achats ne recoupent ceux de messages que sur « other »", () => {
    expect(constraintDef("reports_target_check")).toBe(
      "CHECK ((((target_type = 'message'::text) AND (message_id IS NOT NULL) AND (purchase_request_id IS NULL)) OR ((target_type = 'purchase_request'::text) AND (purchase_request_id IS NOT NULL) AND (message_id IS NULL) AND (source = 'user'::text))));"
    )
    expect(constraintDef("reports_reason_target_check")).toBe(
      `CHECK ((((target_type = 'message'::text) AND (reason = ANY (ARRAY['harassment'::text, 'scam'::text, 'contact_details'::text, 'inappropriate'::text, 'other'::text]))) OR ((target_type = 'purchase_request'::text) AND (reason = ANY (ARRAY['purchase_amount_mismatch'::text, 'purchase_payee_mismatch'::text, 'purchase_vendor_not_paid'::text, 'purchase_items_not_delivered'::text, 'other'::text])))));`
    )
    const byTarget = constraintLine("reports_reason_target_check")
    const [messageSide, purchaseSide] = byTarget.split("(target_type = 'purchase_request'::text)")
    expect(listOf(messageSide.split("(target_type = 'message'::text)")[1])).toEqual([
      "harassment",
      "scam",
      "contact_details",
      "inappropriate",
      "other",
    ])
    expect(listOf(purchaseSide)).toEqual([
      "purchase_amount_mismatch",
      "purchase_payee_mismatch",
      "purchase_vendor_not_paid",
      "purchase_items_not_delivered",
      "other",
    ])
  })

  it("une partie ne signale une demande qu'une fois, l'autre partie peut le faire aussi", () => {
    expect(lines).toContain(
      "CREATE UNIQUE INDEX reports_purchase_reporter_idx ON public.reports USING btree (purchase_request_id, reporter_id) WHERE (purchase_request_id IS NOT NULL);"
    )
  })

  it("l'ancienne contrainte de cible est remplacée et aucun droit ni politique n'est ajouté sur reports", () => {
    expect(lines.some((l) => /^alter table /.test(l) && l.includes("reports_message_target_check"))).toBe(false)
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("public.reports"))
    expect(grants).toEqual([
      "grant DELETE, INSERT, SELECT, UPDATE on table public.reports to service_role;",
      "grant USAGE, SELECT on sequence public.reports_number_seq to service_role;",
    ])
    expect(lines.some((l) => /^create policy/i.test(l) && l.includes("public.reports"))).toBe(false)
  })
})

describe("schéma de référence : notifications d'achats (script 94)", () => {
  const ORIGINAL_14 = [
    "application_received",
    "application_accepted",
    "application_rejected",
    "mission_cancelled",
    "payment_released",
    "review_received",
    "verification_approved",
    "verification_rejected",
    "verification_reset",
    "badge_revoked",
    "account_reactivated",
    "card_submitted",
    "message_received",
    "completion_declared",
  ]

  it("notifications_type_check passe de 14 à 21 types : les 14 d'origine puis les 7 d'achats", () => {
    const after = listOf(constraintLine("notifications_type_check"))
    expect(after).toHaveLength(21)
    expect(after.slice(0, 14)).toEqual(ORIGINAL_14)
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
    expect(constraintDef("notifications_type_check")).toBe(`CHECK (${anyOf("type", after)});`)
  })

  it("aucun type de notification pour les administrateurs", () => {
    expect(listOf(constraintLine("notifications_type_check")).some((t) => /admin/.test(t))).toBe(false)
  })
})

describe("schéma de référence : compartiment purchase-proofs (script 94, partie propre à Supabase)", () => {
  it("le compartiment est privé, limité à 10 Mo et aux images", () => {
    const insert = statement(
      /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)\nvalues \('purchase-proofs'/
    )
    expect(insert).toMatch(/^values \('purchase-proofs', 'purchase-proofs', false, 10485760,/m)
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
    const policies = [...SCHEMA.matchAll(/create policy[^;]*;/gi)].map((m) => m[0])
    const mentioning = policies.filter((p) => p.includes("purchase-proofs") || p.includes("purchase_proofs"))
    expect(mentioning).toHaveLength(1)
    const own = mentioning[0]
    expect(own).toContain("create policy purchase_proofs_insert_own on storage.objects as permissive for insert to authenticated")
    expect(own).toContain(
      "with check (((bucket_id = 'purchase-proofs'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))"
    )
    // aucune lecture, aucun écrasement, aucune suppression sur le compartiment
    expect(own).not.toMatch(/for (select|update|delete|all)/i)
    expect(own).not.toMatch(/to (public|anon)\b/)
  })
})

describe("schéma de référence : le script 94 sans effet de bord", () => {
  it("aucun enum ni jsonb pour les demandes d'achats", () => {
    expect(SCHEMA).not.toMatch(/create type [^;]*purchase/i)
    expect(tableBody("purchase_requests")).not.toMatch(/jsonb|json\b/)
  })

  it("la fonction de garde ne modifie aucune donnée", () => {
    expect(guardFunction()).not.toMatch(/^\s*(update|delete from|insert into)\s/im)
  })
})
