import { Inject, Injectable, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { enviroment } from "../../../environment/environment";

@Injectable({
    providedIn: 'root'
})

export class SocketService {

    private socket?: Socket;
    private isBrowser: boolean;
    private API_URL: string = enviroment.apiURL;

    constructor(@Inject(PLATFORM_ID) platformId: Object) {
        this.isBrowser = isPlatformBrowser(platformId);
        if (this.isBrowser) {
            this.socket = io(this.API_URL);
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
