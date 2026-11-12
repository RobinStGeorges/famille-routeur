export interface RouterConfig {
  accountSubdomain: string; // ex. robin-sgeorges
  portalName: string; // ex. famille-portail
  appPrefix: string; // ex. famille-  (l'app « courses » = Worker « famille-courses »)
  publicHost: string; // ex. lepetitperchoir.fr
}

export type Target =
  | { kind: 'redirect'; location: string; status: 301 | 308 }
  | { kind: 'proxy'; upstream: URL; appId: string | null };

// Un identifiant d'app : lettres minuscules, chiffres, tirets. Jamais de point
// (les fichiers du portail comme /sw.js ou /favicon.svg ne sont donc jamais pris pour des apps).
const APP_ID = /^[a-z][a-z0-9-]{1,30}$/;

// Noms de dossiers appartenant au portail, interdits comme identifiants d'app.
const RESERVED = new Set(['assets']);

function workerOrigin(name: string, accountSubdomain: string): string {
  return `https://${name}.${accountSubdomain}.workers.dev`;
}

/**
 * Décide où envoyer une requête :
 *  - /                -> portail
 *  - /assets/..., /sw.js, ...  -> portail
 *  - /<appId>/...     -> Worker « <appPrefix><appId> » (préfixe /<appId> retiré)
 *  - /<appId>         -> redirection vers /<appId>/
 *  - www.<domaine>    -> redirection vers le domaine nu
 *
 * Aucune liste d'apps : ajouter une app = déployer un Worker nommé « famille-<appId> ».
 */
export function resolveTarget(url: URL, cfg: RouterConfig): Target {
  if (url.hostname === `www.${cfg.publicHost}`) {
    return {
      kind: 'redirect',
      location: `https://${cfg.publicHost}${url.pathname}${url.search}`,
      status: 301,
    };
  }

  const parts = url.pathname.split('/'); // "/courses/x" -> ["", "courses", "x"]
  const first = parts[1] ?? '';

  if (APP_ID.test(first) && !RESERVED.has(first)) {
    if (parts.length === 2) {
      return { kind: 'redirect', location: `/${first}/${url.search}`, status: 308 };
    }
    // new URL(base) puis affectation de pathname : un chemin du type « //evil.com »
    // ne peut jamais changer l'hôte de destination.
    const upstream = new URL(workerOrigin(`${cfg.appPrefix}${first}`, cfg.accountSubdomain));
    upstream.pathname = '/' + parts.slice(2).join('/');
    upstream.search = url.search;
    return { kind: 'proxy', upstream, appId: first };
  }

  const upstream = new URL(workerOrigin(cfg.portalName, cfg.accountSubdomain));
  upstream.pathname = url.pathname;
  upstream.search = url.search;
  return { kind: 'proxy', upstream, appId: null };
}

/** Réécrit un en-tête Location renvoyé par une app pour qu'il reste sous son préfixe public. */
export function rewriteLocation(
  location: string,
  upstreamOrigin: string,
  appId: string | null,
): string {
  let path = location;
  if (location.startsWith(upstreamOrigin)) {
    path = location.slice(upstreamOrigin.length) || '/';
  }
  if (path.startsWith('/') && !path.startsWith('//') && appId) {
    return `/${appId}${path}`;
  }
  return path;
}
