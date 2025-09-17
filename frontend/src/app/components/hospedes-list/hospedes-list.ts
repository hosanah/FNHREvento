import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { HospedesService } from '../../services/hospedes.service';

@Component({
  selector: 'app-hospedes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    PanelModule,
    PaginatorModule,
    TagModule,
    DialogModule,
    InputTextModule,
  ],
  templateUrl: './hospedes-list.html',
  styleUrls: ['./hospedes-list.scss']
})
export class HospedesListComponent implements OnInit {
  hospedes: any[] = [];
  buscandoCompatibilidade: Record<number, boolean> = {};
  page = 0;
  rows = 10;
  filterTerm = '';
  detailDialogVisible = false;
  selectedHospede: any | null = null;

  constructor(private service: HospedesService) {}

  ngOnInit(): void {
    this.service.list().subscribe(data => {
      this.hospedes = data ?? [];
      this.page = 0;
    });
  }

  get paginatedHospedes(): any[] {
    const filtered = this.filteredHospedes;
    const start = this.page * this.rows;
    return filtered.slice(start, start + this.rows);
  }

  get totalRecords(): number {
    return this.filteredHospedes.length;
  }

  get filteredHospedes(): any[] {
    const term = this.filterTerm.trim().toLowerCase();

    if (!term) {
      return this.hospedes;
    }

    return this.hospedes.filter(hospede => {
      const values = [
        hospede?.nome_completo,
        hospede?.email,
        hospede?.telefone,
        hospede?.apto,
        hospede?.codigo,
        hospede?.status,
      ];

      return values.some(value => this.includesTerm(value, term));
    });
  }

  buscarCompatibilidade(hospede: any): void {
    if (!hospede || !hospede.id) {
      return;
    }

    const id = hospede.id;
    this.buscandoCompatibilidade[id] = true;

    this.service.buscarCompatibilidade(id).subscribe({
      next: response => {
        this.buscandoCompatibilidade[id] = false;

        const dadosAtualizados = response?.hospede;
        if (dadosAtualizados) {
          Object.assign(hospede, dadosAtualizados);
        }

        if (response?.message) {
          window.alert(response.message);
        }
      },
      error: err => {
        this.buscandoCompatibilidade[id] = false;
        const mensagem = err?.error?.error || 'Erro ao buscar compatibilidade da reserva';
        window.alert(mensagem);
      }
    });
  }

  remove(id: number): void {
    this.service.delete(id).subscribe(() => {
      this.hospedes = this.hospedes.filter(h => h.id !== id);
      this.adjustPage();
    });
  }

  onFilterChange(): void {
    this.page = 0;
    this.adjustPage();
  }

  onPageChange(event: PaginatorState): void {
    if (typeof event.page === 'number') {
      this.page = event.page;
    }

    if (typeof event.rows === 'number') {
      this.rows = event.rows;
      this.adjustPage();
    }
  }

  showDetalhes(hospede: any): void {
    this.selectedHospede = hospede;
    this.detailDialogVisible = true;
  }

  onDialogHide(): void {
    this.detailDialogVisible = false;
    this.selectedHospede = null;
  }

  private includesTerm(value: unknown, term: string): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    return String(value).toLowerCase().includes(term);
  }

  private adjustPage(): void {
    const totalPages = Math.ceil(this.totalRecords / this.rows) || 1;
    const lastPage = Math.max(totalPages - 1, 0);
    if (this.page > lastPage) {
      this.page = lastPage;
    }
  }
}
