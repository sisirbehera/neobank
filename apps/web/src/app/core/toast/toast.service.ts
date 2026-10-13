import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** How long a toast stays on screen. Errors stay until closed. */
const DURATION_MS = 5000;
/** Older toasts drop off so a burst can't cover the page. */
const MAX_VISIBLE = 3;

/**
 * Short messages about something that already happened, shown in a corner
 * (rendered by <nb-toasts> in the app shell). For results the user must act
 * on, or errors in a form, keep using an alert next to the form.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly list = signal<Toast[]>([]);
  readonly toasts = this.list.asReadonly();

  success(text: string): void {
    this.show('success', text);
  }

  info(text: string): void {
    this.show('info', text);
  }

  warning(text: string): void {
    this.show('warning', text);
  }

  error(text: string): void {
    this.show('danger', text);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.list.update((list) => list.filter((t) => t.id !== id));
  }

  /** Keeps a toast open while the pointer or focus is on it. */
  pause(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  resume(id: number): void {
    const toast = this.list().find((t) => t.id === id);
    if (toast && toast.kind !== 'danger') this.schedule(id);
  }

  private show(kind: ToastKind, text: string): void {
    const id = this.nextId++;
    const kept = this.list().slice(-(MAX_VISIBLE - 1));
    for (const old of this.list()) {
      if (!kept.includes(old)) this.dismiss(old.id);
    }
    this.list.set([...kept, { id, kind, text }]);
    if (kind !== 'danger') this.schedule(id);
  }

  private schedule(id: number): void {
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), DURATION_MS),
    );
  }
}
