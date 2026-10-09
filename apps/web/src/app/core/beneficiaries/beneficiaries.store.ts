import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  removeEntity,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import type {
  AddBeneficiaryRequest,
  BeneficiaryDto,
} from '@neobank/shared/models';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../http/api-error';
import { resetOnUserChange } from '../state/reset-on-user-change';
import { BeneficiariesApi } from './beneficiaries.api';

/** The signed-in user's saved payees. */
export const BeneficiariesStore = signalStore(
  { providedIn: 'root' },
  withEntities<BeneficiaryDto>(),
  withState({ loaded: false, loading: false, error: null as string | null }),
  withMethods((store, api = inject(BeneficiariesApi)) => ({
    async load(force = false): Promise<void> {
      if ((store.loaded() || store.loading()) && !force) return;
      patchState(store, { loading: true, error: null });
      try {
        const beneficiaries = await firstValueFrom(api.list());
        patchState(store, setAllEntities(beneficiaries), {
          loaded: true,
          loading: false,
        });
      } catch (err) {
        patchState(store, { loading: false, error: toApiError(err).message });
      }
    },

    /** Errors propagate so the form can show them next to the right field. */
    async add(request: AddBeneficiaryRequest): Promise<BeneficiaryDto> {
      const beneficiary = await firstValueFrom(api.add(request));
      patchState(store, addEntity(beneficiary));
      return beneficiary;
    },

    async remove(id: string): Promise<void> {
      await firstValueFrom(api.remove(id));
      patchState(store, removeEntity(id));
    },

    reset(): void {
      patchState(store, removeAllEntities(), {
        loaded: false,
        loading: false,
        error: null,
      });
    },
  })),
  withHooks({ onInit: (store) => resetOnUserChange(store) }),
);
