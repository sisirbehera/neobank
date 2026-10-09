// Secondary entry point: @neobank/web/ui/theme
// The app shell loads this at startup. Importing from the main entry
// (@neobank/web/ui) would also pull forms, the chart, … into the first download.
export * from './lib/theme/theme-switcher';
export * from './lib/theme/theme.service';
