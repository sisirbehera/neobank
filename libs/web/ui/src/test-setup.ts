import '@angular/compiler';
// $localize, as in the app (its polyfill). Tests see the English source text.
import '@angular/localize/init';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: true });
