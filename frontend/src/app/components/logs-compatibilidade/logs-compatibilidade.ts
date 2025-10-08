import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { HospedesService } from '../../services/hospedes.service';

@Component({
  selector: 'app-logs-compatibilidade',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    PanelModule,
    TableModule,
    TagModule
  ],
  templateUrl: './logs-compatibilidade.html',
  styleUrls: ['./logs-compatibilidade.scss']
})
export class LogsCompatibilidadeComponent implements OnInit {
  logs: any[] = [];
  loading = false;
  totalRecords = 0;
  rows = 20;
  first = 0;

  constructor(private service: HospedesService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(event?: any): void {
    this.loading = true;
    const offset = event ? event.first : 0;
    const limit = event ? event.rows : this.rows;

    this.service.getLogsCompatibilidade(limit, offset).subscribe({
      next: (response) => {
        this.logs = response.logs || [];
        this.totalRecords = response.total || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar logs:', err);
        this.loading = false;
      }
    });
  }

  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.loadLogs(event);
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
}
