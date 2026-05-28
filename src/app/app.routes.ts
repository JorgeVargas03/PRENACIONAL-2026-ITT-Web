import { Routes } from '@angular/router';
import { AdminComponent } from './core/pages/admin/admin.component';
import { ParticipantComponent } from './core/pages/participant/participant.component';
import { AdminLoginComponent } from './core/pages/admin-login/admin-login.component';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { adminLoginGuard } from './core/guards/admin-login.guard';

export const routes: Routes = [
	{ path: '', component: ParticipantComponent },
	{ path: 'admin/login', component: AdminLoginComponent, canActivate: [adminLoginGuard] },
	{ path: 'admin', component: AdminComponent, canActivate: [adminAuthGuard] }
];
