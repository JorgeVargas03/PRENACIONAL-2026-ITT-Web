import { Routes } from '@angular/router';
import { AdminComponent } from './core/pages/admin/admin.component';
import { ParticipantComponent } from './core/pages/participant/participant.component';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'participant' },
	{ path: 'participant', component: ParticipantComponent },
	{ path: 'admin', component: AdminComponent }
];
