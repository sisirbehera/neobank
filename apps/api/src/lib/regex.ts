/** Escapes user input for use inside a RegExp (so "a.b" doesn't match "axb"). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
