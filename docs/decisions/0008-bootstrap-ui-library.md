# 0008. Bootstrap wrapped in our own UI library, themed with CSS variables

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

We wanted a familiar component toolkit, several colour themes (including dark), and the freedom to change toolkit later without rewriting every page. Banking UI also has repeated, rule-heavy pieces: amounts in INR, masked account numbers, form fields that show API errors.

## Decision

- Use **Bootstrap 5.3** for CSS and **ng-bootstrap** for interactive widgets (modals, dropdowns), wrapped in `libs/web/ui` as `nb-*` components and directives: `nbButton`, `<nb-card>`, `<nb-amount>`, `<nb-form-field>` + `nbInput`, `<nb-column-chart>`, the `inr` pipe.
- Pages use the `nb-*` pieces, not raw Bootstrap widgets.
- **Themes** are sets of CSS variable overrides selected by `data-bs-theme` and `data-nb-theme` on `<html>` (`_themes.scss`). `ThemeService` holds the choice in a signal and remembers it.
- Brand colour is split into two tokens per theme: `--nb-primary` for text and links, and `--nb-primary-solid` for filled surfaces with white text, so both pass WCAG contrast.
- The app shell imports only `@neobank/web/ui/theme` (a secondary entry point), so the rest of the library loads with the pages that use it.

## Alternatives considered

- **Angular Material:** polished, but harder to theme into a non-Material look.
- **Raw Bootstrap classes in every page:** quicker at first; harder to keep consistent or replace.
- **Tailwind:** flexible, but no ready-made widgets, and themes need more setup.

## Consequences

- Adding a theme is one SCSS block plus one entry in `THEMES`, and every theme's contrast should be checked (values are noted in `_themes.scss`).
- Moving to another toolkit means rewriting the wrappers, not the pages.
- The library's own components must stay accessible: labels, focus states, keyboard support.
