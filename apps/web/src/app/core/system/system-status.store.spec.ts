import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SystemStatusStore } from './system-status.store';

describe('SystemStatusStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const health = {
    status: 'ok',
    db: 'up',
    uptimeSeconds: 5,
    timestamp: new Date().toISOString(),
    version: '0.0.0',
  };

  it('loads health on init', () => {
    const store = TestBed.inject(SystemStatusStore);
    expect(store.loading()).toBe(true);

    http.expectOne('/api/health').flush(health);

    expect(store.loading()).toBe(false);
    expect(store.apiOnline()).toBe(true);
    expect(store.dbOnline()).toBe(true);
  });

  it('treats a 503 as "API up, database down"', () => {
    const store = TestBed.inject(SystemStatusStore);

    http
      .expectOne('/api/health')
      .flush(
        { ...health, status: 'degraded', db: 'down' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(store.apiOnline()).toBe(true);
    expect(store.dbOnline()).toBe(false);
  });

  it('reports an error when the API is unreachable', () => {
    const store = TestBed.inject(SystemStatusStore);

    http
      .expectOne('/api/health')
      .error(new ProgressEvent('error'), { status: 0 });

    expect(store.apiOnline()).toBe(false);
    expect(store.error()).toBe('The API is not reachable.');
  });
});
