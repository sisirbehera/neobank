import { Pipe, type PipeTransform } from '@angular/core';
import { formatAccountNumber, maskAccountNumber } from '@neobank/shared/utils';

/**
 * {{ account.accountNumber | accountNumber }}           → NB12 3456 7897
 * {{ account.accountNumber | accountNumber: 'masked' }} → •••• 7897
 */
@Pipe({ name: 'accountNumber' })
export class AccountNumberPipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    mode: 'full' | 'masked' = 'full',
  ): string {
    if (!value) return '';
    return mode === 'masked'
      ? maskAccountNumber(value)
      : formatAccountNumber(value);
  }
}
