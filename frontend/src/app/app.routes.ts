import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login').then(m => m.LoginComponent) },
  { path: 'home', loadComponent: () => import('./components/home/home').then(m => m.HomeComponent), canActivate: [authGuard] },
  { path: 'reset-password', loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'hospedes/import', loadComponent: () => import('./components/hospedes-import/hospedes-import').then(m => m.HospedesImportComponent), canActivate: [authGuard] },
  { path: 'hospedes', loadComponent: () => import('./components/hospedes-list/hospedes-list').then(m => m.HospedesListComponent), canActivate: [authGuard] },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' }
];
