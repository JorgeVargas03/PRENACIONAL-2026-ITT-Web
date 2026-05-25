import { Component, OnInit } from "@angular/core";
import { SocketService } from "../../services/socket.service";

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html'
})

export class AdminComponent implements OnInit {
    participants: any = {};

    constructor(private socketService: SocketService) { }

    ngOnInit(): void {
        // ENTRAR A ROOM ADMINS
        this.socketService.emit('admin:join');

        // LISTA INICIAL
        this.socketService.listen('participant:list', (data: any) => {
            this.participants = data;
        });

        // ACTUALIZAR REALTIME
        this.socketService.listen('participant:updated', (participant: any) => {
            this.participants[participant.id] = participant;

            console.log('Participante actualizado');
        });

        // PARTICIPANTE ELIMINADO
        this.socketService.listen('participant:removed', (id: string)=>{
            delete this.participants[id];
        });
    }
}