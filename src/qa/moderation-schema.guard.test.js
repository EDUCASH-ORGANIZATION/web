import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// RD-MSG-01 : le schéma de référence (supabase/schema.sql) décrit les tables message_contact_events et
// reports telles que le script 92 les crée, et le droit INSERT de messages tel que le script 93 le laisse.
// Il décrit aussi reports APRÈS le script 94 de RD-ACHATS-01 (NON appliqué en production) : cible
// purchase_request, 4 motifs d'achats, contrainte de cible remplacée, motifs liés à la cible, une
// signalisation par partie et par demande. Ce garde vérifie en dur les éléments qui portent la sécurité :
// listes des CHECK, RLS activée sans politique, aucun droit pour anon ni authenticated, aucun temps réel,
// aucun INSERT direct sur messages.
const SCHEMA = readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8")
const lines = SCHEMA.split("\n")

const TABLES = ["message_contact_events", "reports"]
const onTable = (name) => lines.filter((l) => l.includes(`public.${name}`))
const check = (name) => {
  const line = lines.find((l) => l.includes(` ${name} CHECK `))
  expect(line, `contrainte ${name} absente`).toBeDefined()
  return line
}
const listOf = (line) => [...line.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])

describe("schéma de référence : journal des détections (script 92)", () => {
  it("la liste du CHECK sur kinds est exactement la liste attendue", () => {
    expect(listOf(check("message_contact_events_kinds_check"))).toEqual([
      "phone",
      "email",
      "link",
      "social",
      "phone_split",
      "contact_keyword",
      "payment_keyword",
    ])
    expect(check("message_contact_events_kinds_check")).toContain("cardinality(kinds) >= 1")
  })

  it("la liste du CHECK sur action est exactement masked et flagged", () => {
    expect(listOf(check("message_contact_events_action_check"))).toEqual(["masked", "flagged"])
  })

  it("match_count est borné de 1 à 50", () => {
    expect(check("message_contact_events_match_count_check")).toContain(
      "((match_count >= 1) AND (match_count <= 50))"
    )
  })

  it("le journal garde le message en cas de suppression (SET NULL), pas la mission ni l'expéditeur", () => {
    expect(SCHEMA).toContain(
      "message_contact_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;"
    )
    expect(SCHEMA).toContain(
      "message_contact_events_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;"
    )
    expect(SCHEMA).toContain(
      "message_contact_events_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;"
    )
  })

  it("les index des clés étrangères et de l'historique existent", () => {
    const expected = [
      "CREATE INDEX message_contact_events_message_id_idx ON public.message_contact_events USING btree (message_id);",
      "CREATE INDEX message_contact_events_mission_id_idx ON public.message_contact_events USING btree (mission_id);",
      "CREATE INDEX reports_mission_id_idx ON public.reports USING btree (mission_id);",
      "CREATE INDEX reports_reporter_created_idx ON public.reports USING btree (reporter_id, created_at DESC);",
      "CREATE INDEX reports_reported_created_idx ON public.reports USING btree (reported_user_id, created_at DESC);",
      "CREATE INDEX reports_status_created_idx ON public.reports USING btree (status, created_at DESC);",
    ]
    for (const line of expected) expect(SCHEMA).toContain(line)
  })

  it("l'index de récidive porte (sender_id, created_at DESC)", () => {
    expect(SCHEMA).toContain(
      "CREATE INDEX message_contact_events_sender_created_idx ON public.message_contact_events USING btree (sender_id, created_at DESC);"
    )
  })
})

