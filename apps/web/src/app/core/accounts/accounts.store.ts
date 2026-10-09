import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  setAllEntities,
  setEntity,
  withEntities,
} from '@ngrx/signals/entities';
import {
  type AccountDto,
  MAX_ACCOUNTS_PER_USER,
  type MoneyMovementRequest,
  type MoneyMovementResponse,
  type OpenAccountRequest,
} from '@neobank/shared/models';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../http/api-error';
import { resetOnUserChange } from '../state/reset-on-user-change';
import { AccountsApi } from './accounts.api';

/**
 * The signed-in user's accounts.
 *
 * withEntities() stores them as `entityMap` (id → account) plus `ids`, and
 * derives `entities` (the array). Updating one account after a deposit is then
 * a single setEntity() call, and every view that shows it updates.
 */
export const AccountsStore = signalStore(
  { providedIn: 'root' },
  withEntities<AccountDto>(),
  withState({ loaded: false, loading: false, error: null as string | null }),
  withComputed(({ entities }) => ({
    totalBalance: computed(() =>
      entities().reduce((sum, account) => sum + account.balance, 0),
    ),
    canOpenMore: computed(() => entities().length < MAX_ACCOUNTS_PER_USER),
  })),
  withMethods((store, api = inject(AccountsApi)) => {
    const move = async (
      request: Promise<MoneyMovementResponse>,
    ): Promise<MoneyMovementResponse> => {
      const result = await request;
      patchState(store, setEntity(result.account));
      return result;
    };

    return {
      /** Loads once; pass `true` to reload. */
      async load(force = false): Promise<void> {
        if ((store.loaded() || store.loading()) && !force) return;
        patchState(store, { loading: true, error: null });
        try {
          const accounts = await firstValueFrom(api.list());
          patchState(store, setAllEntities(accounts), {
            loaded: true,
            loading: false,
          });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: toApiError(err).message,
          });
        }
      },

      async open(request: OpenAccountRequest): Promise<AccountDto> {
        const account = await firstValueFrom(api.open(request));
        patchState(store, addEntity(account));
        return account;
      },

      /** `key` is the Idempotency-Key: reuse it when retrying the same deposit. */
      deposit(id: string, request: MoneyMovementRequest, key: string) {
        return move(firstValueFrom(api.deposit(id, request, key)));
      },

      withdraw(id: string, request: MoneyMovementRequest, key: string) {
        return move(firstValueFrom(api.withdraw(id, request, key)));
      },

      /** Replace one account with a fresher copy (e.g. after a transfer). */
      setAccount(account: AccountDto): void {
        patchState(store, setEntity(account));
      },

      reset(): void {
        patchState(store, removeAllEntities(), {
          loaded: false,
          loading: false,
          error: null,
        });
      },
    };
  }),
  withHooks({ onInit: (store) => resetOnUserChange(store) }),
);
