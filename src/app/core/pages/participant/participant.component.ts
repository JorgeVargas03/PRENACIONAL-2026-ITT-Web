import { Component, Inject, NgZone, OnInit, PLATFORM_ID } from "@angular/core";
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { SocketService } from "../../services/socket.service";
import { TECH_BY_ID, TECH_CATALOG } from "../../types/tecType";

@Component({
    selector: 'app-participant',
    templateUrl: './participant.component.html',
    standalone: true,
    imports: [CommonModule, FormsModule, NgSelectModule]
})

export class ParticipantComponent implements OnInit {
    watchId: number | null = null;
    participantId = '';
    private isBrowser = false;
    techOptions = TECH_CATALOG;

    participantData = {
        tecId: '',
        encargado: '',
        telefono: ''
    };

    // UI state
    status: 'idle' | 'sharing' | 'stopped' | 'denied' | 'reconnecting' | 'error' = 'idle';
    lastPosition: { lat: number; lng: number; at: string } | null = null;
    reconnectAttempts = 0;
    sharingRequested = false;

    constructor(
        private SocketService: SocketService,
        private ngZone: NgZone,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngOnInit(): void {
        if (this.isBrowser) {
            const savedId = localStorage.getItem('participantId');
            this.participantId = savedId || this.safeUuid();

            // load saved data if present
            const saved = localStorage.getItem('participantData');
            if (saved) {
                try {
                    this.participantData = JSON.parse(saved);
                } catch (e) {
                    // ignore
                }
            }
        } else {
            this.participantId = 'server';
            return;
        }

        // react to socket connect/disconnect for reconnection behavior
        this.SocketService.listen('connect', () => {
            // if we were sharing, re-join and resume
            if (this.status === 'reconnecting' || this.status === 'sharing') {
                this.reconnectAttempts = 0;
                this.SocketService.emit('participant:join', { id: this.participantId, ...this.participantData });
                if (this.watchId === null) {
                    // attempt to restart geolocation
                    this.startGeolocationWatch();
                }
                this.ngZone.run(() => this.status = 'sharing');
            }
        });

        this.SocketService.listen('disconnect', () => {
            if (this.watchId !== null) {
                this.ngZone.run(() => this.status = 'reconnecting');
                this.reconnectAttempts++;
            }
        });
    }

    // GUARDAR DATOS
    saveData() {
        if (!this.isBrowser) return;
        localStorage.setItem('participantData', JSON.stringify(this.participantData));
        localStorage.setItem('participantId', String(this.participantId));
        this.ngZone.run(() => alert('Datos guardados'));
    }

    // Public: iniciar compartir (maneja permisos y reconexión)
    async startSharing() {
        if (!this.isBrowser) return;
        if (this.isSharingActive) return;
        this.sharingRequested = true;
        this.ngZone.run(() => this.status = 'sharing');
        // check geolocation permission if available
        try {
            if ((navigator as any).permissions && (navigator as any).permissions.query) {
                const perm = await (navigator as any).permissions.query({ name: 'geolocation' });
                if (perm.state === 'denied') {
                    this.status = 'denied';
                    this.sharingRequested = false;
                    return;
                }
            }
        } catch (e) {
            // ignore permission query errors
        }

        // emit join and start watching
        this.SocketService.emit('participant:join', { id: this.participantId, ...this.participantData });
        this.startGeolocationWatch();
    }

    private startGeolocationWatch(){
        if (!this.isBrowser) return;
        if (!('geolocation' in navigator)) {
            this.status = 'error';
            return;
        }

        // already watching
        if (this.watchId !== null) return;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const selected = this.SelectedTech;
                const payload = {
                    techId: this.participantData.tecId,
                    id: this.participantId,
                    tecnologico: selected?.name ?? '',
                    ...this.participantData,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // send via socket
                this.SocketService.emit('location:update', payload);

                this.ngZone.run(() => {
                    this.lastPosition = { lat: payload.lat, lng: payload.lng, at: new Date().toLocaleTimeString() };
                    this.status = 'sharing';
                });
            },
            (error) =>{
                console.error('Geolocation error', error);
                this.ngZone.run(() => {
                    const wasSharing = this.status === 'sharing';
                    if (error.code === error.PERMISSION_DENIED) {
                        this.status = 'denied';
                        this.sharingRequested = false;
                    } else {
                        this.status = 'error';
                        this.sharingRequested = false;
                        // schedule retry if we were sharing before the error
                        if (wasSharing) {
                            setTimeout(() => this.startGeolocationWatch(), 3000);
                        }
                    }
                });
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 10000
            }
        );
    }

    // DETENER UBICACION
    stopSharing(){
        if (!this.isBrowser) return;
        if(this.watchId !== null){
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.SocketService.emit('location:stop', this.participantId);
        }
        this.status = 'stopped';
        this.sharingRequested = false;
    }

    private safeUuid(){
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    get SelectedTech() {
        return TECH_BY_ID.get(this.participantData.tecId) ?? null;
    }

    get isSharingActive() {
        return this.status === 'sharing' || this.status === 'reconnecting' || this.sharingRequested;
    }
}