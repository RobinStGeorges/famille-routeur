import { resolveTarget, rewriteLocation, type RouterConfig } from './routing';

export interface Env {
  ACCOUNT_SUBDOMAIN: string;
  PORTAL_NAME: string;
  APP_PREFIX: string;
  PUBLIC_HOST: string;
}

function config(env: Env): RouterConfig {
  return {
    accountSubdomain: env.ACCOUNT_SUBDOMAIN,
    portalName: env.PORTAL_NAME,
    appPrefix: env.APP_PREFIX,
    publicHost: env.PUBLIC_HOST,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Méthode non autorisée', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const url = new URL(request.url);
    const target = resolveTarget(url, config(env));

    if (target.kind === 'redirect') {
      return Response.redirect(new URL(target.location, url).toString(), target.status);
    }

    try {
      const upstream = await fetch(
        new Request(target.upstream.toString(), {
          method: request.method,
          headers: request.headers,
          redirect: 'manual',
        }),
      );

      const res = new Response(upstream.body, upstream);
      const location = res.headers.get('Location');
      if (location) {
        res.headers.set('Location', rewriteLocation(location, target.upstream.origin, target.appId));
      }
      res.headers.set('X-Content-Type-Options', 'nosniff');
      res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return res;
    } catch {
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Indisponible</title>' +
          '<p style="font:18px system-ui;padding:2rem">Ce service est momentanément indisponible. Réessayez dans un instant.</p>',
        { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }
  },
};
