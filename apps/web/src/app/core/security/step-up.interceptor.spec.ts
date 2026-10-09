import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { stepUpInterceptor } from './step-up.interceptor';

describe('stepUpInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const setup = vi.fn();
  /** What the (mocked) dialog resolves with; created when it opens. */
  let dialogResult: () => Promise<string>;

  beforeEach(() => {
    setup.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([stepUpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: NgbModal,
          useValue: {
            open: () => ({
              componentInstance: { setup },
              result: dialogResult(),
            }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const stepUpRequired = (action: string) => ({
    error: {
      code: 'STEP_UP_REQUIRED',
      message: 'Enter a code',
      meta: { action },
    },
  });

  it('asks for a code and retries the same request with the step-up token', async () => {
    dialogResult = () => Promise.resolve('step-up-token');
    let result: unknown;

    http
      .post(
        '/api/beneficiaries',
        { name: 'Ravi' },
        { headers: { 'Idempotency-Key': 'k1' } },
      )
      .subscribe((r) => (result = r));

    backend
      .expectOne('/api/beneficiaries')
      .flush(stepUpRequired('ADD_BENEFICIARY'), {
        status: 403,
        statusText: 'Forbidden',
      });
    // The dialog is lazy-loaded: wait until the retried request is sent.
    const retry = await vi.waitFor(() =>
      backend.expectOne('/api/beneficiaries'),
    );
    expect(setup).toHaveBeenCalledWith('ADD_BENEFICIARY');
    expect(retry.request.headers.get('X-Step-Up-Token')).toBe('step-up-token');
    expect(retry.request.headers.get('Idempotency-Key')).toBe('k1');
    expect(retry.request.body).toEqual({ name: 'Ravi' });
    retry.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('reports a cancelled dialog without retrying', async () => {
    dialogResult = () => Promise.reject('dismissed');
    let error: { error?: { error?: { code?: string } } } | undefined;

    http.post('/api/transfers', {}).subscribe({ error: (e) => (error = e) });
    backend
      .expectOne('/api/transfers')
      .flush(stepUpRequired('LARGE_TRANSFER'), {
        status: 403,
        statusText: 'Forbidden',
      });
    await vi.waitFor(() =>
      expect(error?.error?.error?.code).toBe('STEP_UP_CANCELLED'),
    );
  });

  it('leaves other 403s alone', () => {
    let status = 0;
    http
      .get('/api/admin/stats')
      .subscribe({ error: (e) => (status = e.status) });
    backend
      .expectOne('/api/admin/stats')
      .flush(
        { error: { code: 'FORBIDDEN', message: 'No' } },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(status).toBe(403);
    expect(setup).not.toHaveBeenCalled();
  });
});
