import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import type { AccountDto } from '@neobank/shared/models';
import { AuthStore } from '../auth/auth.store';
import { session } from '../auth/auth.testing';
import { AccountsStore } from './accounts.store';

const account = (id: string, balance: number): AccountDto => ({
  id,
  accountNumber: 'NB1234567897',
  type: 'SAVINGS',
  nickname: '',
  currency: 'INR',
  balance,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
});

describe('AccountsStore', () => {
  let store: InstanceType<typeof AccountsStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AccountsStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick(); // run the store's initial effect
  });

  afterEach(() => http.verify());

  async function loadWith(accounts: AccountDto[]) {
    const done = store.load();
    http.expectOne('/api/accounts').flush(accounts);
    await done;
  }

  it('loads accounts and totals the balances', async () => {
    await loadWith([account('a', 1000), account('b', 2550)]);

    expect(store.loaded()).toBe(true);
    expect(store.ids()).toEqual(['a', 'b']);
    expect(store.totalBalance()).toBe(3550);
  });

  it('only loads once unless forced', async () => {
    await loadWith([]);

    await store.load();
    http.expectNone('/api/accounts');
  });

  it('updates one account after a deposit', async () => {
    await loadWith([account('a', 1000), account('b', 0)]);

    const done = store.deposit('a', { amountPaise: 500 });
    http.expectOne('/api/accounts/a/deposit').flush({
      account: account('a', 1500),
      entry: {
        id: 'e1',
        transactionId: 't1',
        accountId: 'a',
        type: 'DEPOSIT',
        direction: 'CREDIT',
        amount: 500,
        balanceAfter: 1500,
        description: '',
        createdAt: new Date().toISOString(),
      },
    });
    await done;

    expect(store.entityMap()['a'].balance).toBe(1500);
    expect(store.totalBalance()).toBe(1500);
  });

  it('forgets accounts when a different user signs in', async () => {
    await loadWith([account('a', 1000)]);

    patchState(unprotected(TestBed.inject(AuthStore)), {
      ...session(),
      status: 'authenticated',
    });
    TestBed.tick();

    expect(store.ids()).toEqual([]);
    expect(store.loaded()).toBe(false);
  });
});
