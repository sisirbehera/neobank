import { computed, effect, inject, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

/**
 * Calls `store.reset()` whenever the signed-in user changes (log out, log in
 * as someone else), so one user's data is never shown to the next.
 * Call it from a SignalStore's onInit hook (it needs an injection context):
 *
 *   withHooks({ onInit: (store) => resetOnUserChange(store) })
 */
export function resetOnUserChange(store: { reset(): void }): void {
  const auth = inject(AuthStore);
  const userId = computed(() => auth.user()?.id);
  effect(() => {
    userId();
    untracked(() => store.reset());
  });
}
