import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type AddBeneficiaryRequest,
  type BeneficiaryDto,
  BeneficiaryDtoSchema,
} from '@neobank/shared/models';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BeneficiariesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<BeneficiaryDto[]> {
    return this.http
      .get<unknown>('/api/beneficiaries')
      .pipe(map((body) => BeneficiaryDtoSchema.array().parse(body)));
  }

  add(body: AddBeneficiaryRequest): Observable<BeneficiaryDto> {
    return this.http
      .post<unknown>('/api/beneficiaries', body)
      .pipe(map((res) => BeneficiaryDtoSchema.parse(res)));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/beneficiaries/${id}`);
  }
}
