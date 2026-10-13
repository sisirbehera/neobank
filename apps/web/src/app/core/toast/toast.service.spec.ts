import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = TestBed.inject(ToastService);
  });
  afterEach(() => vi.useRealTimers());

  const texts = () => toasts.toasts().map((t) => t.text);

  it('hides a toast after 5 seconds', () => {
    toasts.success('Saved');
    expect(texts()).toEqual(['Saved']);

    vi.advanceTimersByTime(4999);
    expect(texts()).toEqual(['Saved']);
    vi.advanceTimersByTime(1);
    expect(texts()).toEqual([]);
  });

  it('keeps errors until they are closed', () => {
    toasts.error('Something failed');
    vi.advanceTimersByTime(60_000);
    expect(texts()).toEqual(['Something failed']);

    toasts.dismiss(toasts.toasts()[0].id);
    expect(texts()).toEqual([]);
  });

  it('keeps a toast open while it is hovered or focused', () => {
    toasts.info('Hello');
    const { id } = toasts.toasts()[0];

    toasts.pause(id);
    vi.advanceTimersByTime(10_000);
    expect(texts()).toEqual(['Hello']);

    toasts.resume(id);
    vi.advanceTimersByTime(5000);
    expect(texts()).toEqual([]);
  });

  it('shows at most 3, dropping the oldest', () => {
    for (const text of ['1', '2', '3', '4']) toasts.info(text);
    expect(texts()).toEqual(['2', '3', '4']);
  });
});
