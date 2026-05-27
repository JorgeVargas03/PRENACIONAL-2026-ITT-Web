import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class AdminAuthService {
    private API_URL = 'https://prenacional-2026-itt-api.onrender.com';

    constructor(private http: HttpClient) {}

    login(username: string, password: string) {
        return this.http.post(
            `${this.API_URL}/auth/admin/login`,
            { username, password },
            { withCredentials: true }
        );
    }

    check() {
        return this.http.get(`${this.API_URL}/admin/me`, { withCredentials: true });
    }
}
