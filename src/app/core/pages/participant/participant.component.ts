import { Component, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID } from "@angular/core";
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import Swal from 'sweetalert2';
import { SocketService } from "../../services/socket.service";
import { TECH_BY_ID, TECH_CATALOG } from "../../types/tecType";

@Component({
    selector: 'app-participant',
    templateUrl: './participant.component.html',
    standalone: true,
    imports: [CommonModule, FormsModule, NgSelectModule]
})

export class ParticipantComponent implements OnInit, OnDestroy {
    watchId: number | null = null;
    participantId = '';
    private isBrowser = false;
    isMobile = false;
    techOptions = TECH_CATALOG;

    participantData = {
        tecId: null as string | null,
        encargado: '',
        telefono: ''
    };

    // UI state
    status: 'idle' | 'sharing' | 'stopped' | 'denied' | 'reconnecting' | 'error' = 'idle';
    lastPosition: { lat: number; lng: number; at: string } | null = null;
    reconnectAttempts = 0;
    sharingRequested = false;
    showShareOverlay = false;
    hasFirstFix = false;
    lastFixAt = 0;
    private shareWatchdogId: number | null = null;

    constructor(
        private SocketService: SocketService,
        private ngZone: NgZone,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngOnInit(): void {
        if (this.isBrowser) {
            this.isMobile = window.matchMedia('(max-width: 640px)').matches;
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
            const savedTecId = this.participantData.tecId;
            if (!savedTecId || !TECH_BY_ID.get(savedTecId)) {
                this.participantData.tecId = null;
            }

            this.shareWatchdogId = window.setInterval(() => {
                if (!this.isSharingActive || this.lastFixAt === 0) return;
                const staleMs = Date.now() - this.lastFixAt;
                if (staleMs > 30000) {
                    this.ngZone.run(() => {
                        this.status = 'error';
                        this.sharingRequested = false;
                        this.showShareOverlay = false;
                        this.hasFirstFix = false;
                        this.lastFixAt = 0;
                    });
                }
            }, 10000);
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
        this.ngZone.run(() => {
            void Swal.fire({
                icon: 'success',
                title: 'Datos guardados',
                toast: true,
                position: 'top-end',
                background: '#0f172a',
                color: '#e2e8f0',
                iconColor: '#34d399',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false
            });
        });
    }

    // Public: iniciar compartir (maneja permisos y reconexión)
    async startSharing() {
        if (!this.isBrowser) return;
        if (this.isSharingActive) return;
        if (!this.isFormValid) return;
        this.sharingRequested = true;
        this.showShareOverlay = this.isMobile;
        this.hasFirstFix = false;
        this.lastFixAt = 0;
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

    private startGeolocationWatch() {
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
                    this.lastFixAt = Date.now();
                    this.hasFirstFix = true;
                    this.lastPosition = { lat: payload.lat, lng: payload.lng, at: new Date().toLocaleTimeString() };
                    this.status = 'sharing';
                });
            },
            (error) => {
                console.error('Geolocation error', error);
                this.ngZone.run(() => {
                    const wasSharing = this.status === 'sharing';
                    if (error.code === error.PERMISSION_DENIED) {
                        this.status = 'denied';
                        this.sharingRequested = false;
                        this.showShareOverlay = false;
                        this.hasFirstFix = false;
                    } else {
                        this.status = 'error';
                        this.sharingRequested = false;
                        this.showShareOverlay = false;
                        this.hasFirstFix = false;
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
    stopSharing() {
        if (!this.isBrowser) return;
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.SocketService.emit('location:stop', this.participantId);
        }
        this.status = 'stopped';
        this.sharingRequested = false;
        this.showShareOverlay = false;
        this.hasFirstFix = false;
        this.lastFixAt = 0;
    }

    ngOnDestroy(): void {
        if (this.shareWatchdogId !== null) {
            window.clearInterval(this.shareWatchdogId);
            this.shareWatchdogId = null;
        }
    }

    private safeUuid() {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    get SelectedTech() {
        const tecId = this.participantData.tecId;
        return tecId ? TECH_BY_ID.get(tecId) ?? null: null;
    }

    get isSharingActive() {
        return this.status === 'sharing' || this.status === 'reconnecting' || this.sharingRequested;
    }

    shortTechLabel(name: string) {
        const cleaned = name
            .replace(/^INSTITUTO\s+TECNOL[ÓO]GICO\s+DE\s+/i, 'Tec. ')
            .replace(/^INSTITUTO\s+TECNOL[ÓO]GICO\s+/i, 'Tec. ')
            .replace(/^TECNOL[ÓO]GICO\s+SUPERIOR\s+DE\s+/i, 'TS. ')
            .replace(/^TECNOL[ÓO]GICO\s+DE\s+/i, 'Tec. ')
            .trim();
        if (cleaned.length <= 24) return cleaned;
        return `${cleaned.slice(0, 21).trim()}...`;
    }

    get isFormValid() {
        return !!this.participantData.tecId
            && this.participantData.encargado.trim().length > 0
            && this.participantData.telefono.trim().length > 0;
    }
}