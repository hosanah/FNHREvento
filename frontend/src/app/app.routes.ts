import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login').then(m => m.LoginComponent) },
  { path: 'reset-password', loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'hospedes/import', loadComponent: () => import('./components/hospedes-import/hospedes-import').then(m => m.HospedesImportComponent) },
  { path: 'hospedes', loadComponent: () => import('./components/hospedes-list/hospedes-list').then(m => m.HospedesListComponent) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
