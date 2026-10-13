import type {
  AccountStatus,
  AccountType,
  TransactionType,
} from '@neobank/shared/models';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  SAVINGS: $localize`:@@account.savings:Savings account`,
  CURRENT: $localize`:@@account.current:Current account`,
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: $localize`:Account status@@account.status.active:active`,
  FROZEN: $localize`:Account status@@account.status.frozen:frozen`,
  CLOSED: $localize`:Account status@@account.status.closed:closed`,
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: $localize`:@@account.type.deposit:Deposit`,
  WITHDRAWAL: $localize`:@@account.type.withdrawal:Withdrawal`,
  TRANSFER: $localize`:@@common.transfer:Transfer`,
};
