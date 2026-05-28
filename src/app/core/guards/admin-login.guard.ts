import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

export const adminLoginGuard: CanActivateFn = async () => {
    const auth = inject(AdminAuthService);
    const router = inject(Router);

    await auth.waitForSessionInit();
    if (auth.isAuthenticated()) {
        return router.createUrlTree(['/admin']);
    }

    return true;
};
