import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';

export const adminAuthGuard: CanActivateFn = () => {
    const auth = inject(AdminAuthService);
    const router = inject(Router);

    return auth.check().pipe(
        map(() => true),
        catchError(() => {
            router.navigateByUrl('/admin/login');
            return of(false);
        })
    );
};
