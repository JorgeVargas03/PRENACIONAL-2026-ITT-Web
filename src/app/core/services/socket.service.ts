import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})

export class SocketService {

    private socket?: Socket;
    private isBrowser: boolean;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
        if (this.isBrowser) {
            this.socket = io('http://localhost:3000');
        }
    }

    // EMITIR EVENTO
    emit(event: string, data?: any){
        if (!this.socket) return;
        this.socket.emit(event, data);
    }

    // ESCUCHAR EVENTO
    listen(event: string, callback: any){
        if (!this.socket) return;
        this.socket.on(event, callback);
    }
}
