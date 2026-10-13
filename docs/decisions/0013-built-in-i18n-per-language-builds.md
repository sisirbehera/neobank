# 0013. English and Hindi with Angular's built-in i18n: one build per language

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The app should work in English and Hindi, with the language in the address (`/en/dashboard`, `/hi/dashboard`) so a link opens in the language it was shared in. Pages are pre-built ([0012](0012-prerender-public-pages.md)), so translation has to work at build time as well as in the browser. Numbers, dates and money must follow the language too.

## Decision

- **Angular's built-in i18n (`@angular/localize`), compiled per language.** Templates are marked with `i18n` attributes, and TypeScript strings use `` $localize`…` ``. `nx extract-i18n web` collects them into `apps/web/src/locale/messages.json`; the Hindi translations live in `messages.hi.json`. The build produces two complete apps, `en/` and `hi/`, with every string already in place.
- **A missing translation fails the build** (`i18nMissingTranslation: "error"`), so the Hindi site can never quietly show English.
- **The API sends addresses without a language to one** (`/` → `/hi/`): the `nb_lang` cookie first, then the browser's `Accept-Language`, then English.
- **The last explicit choice wins.** The switcher saves the choice on the device (cookie) and on the profile. After signing in on a device that never chose, the profile's language applies. The profile's language stays empty until the user chooses, so a default never overrides anyone. The shared demo login's profile can't be changed.
- **The API and the shared schemas stay English.** Errors carry a code, plus numbers in `meta` where the message has them (`ACCOUNT_LOCKED` → `minutes`). The browser words the message in its language. Validation messages from the shared Zod schemas are translated in the browser by their English text, and a unit test fails if a schema message has no translation.
- **Money and dates follow `LOCALE_ID`:** `formatInr(paise, locale)` and Angular's date pipe. Both locales use lakh/crore grouping and Latin digits (`₹12,34,567.89`); compact chart labels become "₹85 हज़ार", "₹1.2 लाख".
- **Admin screens stay English.** They are staff tools, and translating them would double the work for no customer benefit.

## Alternatives considered

- **A runtime library (Transloco, ngx-translate):** one build, and the language switches without a reload. But every string is looked up at runtime, translations download as JSON, pre-built pages need extra wiring to know the language, and a missing key only shows up when someone sees it.
- **Translating on the server (API sends Hindi messages):** the API would need the language on every request, and two places would hold translations.
- **Error codes everywhere instead of English validation messages:** cleaner, but a large change to the shared schemas and their tests. Translating by English text, guarded by a test, gives the same result with less churn.

## Consequences

- Each language is fast and complete on its own. The startup download didn't change with the number of languages.
- **Switching language reloads the page.** The session survives, because the refresh cookie restores it.
- **Build time and output grow with each language** (two builds, six pre-built pages).
- **The dev server serves one language at `/`** (English by default; `nx serve web --configuration=hi` for Hindi). The switcher is hidden there. The language tests run against the production build (the `production` Playwright project).
- **Hydration needs `withI18nSupport()`.** Without it, Angular redraws any component with translated text instead of reusing the pre-built HTML, which brought back the "typing before load is lost" bug.
- **Readable, hand-picked message IDs** (`@@login.title`, `error.invalidCredentials`), not the generated ones (a hash of the English text, e.g. `6972903818043702698`). The translation file says where each line appears, and a wording fix in English keeps its translation. The price: the build can't tell that a Hindi translation is stale after the English changed. `translations.spec.ts` checks what can be checked (every ID translated, none left over, placeholders match), and a changed English text shows up in the pull request as a diff of `messages.json`. See the runbook for the steps.
