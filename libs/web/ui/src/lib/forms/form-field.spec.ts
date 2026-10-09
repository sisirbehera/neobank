import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { z } from 'zod';
import { FormField } from './form-field';
import { Input } from './input';
import { applyServerErrors, zodValidator } from './validators';

@Component({
  imports: [ReactiveFormsModule, FormField, Input],
  template: `
    <form [formGroup]="form">
      <nb-form-field label="Email" hint="We never share it">
        <input nbInput id="email" formControlName="email" />
      </nb-form-field>
    </form>
  `,
})
class Host {
  form = new FormGroup({
    email: new FormControl('', zodValidator(z.email('Enter a valid email'))),
  });
}

describe('FormField + nbInput', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    return { fixture, el, input, form: fixture.componentInstance.form };
  }

  it('shows the hint until the field is touched', () => {
    const { el, input } = setup();

    expect(el.textContent).toContain('We never share it');
    expect(input.classList).toContain('form-control');
    expect(input.classList).not.toContain('is-invalid');
    expect(el.querySelector('label')?.getAttribute('for')).toBe('email');
  });

  it('shows the Zod message after blur', async () => {
    const { fixture, el, input } = setup();

    input.value = 'nope';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(input.classList).toContain('is-invalid');
    expect(el.querySelector('.invalid-feedback')?.textContent).toContain(
      'Enter a valid email',
    );
  });

  it('shows server errors', async () => {
    const { fixture, el, form } = setup();

    form.controls.email.setValue('a@b.co');
    applyServerErrors(form, { email: ['Already registered'] });
    await fixture.whenStable();

    expect(el.querySelector('.invalid-feedback')?.textContent).toContain(
      'Already registered',
    );
  });
});
