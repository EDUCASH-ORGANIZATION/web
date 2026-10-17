# Purge automatique des données (RD-PURGE-01)

Ce document explique ce que supprime la purge quotidienne, comment la mettre en service, la tester à la main et la couper. Les règles (durées, gardes) sont dans `src/lib/purge/purge-rules.js`, les suppressions dans `src/lib/actions/purge-rows.js` et `src/lib/actions/purge-files.js`.

## Ce que la purge supprime

| Cat. | Donnée | Conservation | Nature |
|---|---|---|---|
| P1 | Journal des détections (`message_contact_events`) | 180 jours | lignes |
| P2 | Signalements clôturés (`reports`, statuts `resolved` ou `dismissed`) | 12 mois après la clôture | lignes |
| P3 | Preuves d'achats non référencées (`purchase-proofs`) | 7 jours de grâce | fichiers |
| P8 | Comptes fermés depuis plus de 14 jours (`closed_accounts`) | 14 jours après la fermeture | pseudonymisation du compte (aucune ligne de compte supprimée) |
| P5 | Médias de messagerie non référencés (`message-media`) | 7 jours de grâce | fichiers |
| P6 | Photos de profil et logos non référencés (`avatars`) | 7 jours de grâce | fichiers |
| P7 | Cartes étudiantes non référencées (`student-cards`) | 7 jours de grâce | fichiers |
| P4 | Preuves d'achats encore référencées | 12 mois après la fin de la mission (`done` ou `cancelled`) | fichiers seulement |

Précisions :

- Un signalement `open` ou `in_progress` n'est jamais supprimé. Une preuve P4 n'est jamais supprimée tant qu'un signalement de sa demande est ouvert.
- Un fichier est dit non référencé quand aucune ligne existante ne le désigne. Il n'est supprimé qu'après 7 jours de grâce, calculés sur sa date de création (donc jamais moins de 7 jours après son envoi). Une version remplacée d'une preuve d'une demande existante n'est pas supprimée tant qu'un signalement de cette demande est ouvert.
- Si la lecture des références d'un dossier échoue ou est illisible (URL d'une autre origine, format inconnu), tout le dossier est ignoré et compté dans `ignores`. Rien n'est supprimé dans le doute.
- Les lignes d'achats (`purchase_requests`) sont conservées : seuls les fichiers de preuves peuvent être supprimés (P4).
- Les transactions (`transactions`, `wallet_transactions`) ne sont jamais supprimées : conservation comptable de 10 ans (OHADA). Un garde-fou de tests interdit aux modules de purge de les toucher.
- Ordre d'exécution : P1 (`contact_events`), P2 (`closed_reports`), P8 (`closed_accounts`), puis les preuves d'achats (P3 et P4 traitées en un seul parcours, comptées `proof_orphans` et `proof_expired`), puis P5 (`message_media`), P6 (`avatars`) et P7 (`student_cards`). Dans le résumé, les catégories apparaissent dans cet ordre : `contact_events`, `closed_reports`, `closed_accounts`, `proof_orphans`, `message_media`, `avatars`, `student_cards`, `proof_expired`. Une erreur dans une catégorie n'arrête pas les suivantes.

## La route et le planificateur

- Route : `GET /api/cron/purge`, appelée chaque jour à 03:00 UTC (04:00 au Bénin) par le cron Vercel déclaré dans `vercel.json` (`0 3 * * *`).
- Un cron Vercel ne tourne que sur le déploiement de production, jamais sur le staging.
- La route est autorisée à passer en mode attente (`PASSTHROUGH_PATHS` dans `src/lib/site/waiting-mode.js`), car elle est protégée par secret.
- Réponses : 503 si `CRON_SECRET` n'est pas défini, 401 si l'en-tête `Authorization` est absent ou faux, 200 avec le résumé sinon. Next exécute GET pour une requête HEAD : un HEAD avec le secret lance donc une vraie purge. Next répond lui-même à OPTIONS ; seules les autres méthodes reçoivent 405.
- Deux appels simultanés sont sans danger : tout est recalculé à chaque passage.

## Variables Vercel (à poser par vous, jamais par un agent)

| Variable | Rôle |
|---|---|
| `CRON_SECRET` | Obligatoire. Secret aléatoire d'au moins 32 caractères, par exemple `openssl rand -hex 32`. Vercel l'envoie dans `Authorization: Bearer ...` à chaque appel du cron. Distinct d'`INTERNAL_API_SECRET`. |
| `PURGE_ENABLED` | Absente ou différente de `true` (chaîne exacte) : simulation seulement, rien n'est supprimé. `true` : suppression réelle, à poser dès la mise en service. |
| `PURGE_ALLOW_MASS` | Exceptionnelle. `true` suspend le coupe-circuit, uniquement le temps d'une purge des données de test, puis à retirer. |

Une variable modifiée n'est prise en compte qu'après un redéploiement de la production.

## Lancer une simulation à la main

La simulation compte ce qui serait supprimé sans rien supprimer. Remplacez `<secret>` par la valeur de `CRON_SECRET` :

```bash
curl -H "Authorization: Bearer <secret>" "https://educash.bj/api/cron/purge?mode=dry"
```

`?mode=dry` force la simulation même si `PURGE_ENABLED` vaut `true` : il reste disponible pour vérifier à tout moment. Aucun autre paramètre n'existe.

## Lire le résumé

La réponse JSON est la même que la ligne unique `[purge]` écrite dans les journaux Vercel (Logs, filtre `[purge]`). Elle contient le mode (`dry` ou `real`), la durée, et pour chaque catégorie :

