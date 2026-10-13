import type {
  AccountStatus,
  AccountType,
  TransactionType,
} from '@neobank/shared/models';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  SAVINGS: $localize`Savings account`,
  CURRENT: $localize`Current account`,
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: $localize`:Account status:active`,
  FROZEN: $localize`:Account status:frozen`,
  CLOSED: $localize`:Account status:closed`,
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: $localize`Deposit`,
  WITHDRAWAL: $localize`Withdrawal`,
  TRANSFER: $localize`Transfer`,
};
