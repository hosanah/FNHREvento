import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    PanelModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextModule,
    SelectModule
  ],
  templateUrl: './users-list.html',
  styleUrls: ['./users-list.scss']
})
export class UsersListComponent implements OnInit {
  users: any[] = [];
  filterTerm = '';
  createDialogVisible = false;
  editDialogVisible = false;
  userEmEdicao: any | null = null;
  salvandoUser = false;

  readonly roleOptions = [
    { label: 'Administrador', value: 'administrador' },
    { label: 'Usuário', value: 'usuario' }
  ];

  constructor(
    private service: UsersService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.service.list().subscribe({
      next: (data) => {
        this.users = data || [];
      },
      error: (err) => {
        const mensagem = err?.error?.error || 'Erro ao carregar usuários';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
      }
    });
  }

  get filteredUsers(): any[] {
    const term = this.filterTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter(user => {
      const values = [
        user?.username,
        user?.email,
        user?.full_name,
        user?.role
      ];

      return values.some(value =>
        value && String(value).toLowerCase().includes(term)
      );
    });
  }

  showCreateDialog(): void {
    this.userEmEdicao = {
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'usuario',
      is_active: true
    };
    this.createDialogVisible = true;
  }

  showEditDialog(user: any): void {
    this.userEmEdicao = {
      ...user,
      password: '' // Não carregar a senha
    };
    this.editDialogVisible = true;
  }

  cancelDialog(): void {
    this.createDialogVisible = false;
    this.editDialogVisible = false;
    this.userEmEdicao = null;
  }

  createUser(): void {
    if (!this.userEmEdicao) {
      return;
    }

    // Validações básicas
    if (!this.userEmEdicao.username || !this.userEmEdicao.email || !this.userEmEdicao.password) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Preencha username, email e senha',
        life: 3000
      });
      return;
    }

    this.salvandoUser = true;

    this.service.create(this.userEmEdicao).subscribe({
      next: (response) => {
        this.salvandoUser = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: response.message || 'Usuário criado com sucesso!',
          life: 3000
        });
        this.createDialogVisible = false;
        this.userEmEdicao = null;
        this.loadUsers();
      },
      error: (err) => {
        this.salvandoUser = false;
        const mensagem = err?.error?.error || 'Erro ao criar usuário';
        const details = err?.error?.details;

        let detailMessage = mensagem;
        if (details && Array.isArray(details)) {
          detailMessage = mensagem + ':\n' + details.join('\n');
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: detailMessage,
          life: 7000
        });
      }
    });
  }

  updateUser(): void {
    if (!this.userEmEdicao || !this.userEmEdicao.id) {
      return;
    }

    this.salvandoUser = true;

    // Remover password se estiver vazio (não alterar)
    const dataToUpdate = { ...this.userEmEdicao };
    if (!dataToUpdate.password) {
      delete dataToUpdate.password;
    }

    this.service.update(this.userEmEdicao.id, dataToUpdate).subscribe({
      next: (response) => {
        this.salvandoUser = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: response.message || 'Usuário atualizado com sucesso!',
          life: 3000
        });
        this.editDialogVisible = false;
        this.userEmEdicao = null;
        this.loadUsers();
      },
      error: (err) => {
        this.salvandoUser = false;
        const mensagem = err?.error?.error || 'Erro ao atualizar usuário';
        const details = err?.error?.details;

        let detailMessage = mensagem;
        if (details && Array.isArray(details)) {
          detailMessage = mensagem + ':\n' + details.join('\n');
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: detailMessage,
          life: 7000
        });
      }
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`Deseja realmente excluir o usuário ${user.username}?`)) {
      return;
    }

    this.service.delete(user.id).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: response?.message || 'Usuário excluído com sucesso!',
          life: 3000
        });
        this.loadUsers();
      },
      error: (err) => {
        const mensagem = err?.error?.error || 'Erro ao excluir usuário';
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: mensagem,
          life: 5000
        });
      }
    });
  }

  getRoleSeverity(role: string): string {
    return role === 'administrador' ? 'danger' : 'info';
  }

  getRoleLabel(role: string): string {
    return role === 'administrador' ? 'Administrador' : 'Usuário';
  }

  getStatusSeverity(isActive: number): string {
    return isActive ? 'success' : 'secondary';
  }

  getStatusLabel(isActive: number): string {
    return isActive ? 'Ativo' : 'Inativo';
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  }
}