describe("schéma de référence : signalements (script 92)", () => {
  it("source, target_type, motif et statut ont exactement les listes attendues", () => {
    expect(listOf(check("reports_source_check"))).toEqual(["user", "auto"])
    expect(listOf(check("reports_target_type_check"))).toEqual(["message", "purchase_request"])
    expect(listOf(check("reports_reason_check"))).toEqual([
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
    expect(listOf(check("reports_status_check"))).toEqual(["open", "in_progress", "resolved", "dismissed"])
  })

  it("le défaut du statut est open et les textes libres sont bornés", () => {
    expect(SCHEMA).toContain("status text default 'open'::text not null,")
    expect(check("reports_details_check")).toContain("(char_length(details) <= 1000)")
    expect(check("reports_resolution_note_check")).toContain("(char_length(resolution_note) <= 500)")
  })

  it("l'auteur du signalement existe si et seulement si la source est user, et ne se signale pas lui-même", () => {
    expect(check("reports_reporter_source_check")).toContain(
      "(((source = 'user'::text) AND (reporter_id IS NOT NULL)) OR ((source = 'auto'::text) AND (reporter_id IS NULL)))"
    )
    expect(check("reports_not_self_check")).toContain("(reporter_id <> reported_user_id)")
  })

  it("la cible est exclusive : un message porte message_id, une demande d'achats porte purchase_request_id (script 94)", () => {
    const target = check("reports_target_check")
    expect(target).toContain("((target_type = 'message'::text) AND (message_id IS NOT NULL) AND (purchase_request_id IS NULL))")
    expect(target).toContain(
      "((target_type = 'purchase_request'::text) AND (purchase_request_id IS NOT NULL) AND (message_id IS NULL) AND (source = 'user'::text))"
    )
    expect(lines.some((l) => l.includes("reports_message_target_check") && /^alter table /.test(l))).toBe(false)
  })

  it("les motifs sont liés à la cible : 5 motifs de messagerie ou 4 motifs d'achats plus other (script 94)", () => {
    const [messageSide, purchaseSide] = check("reports_reason_target_check").split("(target_type = 'purchase_request'::text)")
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

  it("un seul signalement par message et par auteur, une seule alerte automatique ouverte par utilisateur", () => {
    expect(SCHEMA).toContain(
      "alter table public.reports add constraint reports_message_reporter_key UNIQUE (message_id, reporter_id);"
    )
    expect(SCHEMA).toContain(
      "CREATE UNIQUE INDEX reports_auto_open_per_user_idx ON public.reports USING btree (reported_user_id) WHERE ((source = 'auto'::text) AND (status = ANY (ARRAY['open'::text, 'in_progress'::text])));"
    )
  })

  it("un seul signalement d'achat par demande et par auteur : chaque partie peut signaler une fois (script 94)", () => {
    expect(SCHEMA).toContain(
      "CREATE UNIQUE INDEX reports_purchase_reporter_idx ON public.reports USING btree (purchase_request_id, reporter_id) WHERE (purchase_request_id IS NOT NULL);"
    )
    expect(SCHEMA).toContain(
      "alter table public.reports add constraint reports_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;"
    )
  })

  it("le numéro SIG est une identité GENERATED ALWAYS unique", () => {
    expect(SCHEMA).toContain("number bigint generated always as identity not null,")
    expect(SCHEMA).toContain("alter table public.reports add constraint reports_number_key UNIQUE (number);")
  })

  it("la suppression d'un compte emporte ses signalements (signalant comme signalé), jamais de blocage", () => {
    expect(SCHEMA).toContain(
      "reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;"
    )
    expect(SCHEMA).toContain(
      "reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;"
    )
    const fks = onTable("reports").filter((l) => l.includes("FOREIGN KEY") && !l.includes("handled_by"))
    expect(fks.every((l) => l.includes("ON DELETE CASCADE"))).toBe(true)
  })

  it("les clés étrangères visent les tables publiques, jamais auth.users", () => {
    for (const name of TABLES) {
      const fks = onTable(name).filter((l) => l.includes("FOREIGN KEY"))
      expect(fks.length).toBeGreaterThan(0)
      expect(fks.some((l) => l.includes("auth.users"))).toBe(false)
    }
    expect(onTable("reports").filter((l) => l.includes("FOREIGN KEY"))).toHaveLength(6)
    expect(onTable("message_contact_events").filter((l) => l.includes("FOREIGN KEY"))).toHaveLength(3)
  })
})

describe("schéma de référence : tables de modération réservées au serveur", () => {
  it("la RLS est activée et aucune politique n'existe", () => {
    for (const name of TABLES) {
      expect(SCHEMA).toContain(`alter table public.${name} enable row level security;`)
      expect(
        lines.filter((l) => /^create policy/i.test(l) && l.includes(`on public.${name}`)),
        `politique sur ${name}`
      ).toHaveLength(0)
    }
  })

  it("aucun droit pour anon, authenticated ni public, service_role seulement", () => {
    for (const name of TABLES) {
      expect(SCHEMA).toContain(
        `revoke all on table public.${name} from public, anon, authenticated, service_role;`
      )
      const grants = onTable(name).filter((l) => /^grant .* on table /i.test(l))
      expect(grants).toEqual([`grant DELETE, INSERT, SELECT, UPDATE on table public.${name} to service_role;`])
    }
  })

  it("la séquence d'identité n'est utilisable que par service_role", () => {
    expect(SCHEMA).toContain(
      "revoke all on sequence public.reports_number_seq from public, anon, authenticated, service_role;"
    )
    const grants = lines.filter((l) => /^grant /i.test(l) && l.includes("public.reports_number_seq"))
    expect(grants).toEqual(["grant USAGE, SELECT on sequence public.reports_number_seq to service_role;"])
  })

  it("aucun trigger, aucune fonction, aucun enum, aucun jsonb sur ces tables", () => {
    for (const name of TABLES) {
      expect(lines.filter((l) => /^create trigger/i.test(l) && l.includes(`ON public.${name}`))).toHaveLength(0)
      const start = SCHEMA.indexOf(`create table public.${name} (`)
      expect(start).toBeGreaterThan(-1)
      const table = SCHEMA.slice(start, SCHEMA.indexOf(");", start))
      expect(table).not.toMatch(/jsonb|json\b/)
    }
    expect(SCHEMA).not.toMatch(/create type public\.(report|message_contact)/i)
  })

  it("les tables ne sont pas dans la publication supabase_realtime", () => {
    const realtime = lines.filter((l) => /alter publication supabase_realtime/i.test(l))
    expect(realtime).toEqual(["alter publication supabase_realtime add table public.messages;"])
  })
})

describe("schéma de référence : messages sans INSERT direct (script 93)", () => {
  it("authenticated n'a que SELECT sur messages, plus UPDATE (read)", () => {
    const grants = onTable("messages").filter((l) => /^grant /i.test(l) && /\bto authenticated\b/.test(l))
    expect(grants).toEqual([
      "grant SELECT on table public.messages to authenticated;",
      "grant update (read) on table public.messages to authenticated;",
    ])
    expect(grants.some((l) => /insert/i.test(l))).toBe(false)
  })

  it("anon n'a pas INSERT sur messages et service_role le garde", () => {
    const toAnon = onTable("messages").filter((l) => /^grant /i.test(l) && /\bto anon\b/.test(l))
    expect(toAnon).toEqual(["grant SELECT on table public.messages to anon;"])
    expect(SCHEMA).toContain(
      "grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.messages to service_role;"
    )
  })

  it("le trigger messages_rules reste en place", () => {
    expect(SCHEMA).toContain(
      "CREATE TRIGGER messages_rules BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_rules();"
    )
  })
})

describe("schéma de référence : en-tête des scripts 92 et 93", () => {
  const header = lines.slice(0, 30).join("\n")

  it("signale que les scripts 92 et 93 sont appliqués en production", () => {
    expect(header).toContain("Script 92 de RD-MSG-01 appliqué en production le 2026-10-16.")
    expect(header).toContain("Script 93 de RD-MSG-01 appliqué en production le 2026-10-16.")
    expect(header).not.toContain(
      "Script 93 de RD-MSG-01 (retrait du droit INSERT sur public.messages à authenticated) NON appliqué"
    )
    expect(header).not.toContain("Scripts 92 et 93 de RD-MSG-01 NON appliqués")
  })

  it("seul le script 94 de RD-ACHATS-01 reste « NON appliqué » dans l'en-tête", () => {
    const notApplied = header.split("\n").filter((l) => /NON appliqu/.test(l))
    expect(notApplied).toHaveLength(1)
    expect(notApplied[0]).toContain("Script 94 de RD-ACHATS-01 NON appliqué en production")
  })

  it("aucune mention « NON appliqué » ne concerne les scripts 92 et 93 dans tout le fichier", () => {
    const stale = lines.filter(
      (l, i) => /NON appliqu/.test(l) && /\b9[23]\b/.test(`${lines[i - 1] ?? ""} ${l} ${lines[i + 1] ?? ""}`) && !/Script 94/.test(l)
    )
    expect(stale).toEqual([])
    const withNotApplied = lines.filter((l) => /NON appliqu/.test(l))
    expect(withNotApplied.every((l) => l.includes("Script 94"))).toBe(true)
  })
})
