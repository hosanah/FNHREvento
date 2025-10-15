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
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
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
    SelectModule,
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
  filterStatus: number | null = null;
  detailDialogVisible = false;
  selectedHospede: any | null = null;
  logsDialogVisible = false;
  selectedHospedeForLogs: any | null = null;
  hospedeLogsList: any[] = [];
  loadingLogs = false;
  editDialogVisible = false;
  hospedeEmEdicao: any | null = null;
  salvandoHospede = false;

  private readonly statusLabels: Record<number, string> = {
    1: 'Importado',
    2: 'Compatível',
    3: 'Integrado'
  };

  readonly statusOptions = [
    { label: 'Todos', value: null },
    { label: 'Importado', value: 1 },
    { label: 'Compatível', value: 2 }
  ];

  constructor(
    private service: HospedesService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.service.list().subscribe(data => {
      // Filtrar apenas os hóspedes com status 1 (Importado) e 2 (Compatível)
      this.hospedes = (data ?? []).filter(h => h.status === 1 || h.status === 2);
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

    // Filtro por status
    if (this.filterStatus !== null) {
      filtered = filtered.filter(hospede => hospede.status === this.filterStatus);
    }

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
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: response.message,
            life: 5000
          });
        }
      },
      error: err => {
        this.buscandoCompatibilidade[id] = false;
        const mensagem = err?.error?.error || 'Erro ao buscar compatibilidade da reserva';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
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
          this.messageService.add({
            severity: 'info',
            summary: 'Busca Concluída',
            detail: mensagemResumo,
            life: 7000
          });
        }
      },
      error: err => {
        this.buscandoCompatibilidadeTodos = false;
        const mensagem = err?.error?.error || 'Erro ao buscar compatibilidade das reservas';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
      }
    });
  }

  remove(hospede: any): void {
    // Impedir exclusão de registros integrados
    if (hospede.status == 3) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Ação Bloqueada',
        detail: 'Não é possível excluir um hóspede já integrado ao sistema FNRH.',
        life: 5000
      });
      return;
    }

    if (!confirm(`Deseja realmente excluir o hóspede ${hospede.nome_completo}?`)) {
      return;
    }

    this.service.delete(hospede.id).subscribe(() => {
      this.hospedes = this.hospedes.filter(h => h.id !== hospede.id);
      this.adjustPage();
      this.messageService.add({
        severity: 'success',
        summary: 'Sucesso',
        detail: 'Hóspede excluído com sucesso!',
        life: 3000
      });
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

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: response.message || 'Dados atualizados no Oracle com sucesso!',
          life: 5000
        });
      },
      error: (err) => {
        this.atualizandoOracle[id] = false;
        const mensagem = err?.error?.error || 'Erro ao atualizar dados no Oracle';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
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

  editHospede(hospede: any): void {
    // Bloquear edição de registros integrados (status 3)
    if (hospede.status == 3) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Ação Bloqueada',
        detail: 'Não é possível editar um hóspede já integrado ao sistema FNRH.',
        life: 5000
      });
      return;
    }

    // Criar uma cópia do hóspede para edição
    this.hospedeEmEdicao = { ...hospede };
    this.editDialogVisible = true;
  }

  cancelEdit(): void {
    this.editDialogVisible = false;
    this.hospedeEmEdicao = null;
  }

  saveHospede(): void {
    if (!this.hospedeEmEdicao || !this.hospedeEmEdicao.id) {
      return;
    }

    this.salvandoHospede = true;

    this.service.update(this.hospedeEmEdicao.id, this.hospedeEmEdicao).subscribe({
      next: (hospedeAtualizado) => {
        this.salvandoHospede = false;

        // Atualizar o hóspede na lista
        const index = this.hospedes.findIndex(h => h.id === this.hospedeEmEdicao!.id);
        if (index !== -1) {
          this.hospedes[index] = { ...this.hospedes[index], ...hospedeAtualizado };
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Hóspede atualizado com sucesso!',
          life: 3000
        });
        this.editDialogVisible = false;
        this.hospedeEmEdicao = null;
      },
      error: (err) => {
        this.salvandoHospede = false;
        const mensagem = err?.error?.error || 'Erro ao atualizar hóspede';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
      }
    });
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
