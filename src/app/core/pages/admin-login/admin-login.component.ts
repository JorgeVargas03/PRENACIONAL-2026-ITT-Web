import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
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
    showPassword = false;
    isLoading = false;
    errorMessage = '';

    constructor(
        private auth: AdminAuthService,
        private router: Router,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) {}

    togglePasswordVisibility() {
        this.showPassword = !this.showPassword;
    }

    onSubmit() {
        if (!this.username.trim() || !this.password.trim()) {
            this.errorMessage = 'Completa usuario y contraseña.';
            this.cdr.detectChanges();
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        this.auth.login(this.username.trim(), this.password).subscribe({
            next: () => {
                this.ngZone.run(() => {
                    this.isLoading = false;
                    this.router.navigateByUrl('/admin', { replaceUrl: true });
                    this.cdr.detectChanges();
                });
            },
            error: () => {
                this.ngZone.run(() => {
                    this.isLoading = false;
                    this.errorMessage = 'Credenciales incorrectas.';
                    this.cdr.detectChanges();
                });
            }
        });
    }
}
