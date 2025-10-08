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
    TableModule,
  ],
  templateUrl: './hospedes-list.html',
  styleUrls: ['./hospedes-list.scss']
})
export class HospedesListComponent implements OnInit {
  hospedes: any[] = [];
  buscandoCompatibilidade: Record<number, boolean> = {};
  buscandoCompatibilidadeTodos = false;
  atualizandoOracle: Record<number, boolean> = {};
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

        console.log('🔍 Resposta do backend:', response);
        console.log('📋 Hóspede atualizado:', response?.hospede);
        console.log('⚡ Status recebido:', response?.hospede?.status);

        const dadosAtualizados = response?.hospede;
        if (dadosAtualizados) {
          Object.assign(hospede, dadosAtualizados);
          console.log('✅ Objeto local atualizado. Novo status:', hospede.status);
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

  atualizarOracle(hospede: any): void {
    if (!hospede || !hospede.id) {
      return;
    }

    const id = hospede.id;
    this.atualizandoOracle[id] = true;

    this.service.atualizarOracle(id).subscribe({
      next: (response) => {
        this.atualizandoOracle[id] = false;

        // Atualizar objeto local com dados retornados (incluindo novo status)
        const dadosAtualizados = response?.hospede;
        if (dadosAtualizados) {
          Object.assign(hospede, dadosAtualizados);
        }

        window.alert(response.message || 'Dados atualizados no Oracle com sucesso!');
      },
      error: (err) => {
        this.atualizandoOracle[id] = false;
        const mensagem = err?.error?.error || 'Erro ao atualizar dados no Oracle';
        window.alert(mensagem);
      }
    });
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
