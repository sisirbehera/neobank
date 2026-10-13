import * as z from 'zod/mini';

/** The languages the web app is built in (decision record 0013). */
export const LANGUAGES = ['en', 'hi'] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

/**
 * Remembers the visitor's language on their device. Readable by the page
 * (it sets it) and by the API (it sends "/" to /en/ or /hi/). Not a secret.
 */
export const LANGUAGE_COOKIE = 'nb_lang';

export const UpdateProfileRequestSchema = z.object({
  language: LanguageSchema,
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
