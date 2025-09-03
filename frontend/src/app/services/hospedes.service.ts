import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HospedesService {
  private baseUrl = '/hospedes';

  constructor(private http: HttpClient) {}

  import(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/import`, formData);
  }

  list(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }
}
