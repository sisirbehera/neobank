import { TestBed } from '@angular/core/testing';
import { Amount, InrPipe } from './amount';

describe('Amount', () => {
  function render(paise: number, signed = false) {
    const fixture = TestBed.createComponent(Amount);
    fixture.componentRef.setInput('paise', paise);
    fixture.componentRef.setInput('signed', signed);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

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
  it('handles empty values', () => {
    expect(new InrPipe().transform(null)).toBe('');
    expect(new InrPipe().transform(100)).toBe('₹1.00');
  });
});
