/** "Chrome on Windows" from a User-Agent string (good enough for a sessions list). */
export function describeDevice(userAgent: string): string {
  if (!userAgent) return 'Unknown device';

  const browser =
    [
      [/Edg\//, 'Edge'],
      [/OPR\/|Opera/, 'Opera'],
      [/Firefox\//, 'Firefox'],
      [/Chrome\/|CriOS/, 'Chrome'],
      [/Safari\//, 'Safari'],
    ].find(([pattern]) => (pattern as RegExp).test(userAgent))?.[1] ??
    'Browser';

  const os =
    [
      [/Windows/, 'Windows'],
      [/Android/, 'Android'],
      [/iPhone|iPad|iOS/, 'iOS'],
      [/Mac OS X|Macintosh/, 'macOS'],
      [/Linux/, 'Linux'],
    ].find(([pattern]) => (pattern as RegExp).test(userAgent))?.[1] ?? '';

  return os ? `${browser} on ${os}` : (browser as string);
}
