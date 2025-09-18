import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HospedesService {
  private baseUrl = `${environment.apiUrl}/hospedes`;

  constructor(private http: HttpClient) {}

  import(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/import`, formData);
  }

  list(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  buscarCompatibilidade(id: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/compatibilidade`, {});
  }

  buscarCompatibilidadeTodos(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/compatibilidade`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
