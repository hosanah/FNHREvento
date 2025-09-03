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

  constructor(private service: HospedesService) {}

  ngOnInit(): void {
    this.service.list().subscribe(data => this.hospedes = data);
  }

  remove(id: number): void {
    this.service.delete(id).subscribe(() => {
      this.hospedes = this.hospedes.filter(h => h.id !== id);
    });
  }
}
