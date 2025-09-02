/**
 * Configuração de rotas do Angular
 * Define navegação entre login e home
 */

import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { MasterLayoutComponent } from './components/layout/component/master-layout';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  {
    path: '',
    component: MasterLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./components/home/home').then(m => m.HomeComponent) },
      { path: '**', redirectTo: '' }
    ]
  }
];
