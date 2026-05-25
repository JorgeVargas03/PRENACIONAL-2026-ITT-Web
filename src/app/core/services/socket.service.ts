import { Injectable } from "@angular/core";
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})

export class SocketService {

    private socket: Socket;

    constructor() {
        this.socket = io('URL');
    }

    // EMITIR EVENTO
    emit(event: string, data?: any){
        this.socket.emit(event, data);
    }

    // ESCUCHAR EVENTO
    listen(event: string, callback: any){
        this.socket.on(event, callback);
    }
}
