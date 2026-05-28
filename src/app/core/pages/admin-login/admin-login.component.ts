import { Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
    selector: 'app-admin-login',
    templateUrl: './admin-login.component.html',
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class AdminLoginComponent {
    username = '';
    password = '';
    isLoading = false;
    errorMessage = '';

    constructor(
        private auth: AdminAuthService,
        private router: Router,
        private ngZone: NgZone
    ) {}

    onSubmit() {
        if (!this.username.trim() || !this.password.trim()) {
            this.errorMessage = 'Completa usuario y contraseña.';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        this.auth.login(this.username.trim(), this.password).subscribe({
            next: () => {
                this.ngZone.run(() => {
                    this.isLoading = false;
                    this.router.navigateByUrl('/admin', { replaceUrl: true });
                });
            },
            error: () => {
                this.ngZone.run(() => {
                    this.isLoading = false;
                    this.errorMessage = 'Credenciales incorrectas.';
                });
            }
        });
    }
}
