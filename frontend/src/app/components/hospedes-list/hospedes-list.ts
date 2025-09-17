import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { HospedesService } from '../../services/hospedes.service';

@Component({
  selector: 'app-hospedes-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, ButtonModule],
  templateUrl: './hospedes-list.html',
  styleUrls: ['./hospedes-list.scss']
})
export class HospedesListComponent implements OnInit {
  hospedes: any[] = [];
  buscandoCompatibilidade: Record<number, boolean> = {};

  constructor(private service: HospedesService) {}

  ngOnInit(): void {
    this.service.list().subscribe(data => this.hospedes = data);
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
    });
  }
}