| Compteur | Sens |
|---|---|
| `examines` | éléments examinés |
| `candidats` | éléments qui seraient (ou ont été) supprimés |
| `supprimes` | éléments réellement supprimés (0 en simulation) |
| `erreurs` | échecs rencontrés |
| `ignores` | éléments laissés de côté par prudence (références illisibles, date absente) |

Les arrêts de sécurité sont listés avec leur motif : `breaker` (coupe-circuit), `deadline` (budget de temps), `error`. Le résumé ne contient jamais d'identifiant, de chemin, de nom, d'e-mail ni de numéro.

## Coupe-circuit et budget de temps

- Coupe-circuit : un compartiment de fichiers est sauté si ses candidats dépassent 50 % des fichiers examinés ET 25 fichiers. Il est évalué sur tout le compartiment, après le parcours complet et avant toute suppression (la simulation le signale aussi). Un arrêt `breaker` est alors journalisé : vérifiez la cause avant toute dérogation par `PURGE_ALLOW_MASS`.
- Budget de temps : aucun nouveau lot n'est lancé après 40 secondes (durée maximale de la route : 60 secondes). Ce qui reste est traité le lendemain (arrêt `deadline`). Si l'échéance arrive pendant le parcours d'un compartiment, rien n'est supprimé dans ce compartiment ce jour-là.
- Lots : 500 lignes par suppression, 100 fichiers par appel de suppression.

## Mise en service

1. Poser `CRON_SECRET` et `PURGE_ENABLED=true` en production, puis redéployer. Les suppressions sont réelles dès le premier passage.
2. Pour vérifier à tout moment ce qui serait supprimé, lancer `?mode=dry` à la main (voir plus haut), puis lire les résumés `[purge]` : `candidats` doit rester plausible, `erreurs` à 0, aucun arrêt `breaker`.
3. Retour arrière : retirer `PURGE_ENABLED` et redéployer. La purge repasse en simulation.

## Limites connues

- Le budget de 40 secondes est commun à toutes les catégories et chaque jour repart du début : quand les volumes grandiront, les derniers compartiments (médias, avatars, cartes) peuvent être retardés.
- Aucun délai d'attente n'est posé sur les appels réseau : un appel bloqué laisse la fonction être tuée à 60 secondes, sans ligne `[purge]` dans les journaux.
- La longueur minimale de `CRON_SECRET` n'est pas imposée par le code : respectez la recommandation ci-dessus.
- Supprimer un signalement d'achat clos libère l'index `reports_purchase_reporter_idx` et peut laisser une demande au statut `reported` sans signalement.

## Clôture de compte

Le script SQL 96 est requis (journal `account_closure_events`, colonnes de cycle, protections en base). Sans lui, la fermeture est refusée.

Cycle d'un compte :

1. Fermeture : l'admin ferme le compte depuis la fiche du compte (Administration, Utilisateurs). La personne ne peut plus se connecter, son profil public est masqué et une confirmation lui est envoyée par e-mail. Aucune donnée n'est effacée à ce stade.
2. Réactivation : pendant 14 jours (`CLOSURE_GRACE_DAYS`), l'admin peut rouvrir le compte depuis la même fiche, à la demande de la personne. Passé la pseudonymisation, la réactivation est impossible.
3. Pseudonymisation : une fois les 14 jours écoulés, le passage quotidien de la purge (catégorie `closed_accounts`) remplace les données personnelles du compte par un libellé neutre et supprime ses notifications et ses candidatures en attente ou refusées. Les lignes comptables, les achats, les messages et les avis sont conservés, rattachés à un compte sans nom.

Ce que vous devez savoir :

- La pseudonymisation n'a lieu que si `PURGE_ENABLED=true`. Sinon, les comptes restent fermés sans être effacés, et la simulation (`?mode=dry`) les compte seulement.
- Un compte n'est pas pseudonymisé tant qu'il a un signalement ou un litige en cours, un solde ou une réserve non nuls, un achat en attente ou une transaction en attente. Il est alors reporté au passage suivant, et l'admin peut le rouvrir.
- Coupe-circuit : si plus de 10 comptes sont à pseudonymiser en même temps, aucun nouveau compte n'est traité (arrêt `breaker`), sauf `PURGE_ALLOW_MASS=true`. Vérifiez la cause avant toute dérogation. Les comptes dont la pseudonymisation était déjà commencée sont terminés. Un passage traite au plus 20 comptes (lots de 20) : le reste est traité les jours suivants.
- Chaque fermeture, réactivation et pseudonymisation est inscrite dans la table `account_closure_events` (identifiant, type d'événement, auteur, motif, date, sans donnée personnelle). L'historique s'affiche sur la fiche admin.
- Staging : la base est partagée avec la production. Pour tester, utilisez un compte de test dédié, jamais un vrai compte.
- Ne jamais supprimer un compte dans le tableau de bord Supabase (Authentication), ni une ligne de `profiles` ou de `missions` dans l'éditeur de tables : la suppression effacerait en cascade des données comptables à conserver 10 ans. Fermez le compte depuis la fiche admin.
- Les fichiers du compte (avatar, carte étudiante) sont supprimés lors de la pseudonymisation ; les fichiers orphelins restants sont purgés ensuite par P3, P5, P6 et P7.
- Le script 97, à venir, traitera la cascade des missions.

## Reporté

- Script SQL 95 (index) : reporté, aucun besoin aux volumes actuels, le code n'en dépend pas.
- Effacement du numéro ou du nom du vendeur dans `purchase_requests` : chantier séparé (le trigger `guard_purchase_requests` l'interdit).

## Modifier la purge

Une nouvelle donnée à durée limitée ou un nouveau compartiment s'ajoute dans `src/lib/purge/purge-rules.js` et dans les modules `purge-*.js`. Un changement de durée touche aussi le texte de la politique de confidentialité, qui doit rester identique.
