import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Amount, InrPipe } from './amount';

/** The app is built for en-IN and hi (Angular's own default is en-US). */
function useLocale(locale: string) {
  TestBed.configureTestingModule({
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  });
}

describe('Amount', () => {
  function render(paise: number, signed = false) {
    const fixture = TestBed.createComponent(Amount);
    fixture.componentRef.setInput('paise', paise);
    fixture.componentRef.setInput('signed', signed);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => useLocale('en-IN'));

  it('formats paise as rupees', () => {
    expect(render(123456789).textContent).toBe('₹12,34,567.89');
  });

  it('colours signed credits and debits', () => {
    const credit = render(5000, true);
    expect(credit.textContent).toBe('+₹50.00');
    expect(credit.classList).toContain('text-success');

    const debit = render(-5000, true);
    expect(debit.textContent).toBe('-₹50.00');
    expect(debit.classList).toContain('text-danger');
  });
});

describe('InrPipe', () => {
  const pipe = () => TestBed.runInInjectionContext(() => new InrPipe());

  it('handles empty values', () => {
    useLocale('en-IN');
    expect(pipe().transform(null)).toBe('');
    expect(pipe().transform(100)).toBe('₹1.00');
  });

  it("formats in the page's language", () => {
    useLocale('hi');
    expect(pipe().transform(123456789)).toBe('₹12,34,567.89');
  });
});
