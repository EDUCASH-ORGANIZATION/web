# Purge automatique des données (RD-PURGE-01)

Ce document explique ce que supprime la purge quotidienne, comment la mettre en service, la tester à la main et la couper. Les règles (durées, gardes) sont dans `src/lib/purge/purge-rules.js`, les suppressions dans `src/lib/actions/purge-rows.js` et `src/lib/actions/purge-files.js`.

## Ce que la purge supprime

| Cat. | Donnée | Conservation | Nature |
|---|---|---|---|
| P1 | Journal des détections (`message_contact_events`) | 180 jours | lignes |
| P2 | Signalements clôturés (`reports`, statuts `resolved` ou `dismissed`) | 12 mois après la clôture | lignes |
| P3 | Preuves d'achats non référencées (`purchase-proofs`) | 7 jours de grâce | fichiers |
| P5 | Médias de messagerie non référencés (`message-media`) | 7 jours de grâce | fichiers |
| P6 | Photos de profil et logos non référencés (`avatars`) | 7 jours de grâce | fichiers |
| P7 | Cartes étudiantes non référencées (`student-cards`) | 7 jours de grâce | fichiers |
| P4 | Preuves d'achats encore référencées | 12 mois après la fin de la mission (`done` ou `cancelled`) | fichiers seulement |

Précisions :

- Un signalement `open` ou `in_progress` n'est jamais supprimé. Une preuve P4 n'est jamais supprimée tant qu'un signalement de sa demande est ouvert.
- Un fichier est dit non référencé quand aucune ligne existante ne le désigne. Il n'est supprimé qu'après 7 jours de grâce, calculés sur sa date de création.
- Si la lecture des références d'un dossier échoue ou est illisible (URL d'une autre origine, format inconnu), tout le dossier est ignoré et compté dans `ignores`. Rien n'est supprimé dans le doute.
- Les lignes d'achats (`purchase_requests`) sont conservées : seuls les fichiers de preuves peuvent être supprimés (P4).
- Les transactions (`transactions`, `wallet_transactions`) ne sont jamais supprimées : conservation comptable de 10 ans (OHADA). Un garde-fou de tests interdit aux modules de purge de les toucher.
- Ordre d'exécution : P1, P2, puis P3, P5, P6, P7, P4. Une erreur dans une catégorie n'arrête pas les suivantes.

## La route et le planificateur

- Route : `GET /api/cron/purge`, appelée chaque jour à 03:00 UTC (04:00 au Bénin) par le cron Vercel déclaré dans `vercel.json` (`0 3 * * *`).
- Un cron Vercel ne tourne que sur le déploiement de production, jamais sur le staging.
- La route est autorisée à passer en mode attente (`PASSTHROUGH_PATHS` dans `src/lib/site/waiting-mode.js`), car elle est protégée par secret.
- Réponses : 503 si `CRON_SECRET` n'est pas défini, 401 si l'en-tête `Authorization` est absent ou faux, 200 avec le résumé sinon.
- Deux appels simultanés sont sans danger : tout est recalculé à chaque passage.

## Variables Vercel (à poser par vous, jamais par un agent)

| Variable | Rôle |
|---|---|
| `CRON_SECRET` | Obligatoire. Secret aléatoire d'au moins 32 octets. Vercel l'envoie dans `Authorization: Bearer ...` à chaque appel du cron. Distinct d'`INTERNAL_API_SECRET`. |
| `PURGE_ENABLED` | Absente ou différente de `true` (chaîne exacte) : simulation seulement, rien n'est supprimé. `true` : suppression réelle. |
| `PURGE_ALLOW_MASS` | Exceptionnelle. `true` suspend le coupe-circuit, uniquement le temps d'une purge des données de test, puis à retirer. |

Une variable modifiée n'est prise en compte qu'après un redéploiement de la production.

## Lancer une simulation à la main

La simulation compte ce qui serait supprimé sans rien supprimer. Remplacez `<secret>` par la valeur de `CRON_SECRET` :

```bash
curl -H "Authorization: Bearer <secret>" "https://educash.bj/api/cron/purge?mode=dry"
```

`?mode=dry` force la simulation même si `PURGE_ENABLED` vaut `true`. Aucun autre paramètre n'existe.

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

- Coupe-circuit : en mode réel, un compartiment de fichiers est sauté si ses candidats dépassent 50 % des fichiers examinés ET 25 fichiers. Un arrêt `breaker` est alors journalisé : vérifiez la cause avant toute dérogation par `PURGE_ALLOW_MASS`.
- Budget de temps : aucun nouveau lot n'est lancé après 40 secondes (durée maximale de la route : 60 secondes). Ce qui reste est traité le lendemain (arrêt `deadline`).
- Lots : 500 lignes par suppression, 100 fichiers par appel de suppression.

## Mise en service conseillée

1. Poser `CRON_SECRET` en production et redéployer. La purge tourne en simulation.
2. Lire les résumés `[purge]` pendant une semaine : `candidats` doit rester plausible, `erreurs` à 0, aucun arrêt `breaker`.
3. Poser `PURGE_ENABLED=true` et redéployer.
4. Retour arrière : retirer `PURGE_ENABLED` et redéployer. La purge repasse en simulation.

## Clôture de compte : procédure manuelle

Il n'existe aucune clôture de compte en libre-service. Les demandes arrivent à contact@educash.bj et sont traitées par l'admin sous 30 jours. La purge ne supprime jamais de compte.

Attention : la suppression d'un compte efface en cascade ses `transactions` et `wallet_transactions`, ce qui contredit la conservation comptable de 10 ans. Procédure :

1. Avant toute suppression, vérifier que le compte n'a aucune ligne dans `transactions` ni dans `wallet_transactions`.
2. S'il en a, ne pas supprimer : bloquer la suppression et planifier le chantier « clôture avec pseudonymisation » (modification des clés étrangères pour conserver les lignes comptables, à faire avant la réouverture des paiements).
3. Sinon, supprimer le compte dans les 30 jours. Ses fichiers orphelins seront ensuite purgés par P3, P5, P6 et P7 après 7 jours de grâce.

## Reporté

- Script SQL 95 (index) : reporté, aucun besoin aux volumes actuels, le code n'en dépend pas.
- Effacement du numéro ou du nom du vendeur dans `purchase_requests` : chantier séparé (le trigger `guard_purchase_requests` l'interdit).

## Modifier la purge

Une nouvelle donnée à durée limitée ou un nouveau compartiment s'ajoute dans `src/lib/purge/purge-rules.js` et dans les modules `purge-*.js`. Un changement de durée touche aussi le texte de la politique de confidentialité, qui doit rester identique.
