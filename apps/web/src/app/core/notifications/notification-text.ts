import type { NotificationDto } from '@neobank/shared/models';
import { formatInr } from '@neobank/shared/utils';
import { describeDevice } from '../../features/security/device';

export interface NotificationView {
  text: string;
  /** Where a click takes the reader. */
  link: string;
}

/**
 * Words a notification in the page's language from its type and values
 * (the API stores no sentences; decision record 0014).
 */
export function describeNotification(
  n: NotificationDto,
  locale: string,
): NotificationView {
  const d = n.data;
  switch (n.type) {
    case 'MONEY_RECEIVED': {
      const amount = formatInr(Number(d['amountPaise'] ?? 0), locale);
      return {
        text: d['from']
          ? $localize`:@@notifications.moneyReceived:${amount}:amount: received from ${d['from']}:sender: in ${d['account']}:account:`
          : $localize`:@@notifications.moneyReceivedAnonymous:${amount}:amount: received in ${d['account']}:account:`,
        link: `/accounts/${d['accountId']}`,
      };
    }
    case 'NEW_DEVICE_SIGN_IN':
      return {
        text: $localize`:@@notifications.newDeviceSignIn:New sign-in on ${describeDevice(d['userAgent'] ?? '')}:device:. Not you? Change your password.`,
        link: '/security',
      };
    case 'PASSWORD_CHANGED':
      return {
        text: $localize`:@@notifications.passwordChanged:Your password was changed.`,
        link: '/security',
      };
    case 'MFA_ENABLED':
      return {
        text: $localize`:@@notifications.mfaEnabled:Two-step verification was turned on.`,
        link: '/security',
      };
    case 'MFA_DISABLED':
      return {
        text: $localize`:@@notifications.mfaDisabled:Two-step verification was turned off.`,
        link: '/security',
      };
    case 'ACCOUNT_LOCKED':
      return {
        text: $localize`:@@notifications.accountLocked:Your sign-in was locked for 15 minutes after too many wrong attempts.`,
        link: '/security',
      };
    case 'STOLEN_SESSION_BLOCKED':
      return {
        text: $localize`:@@notifications.stolenSessionBlocked:A copied sign-in was blocked and every device was signed out. Change your password.`,
        link: '/security',
      };
    case 'ACCOUNT_FROZEN':
      return {
        text: $localize`:@@notifications.accountFrozen:Account ${d['account']}:account: was frozen by the bank.`,
        link: `/accounts/${d['accountId']}`,
      };
    case 'ACCOUNT_UNFROZEN':
      return {
        text: $localize`:@@notifications.accountUnfrozen:Account ${d['account']}:account: is active again.`,
        link: `/accounts/${d['accountId']}`,
      };
  }
}
