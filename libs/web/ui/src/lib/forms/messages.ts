let validationMessages: Record<string, string> = {};

/**
 * The shared schemas' messages are English. The app registers translations
 * for the page's language once at startup (English text → translated text).
 */
export function registerValidationMessages(
  messages: Record<string, string>,
): void {
  validationMessages = messages;
}

/** The registered translation of a message, or the message itself. */
export function translateValidationMessage(message: string): string {
  return validationMessages[message] ?? message;
}
