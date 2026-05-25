import { Component } from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from "../../services/socket.service";

@Component({
    selector: 'app-participant',
    templateUrl: './participant.component.html',
    standalone: true,
    imports: [CommonModule, FormsModule]
})

export class ParticipantComponent {
    watchId: number | null = null;
    participantId = crypto.randomUUID();

    participantData = {
        tecnologico: '',
        encargado: '',
        telefono: ''
    };

    constructor(private SocketService: SocketService) { }

    // GUARDAR DATOS
    saveData() {
        localStorage.setItem('participantData', JSON.stringify(this.participantData));
        localStorage.setItem('participantId', this.participantId);


        alert('Datos guardados');
    }

    // ACTIVAR UBICACION
    startSharing() {
        this.SocketService.emit('participant:join', {
            id: this.participantId,
            ...this.participantData
        });

        this.watchId = navigator.geolocation.watchPosition((position) => {
            const payload = {
                id: this.participantId,
                ...this.participantData,
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            this.SocketService.emit('location:update', payload);
        },
            (error) =>{
                console.error(error);
            },

            {
                enableHighAccuracy: true
            }
        );
    }

    // DETENER UBICACION
    stopSharing(){
        if(this.watchId !== null){
            navigator.geolocation.clearWatch(
                this.watchId
            );

            this.watchId = null;

            this.SocketService.emit('location:stop', this.participantId);
        }
    }
}