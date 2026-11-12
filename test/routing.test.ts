import { describe, expect, test } from 'vitest';
import { resolveTarget, rewriteLocation, type RouterConfig } from '../src/routing';

const cfg: RouterConfig = {
  accountSubdomain: 'robin-sgeorges',
  portalName: 'famille-portail',
  appPrefix: 'famille-',
  publicHost: 'lepetitperchoir.fr',
};

const go = (u: string) => resolveTarget(new URL(u), cfg);

describe('routage', () => {
  test('la racine va au portail', () => {
    const t = go('https://lepetitperchoir.fr/');
    expect(t).toMatchObject({ kind: 'proxy', appId: null });
    if (t.kind === 'proxy') expect(t.upstream.toString()).toBe('https://famille-portail.robin-sgeorges.workers.dev/');
  });

  test('les fichiers du portail (assets, sw.js, manifest) vont au portail', () => {
    for (const p of ['/assets/index-abc.js', '/sw.js', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']) {
      const t = go(`https://lepetitperchoir.fr${p}`);
      expect(t).toMatchObject({ kind: 'proxy', appId: null });
      if (t.kind === 'proxy') expect(t.upstream.pathname).toBe(p);
    }
  });

  test('/courses/ va au Worker famille-courses, préfixe retiré', () => {
    const t = go('https://lepetitperchoir.fr/courses/');
    expect(t).toMatchObject({ kind: 'proxy', appId: 'courses' });
    if (t.kind === 'proxy') expect(t.upstream.toString()).toBe('https://famille-courses.robin-sgeorges.workers.dev/');
  });

  test('/mrwhite/assets/x.js -> /assets/x.js de famille-mrwhite, query conservée', () => {
    const t = go('https://lepetitperchoir.fr/mrwhite/assets/x.js?v=3');
    if (t.kind !== 'proxy') throw new Error('proxy attendu');
    expect(t.upstream.toString()).toBe('https://famille-mrwhite.robin-sgeorges.workers.dev/assets/x.js?v=3');
  });

  test('/courses sans slash est redirigé vers /courses/', () => {
    expect(go('https://lepetitperchoir.fr/courses')).toEqual({ kind: 'redirect', location: '/courses/', status: 308 });
  });

  test('www redirige vers le domaine nu', () => {
    expect(go('https://www.lepetitperchoir.fr/courses/')).toEqual({
      kind: 'redirect',
      location: 'https://lepetitperchoir.fr/courses/',
      status: 301,
    });
  });

  test('« assets » est réservé au portail et n\'est jamais une app', () => {
    const t = go('https://lepetitperchoir.fr/assets/');
    expect(t).toMatchObject({ appId: null });
  });
});

describe('sécurité', () => {
  test('un chemin « //evil.com » ne change jamais l\'hôte de destination', () => {
    for (const p of ['//evil.com/x', '//evil.com', '/courses//evil.com/x', '/\\evil.com']) {
      const t = go(`https://lepetitperchoir.fr${p}`);
      if (t.kind === 'proxy') expect(t.upstream.hostname.endsWith('.robin-sgeorges.workers.dev')).toBe(true);
    }
  });

  test('un identifiant invalide (majuscules, point, trop court) va au portail', () => {
    for (const p of ['/Courses/', '/a/', '/x.y/', '/_hidden/']) {
      expect(go(`https://lepetitperchoir.fr${p}`)).toMatchObject({ kind: 'proxy', appId: null });
    }
  });
});

describe('réécriture des redirections', () => {
  const origin = 'https://famille-courses.robin-sgeorges.workers.dev';
  test('chemin relatif -> préfixé par /<appId>', () => {
    expect(rewriteLocation('/listes/', origin, 'courses')).toBe('/courses/listes/');
  });
  test('URL absolue du Worker -> chemin public préfixé', () => {
    expect(rewriteLocation(`${origin}/`, origin, 'courses')).toBe('/courses/');
  });
  test('URL externe inchangée', () => {
    expect(rewriteLocation('https://example.com/a', origin, 'courses')).toBe('https://example.com/a');
  });
  test('portail : chemin inchangé', () => {
    expect(rewriteLocation('/x', 'https://famille-portail.robin-sgeorges.workers.dev', null)).toBe('/x');
  });
});
