import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The built Angular app, as the API serves it (decision records 0012, 0013).
 *
 * One copy per language, each in its own folder (en/, hi/), and in each:
 *  - pages built ahead of time: <route>/index.html, e.g. en/login/index.html,
 *    and index.html for the home page;
 *  - index.csr.html: the empty shell for every other route, which Angular
 *    renders in the browser.
 * A build without languages has the same files at the root.
 */
export interface WebApp {
  /** Language folders ("en", "hi"), in build order; empty when not localized. */
  languages: string[];
  /** "/en/login", … (or "/login" without languages) → the built HTML file. */
  pages: Map<string, string>;
  /** Language ("" without languages) → its browser-rendered shell. */
  shells: Map<string, string>;
  /**
   * CSP hashes ('sha256-…') of the inline scripts in those files: the early
   * script and Angular's event-replay scripts. The policy allows exactly
   * these, and still blocks any other inline script, such as an injected one.
   */
  scriptHashes: string[];
}

/** Builds without pre-rendering have only index.html: it is then the shell. */
const SHELL_FILES = ['index.csr.html', 'index.html'];

export function loadWebApp(root: string): WebApp | undefined {
  const rootSite = loadSite(root, '');
  const languages = rootSite
    ? []
    : readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^[a-z]{2}$/.test(e.name))
        .map((e) => e.name)
        .filter((name) => !!shellIn(join(root, name)));
  const sites = rootSite
    ? [rootSite]
    : languages.flatMap((language) => {
        const site = loadSite(join(root, language), `/${language}`);
        return site ? [{ ...site, language }] : [];
      });
  if (sites.length === 0) return undefined;

  const pages = new Map<string, string>();
  const shells = new Map<string, string>();
  for (const site of sites) {
    site.pages.forEach((file, route) => pages.set(route, file));
    shells.set(site.language, site.shell);
  }

  const hashes = new Set<string>();
  for (const file of [...shells.values(), ...pages.values()]) {
    for (const script of inlineScripts(readFileSync(file, 'utf8'))) {
      hashes.add(
        `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
      );
    }
  }

  return { languages, pages, shells, scriptHashes: [...hashes] };
}

/** What to do with a request for a page address. */
export type PageResult = { file: string } | { redirectTo: string };

/**
 * "/en/login" → its pre-built page; "/en/dashboard" → the English shell;
 * "/login" (no language) → a redirect to /<preferred>/login.
 */
export function resolvePage(
  app: WebApp,
  path: string,
  preferred: () => string,
): PageResult {
  const route = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const page = app.pages.get(route);
  if (page) return { file: page };

  const shell = app.shells.get(app.languages.length ? route.split('/')[1] : '');
  if (shell) return { file: shell };
  return { redirectTo: `/${preferred()}${route === '/' ? '/' : route}` };
}

/**
 * The visitor's language: their saved choice (cookie), else the first
 * supported language in Accept-Language (by its q-weights), else the first
 * language of the build (English).
 */
export function preferredLanguage(
  app: WebApp,
  cookie: string | undefined,
  acceptLanguage: string | undefined,
): string {
  if (cookie && app.languages.includes(cookie)) return cookie;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(
        params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1,
      );
      return { language: tag.toLowerCase().split('-')[0], q, index };
    })
    .filter((w) => w.language && w.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return (
    wanted.find((w) => app.languages.includes(w.language))?.language ??
    app.languages[0]
  );
}

function loadSite(
  dir: string,
  prefix: string,
): { language: string; pages: Map<string, string>; shell: string } | undefined {
  const shellName = shellIn(dir);
  // A localized build has no index file at the root, only language folders.
  if (!shellName) return undefined;
  const shell = join(dir, shellName);
  const pages = new Map<string, string>();
  if (shellName !== 'index.html') {
    for (const file of findIndexFiles(dir)) {
      const parts = relative(dir, file).split(sep).slice(0, -1);
      const route = `${prefix}/${parts.join('/')}`.replace(/\/$/, '') || '/';
      pages.set(route, file);
    }
  }
  return { language: '', pages, shell };
}

function shellIn(dir: string): string | undefined {
  return SHELL_FILES.find((f) => existsSync(join(dir, f)));
}

function findIndexFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findIndexFiles(path);
    return entry.name === 'index.html' ? [path] : [];
  });
}

/**
 * The contents of <script> tags that run code but have no src. JSON data
 * blocks (Angular's hydration state) aren't executed, so need no hash.
 */
export function inlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const [, attrs, body] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1];
    if (type && !/^(text|application)\/javascript$|^module$/i.test(type)) {
      continue;
    }
    scripts.push(body);
  }
  return scripts;
}
