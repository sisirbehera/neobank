import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The built Angular app, as the API serves it (decision record 0012):
 *  - pages built ahead of time: <route>/index.html, e.g. login/index.html,
 *    and index.html for the home page;
 *  - index.csr.html: the empty shell for every other route, which Angular
 *    renders in the browser.
 */
export interface WebApp {
  /** "/", "/login", … → the HTML file built for it. */
  pages: Map<string, string>;
  /** Served for every route that wasn't built ahead of time. */
  shell: string;
  /**
   * CSP hashes ('sha256-…') of the inline scripts in those files: the theme
   * script and Angular's event-replay scripts. The policy allows exactly
   * these, and still blocks any other inline script, such as an injected one.
   */
  scriptHashes: string[];
}

/** Builds without pre-rendering have only index.html: it is then the shell. */
const SHELL_FILES = ['index.csr.html', 'index.html'];

export function loadWebApp(root: string): WebApp | undefined {
  const shellName = SHELL_FILES.find((f) => existsSync(join(root, f)));
  if (!shellName) return undefined;
  const shell = join(root, shellName);

  const pages = new Map<string, string>();
  if (shellName !== 'index.html') {
    for (const file of findIndexFiles(root)) {
      const dir = relative(root, file).split(sep).slice(0, -1);
      pages.set('/' + dir.join('/'), file);
    }
  }

  const hashes = new Set<string>();
  for (const file of [shell, ...pages.values()]) {
    for (const script of inlineScripts(readFileSync(file, 'utf8'))) {
      hashes.add(
        `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
      );
    }
  }

  return { pages, shell, scriptHashes: [...hashes] };
}

/** The file to send for a page address ("/login/" is the same as "/login"). */
export function pageFor(app: WebApp, path: string): string {
  const route = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return app.pages.get(route) ?? app.shell;
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
