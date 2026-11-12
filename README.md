# famille-routeur

Petit Worker Cloudflare placé devant `lepetitperchoir.fr`. Il **n'a aucune liste d'applications** :
il applique une convention.

| URL publique | Destination |
|---|---|
| `/` et tout ce qui n'est pas une app (`/assets/…`, `/sw.js`…) | Worker `famille-portail` |
| `/<appId>/…` | Worker `famille-<appId>` (le préfixe `/<appId>` est retiré) |
| `/<appId>` | redirigé vers `/<appId>/` |
| `www.lepetitperchoir.fr/…` | redirigé vers `lepetitperchoir.fr/…` |

## Ajouter une application

1. Créer le dépôt de l'app, compilée avec `base: '/<appId>/'` (Vite).
2. La déployer comme Worker nommé **`famille-<appId>`** (fichiers statiques).
3. Ajouter sa fiche dans le catalogue Firestore (`catalog/<appId>`).

Le routeur ne change pas. Retirer une app : passer sa fiche à `hidden` ou la supprimer.

## Règles de sécurité

- Méthodes `GET` et `HEAD` uniquement.
- L'hôte de destination est toujours `*.<compte>.workers.dev` (testé contre les chemins `//hote`).
- Identifiant d'app : `[a-z][a-z0-9-]{1,30}`, `assets` réservé au portail.

## Commandes

```
npm install
npm test          # tests du routage
npm run check     # types
npm run deploy    # déploiement (ou via Cloudflare Workers Builds)
```

## Configuration

`wrangler.jsonc` : domaine(s) personnalisé(s) (`routes`) et variables (`ACCOUNT_SUBDOMAIN`,
`PORTAL_NAME`, `APP_PREFIX`, `PUBLIC_HOST`).
