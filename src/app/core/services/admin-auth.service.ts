import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { firstValueFrom, of } from 'rxjs';
import { enviroment } from '../../../environment/environment';

@Injectable({
    providedIn: 'root'
})
export class AdminAuthService {
    private API_URL = enviroment.apiURL;
    private sessionInitPromise: Promise<boolean>;
    private sessionInitResolve?: (value: boolean) => void;
    private authenticated = false;
    private readonly SESSION_KEY = 'admin_session';

    private isBrowser = false;

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
        this.sessionInitPromise = new Promise<boolean>((resolve) => {
            this.sessionInitResolve = resolve;
        });
        if (this.isBrowser) {
            this.restoreSession();
        } else {
            this.authenticated = false;
            this.sessionInitResolve?.(false);
        }
    }

    login(username: string, password: string) {
        return this.http.post(
            `${this.API_URL}/auth/admin/login`,
            { username, password },
            { withCredentials: true }
        ).pipe(
            tap(() => {
                this.setSessionActive(true);
            })
        );
    }

    logout() {
        return this.http.post(
            `${this.API_URL}/auth/admin/logout`,
            {},
            { withCredentials: true }
        ).pipe(
            tap(() => {
                this.setSessionActive(false);
            })
        );
    }

    check() {
        return this.http.get(`${this.API_URL}/admin/me`, { withCredentials: true });
    }

    waitForSessionInit() {
        return this.sessionInitPromise;
    }

    isAuthenticated() {
        return this.authenticated;
    }

    clearSession() {
        this.setSessionActive(false);
    }

    private restoreSession() {
        if (!this.isBrowser) {
            this.authenticated = false;
            this.sessionInitResolve?.(false);
            return;
        }
        const hasSession = localStorage.getItem(this.SESSION_KEY) === '1';
        if (!hasSession) {
            this.authenticated = false;
            this.sessionInitResolve?.(false);
            return;
        }

        this.authenticated = true;
        this.sessionInitResolve?.(true);

        this.check().pipe(
            map(() => true),
            catchError(() => of(false))
        ).subscribe((ok) => {
            if (!ok) {
                this.setSessionActive(false);
            }
        });
    }

    private setSessionActive(active: boolean) {
        this.authenticated = active;
        if (this.isBrowser) {
            if (active) {
                localStorage.setItem(this.SESSION_KEY, '1');
            } else {
                localStorage.removeItem(this.SESSION_KEY);
            }
        }
    }
}
