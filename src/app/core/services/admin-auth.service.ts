import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { enviroment } from '../../../environment/environment';

@Injectable({
    providedIn: 'root'
})
export class AdminAuthService {
    private API_URL = enviroment.apiURL;

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
