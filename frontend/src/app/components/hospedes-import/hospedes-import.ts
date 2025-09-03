import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HospedesService } from '../../services/hospedes.service';
import { FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-hospedes-import',
  standalone: true,
  imports: [CommonModule, RouterModule, FileUploadModule, ButtonModule],
  templateUrl: './hospedes-import.html',
  styleUrls: ['./hospedes-import.scss']
})
export class HospedesImportComponent {
  file?: File;

  constructor(private service: HospedesService, private router: Router) {}

  onFile(event: FileSelectEvent) {
    if (event.files && event.files.length) {
      this.file = event.files[0];
    }
  }

  upload() {
    if (!this.file) return;
    this.service.import(this.file).subscribe(() => {
      this.router.navigate(['/hospedes']);
    });
  }
}
