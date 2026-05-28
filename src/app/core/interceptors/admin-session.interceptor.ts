import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { AdminAuthService } from '../services/admin-auth.service';

let handlingSessionExpiry = false;

export const adminSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isUnauthorized = error.status === 401;
      const isLoginCall = req.url.includes('/auth/admin/login');
      const isLogoutCall = req.url.includes('/auth/admin/logout');

      if (
        isBrowser &&
        isUnauthorized &&
        !isLoginCall &&
        !isLogoutCall &&
        auth.isAuthenticated() &&
        !handlingSessionExpiry
      ) {
        handlingSessionExpiry = true;
        auth.clearSession();

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: 'Tu sesión caducó. Inicia sesión nuevamente.',
          showConfirmButton: false,
          timer: 2600,
          timerProgressBar: true
        });

        if (router.url !== '/admin/login') {
          router.navigateByUrl('/admin/login', { replaceUrl: true });
        }

        setTimeout(() => {
          handlingSessionExpiry = false;
        }, 1200);
      }

      return throwError(() => error);
    })
  );
};
