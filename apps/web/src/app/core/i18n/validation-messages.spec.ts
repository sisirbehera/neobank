import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  UNTRANSLATED_VALIDATION_MESSAGES,
  VALIDATION_MESSAGES,
} from './messages';

/**
 * The shared schemas' messages are English; the browser translates them by
 * text (see messages.ts). This catches a message added to a schema without a
 * translation, which would otherwise show in English on the Hindi site.
 */
describe('validation message translations', () => {
  const dir = join(__dirname, '../../../../../../libs/shared/models/src/lib');

  /** Messages passed to Zod checks: minLength(n, '…'), error: '…', etc. */
  function schemaMessages(): string[] {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .flatMap((file) => {
        const source = readFileSync(join(dir, file), 'utf8');
        return [
          ...source.matchAll(
            /\b(?:minLength|maxLength|regex|email|int|positive|nonnegative|gte|lte|gt|lt|length)\((?:[^)]*?,\s*)?'([^']+)'/g,
          ),
          ...source.matchAll(/error:\s*'([^']+)'/g),
          ...source.matchAll(/\.check\(\s*z\.\w+\(\s*'([^']+)'/g),
        ].map((m) => m[1]);
      });
  }

  it('finds the messages (the scan itself works)', () => {
    expect(schemaMessages()).toContain('Enter a valid email address');
    expect(schemaMessages().length).toBeGreaterThan(20);
  });

  it('has a translation for every message customers can see', () => {
    const missing = schemaMessages().filter(
      (m) =>
        !(m in VALIDATION_MESSAGES) &&
        !UNTRANSLATED_VALIDATION_MESSAGES.includes(m),
    );
    expect(missing).toEqual([]);
  });
});
