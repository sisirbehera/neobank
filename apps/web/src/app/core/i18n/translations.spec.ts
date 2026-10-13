import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Checks the Hindi file against the English messages (decision record 0013).
 * IDs are readable and stable (`@@login.title`), so changing the English
 * does not invalidate the Hindi: the build can't notice a stale translation.
 * These checks catch what can be caught automatically; a changed English
 * text also shows up in the pull request as a diff of messages.json.
 */
describe('Hindi translations', () => {
  const dir = join(__dirname, '../../../locale');
  const load = (file: string): Record<string, string> =>
    JSON.parse(readFileSync(join(dir, file), 'utf8')).translations;
  const en = load('messages.json');
  const hi = load('messages.hi.json');

  /** {$amount}, {$START_LINK}, … and the ICU plural variable. */
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\$[A-Z0-9_a-z]+\}|\{[A-Z_]+\}|VAR_PLURAL/g)]
      .map((m) => m[0])
      .sort();

  it('translates every message', () => {
    expect(Object.keys(en).filter((id) => !hi[id])).toEqual([]);
  });

  it('has no translations left over for removed messages', () => {
    expect(Object.keys(hi).filter((id) => !(id in en))).toEqual([]);
  });

  it('keeps every placeholder, so values and links still appear', () => {
    const broken = Object.keys(en).filter(
      (id) =>
        hi[id] &&
        JSON.stringify(placeholders(en[id])) !==
          JSON.stringify(placeholders(hi[id])),
    );
    expect(broken).toEqual([]);
  });

  it('uses readable IDs (no generated numbers)', () => {
    expect(Object.keys(en).filter((id) => /^\d+$/.test(id))).toEqual([]);
  });
});
