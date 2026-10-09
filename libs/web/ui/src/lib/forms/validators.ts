import type {
  AbstractControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import type { z } from 'zod';

/**
 * Turns a Zod schema into an Angular validator, so form controls use the
 * exact rules the API enforces:
 *   email: ['', zodValidator(EmailSchema)]
 */
export function zodValidator(schema: z.ZodType): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = schema.safeParse(control.value);
    return result.success ? null : { zod: result.error.issues[0].message };
  };
}

/** Shows API field errors (`error.fields`) on the matching form controls. */
export function applyServerErrors(
  form: FormGroup,
  fields: Record<string, string[]> | undefined,
): void {
  for (const [name, messages] of Object.entries(fields ?? {})) {
    const control = form.get(name);
    if (control && messages.length) {
      control.setErrors({ server: messages[0] });
      control.markAsTouched();
    }
  }
}

/** Human-readable text for the first error on a control. */
export function errorMessage(errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  if (errors['server']) return errors['server'];
  if (errors['zod']) return errors['zod'];
  if (errors['required']) return 'This field is required';
  if (errors['mismatch']) return errors['mismatch'];
  return 'Invalid value';
}
