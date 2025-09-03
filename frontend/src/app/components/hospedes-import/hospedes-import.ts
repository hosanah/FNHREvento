import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HospedesService } from '../../services/hospedes.service';

@Component({
  selector: 'app-hospedes-import',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hospedes-import.html',
  styleUrls: ['./hospedes-import.scss']
})
export class HospedesImportComponent {
  file?: File;

  constructor(private service: HospedesService, private router: Router) {}

  onFile(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length) {
      this.file = target.files[0];
    }
  }

  upload() {
    if (!this.file) return;
    this.service.import(this.file).subscribe(() => {
      this.router.navigate(['/hospedes']);
    });
  }
}
