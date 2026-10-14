-- OBSOLETE, NE PAS EXECUTER EN PRODUCTION (RD-SEC-03, 2026-10-14).
-- Motif : redondant (messages est deja dans la publication supabase_realtime), inoffensif.
-- Etat de reference de la base : supabase/schema.sql (regenere depuis la production).

-- Active la réplication Realtime pour la table messages
-- À exécuter dans le SQL Editor du dashboard Supabase

-- Méthode 1 : via la publication supabase_realtime (recommandée)
alter publication supabase_realtime add table public.messages;

-- Vérifier que la publication est active :
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
