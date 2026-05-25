import { Component } from "@angular/core";
import { SocketService } from "../../services/socket.service";
import { error } from "console";

@Component({
    selector: 'app-participant',
    templateUrl: './participant.component.html'
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

            this.SocketService.emit('location:stop', this.participantId);
        }
    }
}