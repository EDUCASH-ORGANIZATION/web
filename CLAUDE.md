# EduCash Web PWA — Contexte Claude Code

## PROJET
- **Nom** : EduCash Web PWA
- **Description** : Marketplace two-sided étudiants / clients au Bénin
- **Stack** : Next.js 14 App Router, Javascript, Tailwind CSS, Supabase, FedaPay, Resend
- **Déploiement** : Vercel

## RÈGLES DE CODE
- JavaScript uniquement — pas de TypeScript, pas de fichiers `.ts` ou `.tsx`
- Composants Server Components par défaut, `"use client"` uniquement si nécessaire
- Zustand pour le state global (auth, notifications)
- react-hook-form + zod pour TOUS les formulaires
- Tailwind uniquement pour les styles — jamais de CSS inline ou fichiers `.css` personnalisés
- Imports toujours avec alias `@/` (ex: `import { Button } from "@/components/ui/button"`)
- Nommage : composants en PascalCase, hooks en camelCase préfixé `use`, utils en camelCase

## ARCHITECTURE
```
src/
├── app/            # Routes Next.js App Router
├── components/
│   ├── ui/         # Composants atomiques réutilisables
│   └── shared/     # Composants métier partagés
├── lib/            # Clients Supabase, helpers, utils
├── hooks/          # Custom hooks React
└── services/       # Fonctions d'accès aux données Supabase
```

## SUPABASE
- Client browser : `src/lib/supabase/client.js`
- Client server : `src/lib/supabase/server.js`
- Middleware : `middleware.js` à la racine
- Ne jamais utiliser la `SERVICE_ROLE_KEY` côté client ou composants

## DESIGN SYSTEM
- Couleur primaire : `#1A6B4A` (vert EduCash)
- Couleur accent : `#F59E0B` (amber)
- Couleur dark : `#1A1A2E`
- Border radius : `rounded-xl` pour cards, `rounded-lg` pour boutons
- Espacement : multiples de 4px (Tailwind par défaut)

## MÉTIER
- **Rôles** : `student` et `client`
- **Commission EduCash** : 12%
- **Villes** : Cotonou, Porto-Novo, Abomey-Calavi
- **Types de missions** : Babysitting, Livraison, Aide administrative, Saisie, Community Management, Traduction, Cours particuliers, Autre
- **Statuts mission** : `open`, `in_progress`, `done`, `cancelled`
- **Statuts candidature** : `pending`, `accepted`, `rejected`
