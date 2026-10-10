# 0010. A plain-SVG chart instead of a chart library

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

The dashboard needs one chart: money in and money out per month, for six months. Chart libraries such as Chart.js or ECharts add 60–300 KB, draw on a `<canvas>` that screen readers can't read, and are hard to theme with our CSS variables.

## Decision

Build `<nb-column-chart>` in the UI library as **plain SVG** in an Angular template:

- grouped columns with rounded tops, a recessive grid, labels on the latest month only;
- colours from a validated colour-blind-safe palette, with **separate light and dark steps** (not an automatic inversion), checked with a palette validator;
- a legend, so colour is never the only cue;
- a tooltip on hover **and** keyboard focus, positioned beside the column so it never covers it;
- a **Show table** toggle with the same numbers.

## Alternatives considered

- **Chart.js / ng2-charts:** quick, but canvas-based, heavier, and accessibility is extra work.
- **ECharts / Highcharts:** powerful, large, and Highcharts needs a licence for commercial use.
- **D3:** flexible, but a big learning curve for one chart.

## Consequences

- Tiny, theme-aware, and accessible by construction.
- Every new chart type (Day 12's spending categories, for example) is our own code to write and test.
- Bug caught on Day 5: the first tooltip covered the column being read; it now sits beside it.
