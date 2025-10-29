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
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { HospedesService } from '../../services/hospedes.service';

@Component({
  selector: 'app-reservas-integradas',
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
    TableModule,
  ],
  templateUrl: './reservas-integradas.html',
  styleUrls: ['./reservas-integradas.scss']
})
export class ReservasIntegradasComponent implements OnInit {
  hospedes: any[] = [];
  page = 0;
  rows = 10;
  filterTerm = '';
  detailDialogVisible = false;
  selectedHospede: any | null = null;
  logsDialogVisible = false;
  selectedHospedeForLogs: any | null = null;
  hospedeLogsList: any[] = [];
  loadingLogs = false;

  private readonly statusLabels: Record<number, string> = {
    1: 'Importado',
    2: 'Compatível',
    3: 'Integrado'
  };

  constructor(
    private service: HospedesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.service.list().subscribe(data => {
      // Filtrar apenas os hóspedes com status 3 (Integrado)
      this.hospedes = (data ?? []).filter(h => h.status == 3);
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
    let filtered = this.hospedes;

    // Filtro por texto
    if (term) {
      filtered = filtered.filter(hospede => {
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

    return filtered;
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

  showLogs(hospede: any): void {
    this.selectedHospedeForLogs = hospede;
    this.logsDialogVisible = true;
    this.loadingLogs = true;
    this.hospedeLogsList = [];

    this.service.getLogsHospede(hospede.id).subscribe({
      next: (logs) => {
        this.hospedeLogsList = logs || [];
        this.loadingLogs = false;
      },
      error: (err) => {
        console.error('Erro ao carregar logs do hóspede:', err);
        this.loadingLogs = false;
      }
    });
  }

  getTipoAcaoSeverity(tipoAcao: string): string {
    switch (tipoAcao) {
      case 'sucesso':
        return 'success';
      case 'nao_encontrado':
        return 'warning';
      case 'erro':
        return 'danger';
      default:
        return 'info';
    }
  }

  getTipoAcaoLabel(tipoAcao: string): string {
    switch (tipoAcao) {
      case 'sucesso':
        return 'Sucesso';
      case 'nao_encontrado':
        return 'Não Encontrado';
      case 'erro':
        return 'Erro';
      default:
        return tipoAcao;
    }
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  }

  getStatusLabel(status: unknown): string {
    if (status === null || status === undefined || status === '') {
      return '-';
    }

    // Converter para número se for string numérica
    const statusNum = typeof status === 'number' ? status : parseInt(String(status), 10);

    // Verificar se é um número válido
    if (!isNaN(statusNum) && this.statusLabels[statusNum]) {
      return this.statusLabels[statusNum];
    }

    // Fallback para string
    const texto = String(status).trim();
    return texto || '-';
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
