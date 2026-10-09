import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { HealthResponse } from '@neobank/shared/models';
import { pipe, switchMap, tap } from 'rxjs';
import { HealthApi } from './health.api';

interface SystemStatusState {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: SystemStatusState = {
  health: null,
  loading: false,
  error: null,
};

export const SystemStatusStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ health, error }) => ({
    apiOnline: computed(() => !!health() && !error()),
    dbOnline: computed(() => health()?.db === 'up'),
  })),
  withMethods((store, api = inject(HealthApi)) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.get().pipe(
            tapResponse({
              next: (health) => patchState(store, { health, loading: false }),
              error: () =>
                patchState(store, {
                  health: null,
                  loading: false,
                  error: 'The API is not reachable.',
                }),
            }),
          ),
        ),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),
);
