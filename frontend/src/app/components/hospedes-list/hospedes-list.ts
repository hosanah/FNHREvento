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
  buscandoCompatibilidadeTodos = false;
  page = 0;
  rows = 10;
  filterTerm = '';
  detailDialogVisible = false;
  selectedHospede: any | null = null;

  private readonly statusLabels: Record<string, string> = {
    importado: 'Importado',
    compativel: 'Compatível',
    'não compativel': 'Não Compatível',
    'nao compativel': 'Não Compatível',
    integrado: 'Integrado'
  };

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

  buscarCompatibilidadeTodos(): void {
    if (this.buscandoCompatibilidadeTodos) {
      return;
    }

    this.buscandoCompatibilidadeTodos = true;

    this.service.buscarCompatibilidadeTodos().subscribe({
      next: response => {
        this.buscandoCompatibilidadeTodos = false;

        const resultados = Array.isArray(response?.resultados) ? response.resultados : [];
        resultados.forEach((resultado: any) => {
          const hospedeAtualizado = resultado?.hospede;
          if (hospedeAtualizado && hospedeAtualizado.id) {
            const index = this.hospedes.findIndex(h => h.id === hospedeAtualizado.id);
            if (index !== -1) {
              this.hospedes[index] = { ...this.hospedes[index], ...hospedeAtualizado };
            }
          }
        });

        this.adjustPage();

        const mensagemResumo = this.montarResumoCompatibilidade(response);
        if (mensagemResumo) {
          window.alert(mensagemResumo);
        }
      },
      error: err => {
        this.buscandoCompatibilidadeTodos = false;
        const mensagem = err?.error?.error || 'Erro ao buscar compatibilidade das reservas';
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

  getStatusLabel(status: unknown): string {
    if (status === null || status === undefined || status === '') {
      return '-';
    }

    const texto = String(status).trim();
    if (!texto) {
      return '-';
    }

    const normalizado = texto.toLowerCase();
    const label = this.statusLabels[normalizado];
    if (label) {
      return label;
    }

    return texto
      .split(/\s+/)
      .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
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

  private montarResumoCompatibilidade(resumo: any): string {
    if (!resumo || typeof resumo !== 'object') {
      return '';
    }

    const partes: string[] = [];

    if (typeof resumo.totalElegiveis === 'number') {
      partes.push(`Hóspedes elegíveis: ${resumo.totalElegiveis}`);
    }

    if (typeof resumo.totalProcessados === 'number') {
      partes.push(`Processados: ${resumo.totalProcessados}`);
    }

    if (typeof resumo.compatibilidadesEncontradas === 'number') {
      partes.push(`Compatibilidades encontradas: ${resumo.compatibilidadesEncontradas}`);
    }

    if (typeof resumo.semCompatibilidade === 'number') {
      partes.push(`Sem compatibilidade: ${resumo.semCompatibilidade}`);
    }

    if (typeof resumo.inelegiveis === 'number' && resumo.inelegiveis > 0) {
      partes.push(`Inelegíveis: ${resumo.inelegiveis}`);
    }

    if (typeof resumo.errosProcessamento === 'number' && resumo.errosProcessamento > 0) {
      partes.push(`Com erros: ${resumo.errosProcessamento}`);
    }

    return partes.join('\n');
  }
}
