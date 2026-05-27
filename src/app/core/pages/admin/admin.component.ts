import { AfterViewInit, ApplicationRef, ChangeDetectorRef, Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from "@angular/core";
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { SocketService } from "../../services/socket.service";
import { TECH_BY_ID } from "../../types/tecType";

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    standalone: true,
    imports: [CommonModule]
})

export class AdminComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;

    participants: any = {};
    participantsList: any[] = [];
    participantsCount = 0;
    lastPositions: Record<string, { lat: number; lng: number; at: number }> = {};
    private L: any;
    private map?: any;
    private markers: Record<string, any> = {};
    private trails: Record<string, Array<[number, number]>> = {};
    private polylines: Record<string, any> = {};
    private activeTrailId: string | null = null;
    private hasAutoCentered = false;

    constructor(
        private socketService: SocketService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
        private appRef: ApplicationRef,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit(): void {
        // Enter admin room early
        this.socketService.emit('admin:join');
    }

    async ngAfterViewInit(): Promise<void> {
        // only run map code in the browser (avoid SSR window errors)
        if (!isPlatformBrowser(this.platformId)) return;

        // load Leaflet dynamically
        const leafletModule: any = await import('leaflet');
        const L = leafletModule?.default ?? leafletModule;
        this.L = L;

        // use divIcon to avoid external image requests for default markers

        // initialize Leaflet map
        // start centered on Mexico
        this.map = L.map(this.mapContainer.nativeElement).setView([23.6345, -102.5528], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        // initial list
        this.socketService.listen('participant:list', (data: any) => {
            this.ngZone.run(() => {
                this.participants = data || {};
                this.syncMarkersWithParticipants();
                this.updateParticipantCounters();
                if (!this.hasAutoCentered && this.participantsCount > 0) {
                    this.updateBounds(true);
                    this.hasAutoCentered = true;
                }
                this.cdr.detectChanges();
                this.appRef.tick();
            });
        });

        // real-time update
        this.socketService.listen('participant:updated', (participant: any) => {
            const lat = Number(participant.lat);
            const lng = Number(participant.lng);
            const speedKmh = this.estimateSpeedKmh(participant.id, lat, lng);
            this.ngZone.run(() => {
                this.participants = {
                    ...this.participants,
                    [participant.id]: {
                        ...participant,
                        speedKmh
                    }
                };
                this.upsertMarker(participant);
                this.appendTrailPoint(participant);
                if (this.activeTrailId === participant.id) {
                    this.renderTrail(participant.id);
                }
                this.updateParticipantCounters();
                if (!this.hasAutoCentered && this.participantsCount > 0) {
                    this.updateBounds(true);
                    this.hasAutoCentered = true;
                }
                this.cdr.detectChanges();
                this.appRef.tick();
            });
        });

        // participant removed
        this.socketService.listen('participant:removed', (id: string) => {
            this.ngZone.run(() => {
                const next = { ...this.participants };
                delete next[id];
                this.participants = next;
                this.removeMarker(id);
                this.clearTrail(id);
                this.updateParticipantCounters();
                this.cdr.detectChanges();
                this.appRef.tick();
            });
        });
    }

    ngOnDestroy(): void {
        try {
            Object.values(this.markers).forEach(m => m.remove());
            Object.values(this.polylines).forEach(p => p.remove());
            this.map?.remove();
        } catch (e) {
            // ignore
        }
    }

    getTechById(id: string | null | undefined) {
        return id ? TECH_BY_ID.get(id) : null;
    }

    private upsertMarker(participant: any) {
        if (!participant || participant.lat == null || participant.lng == null) return;

        const lat = Number(participant.lat);
        const lng = Number(participant.lng);

        if (this.markers[participant.id]) {
            this.markers[participant.id].setLatLng([lat, lng]);
            this.markers[participant.id].setPopupContent(this.markerPopupContent(participant));
            this.markers[participant.id].setIcon(this.buildMarkerIcon(participant));
        } else if (this.map) {
            const marker = this.L.marker([lat, lng], {
                icon: this.buildMarkerIcon(participant)
            });
            marker.bindPopup(this.markerPopupContent(participant));
            marker.on('click', () => this.renderTrail(participant.id));
            marker.addTo(this.map);
            this.markers[participant.id] = marker;
        }
        this.updateParticipantCounters();
        this.cdr.detectChanges();
    }

    private buildMarkerIcon(participant: any) {
        const label = (participant?.tecnologico || participant?.encargado || '').toString().slice(0, 2).toUpperCase();
        const tech = this.getTechById(participant?.techId);
        const logoUrl = tech?.logoURL || '';
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="42" height="48" viewBox="0 0 42 48">
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35" />
                    </filter>
                </defs>
                <path filter="url(#shadow)" d="M21 1C12.2 1 5 8.2 5 17c0 11.4 12.8 25.6 15.1 28.1.5.6 1.4.6 1.9 0C24.2 42.6 37 28.4 37 17 37 8.2 29.8 1 21 1z" fill="#e11d48" stroke="#ffffff" stroke-width="2"/>
                <circle cx="21" cy="17" r="9" fill="#ffffff"/>
                <text x="21" y="20.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#e11d48">${label}</text>
            </svg>
        `;
        // Previous marker HTML (kept for easy restore)
        // const logoHtml = logoUrl
        //     ? `<img src="${logoUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:999px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />`
        //     : '';
        // const html = `
        //     <div style="position:relative;width:48px;height:48px;">
        //         <!-- Pin SVG removed; uncomment the block above to restore -->
        //         <div style="position:absolute;left:0;top:0;width:48px;height:48px;border-radius:999px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        //             ${logoHtml}
        //             <span style="display:${logoUrl ? 'none' : 'flex'};width:48px;height:48px;align-items:center;justify-content:center;font-family:Arial, sans-serif;font-size:11px;font-weight:700;color:#e11d48;">${label}</span>
        //         </div>
        //     </div>
        // `;

        const html = logoUrl
            ? `<img src="${logoUrl}" style="width:42px;height:42px;border-radius:999px;object-fit:cover;" />`
            : `<div style="width:42px;height:48px;">${svg}</div>`;

        return this.L.divIcon({
            html,
            className: '',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
    }

    private markerPopupContent(p: any) {
        const techName = this.getTechById(p?.techId)?.name;
        const name = techName || p.tecnologico || p.encargado || p.id;
        const updated = this.formatTime(p.updatedAt);
        const encargado = p.encargado ? `<div>Encargado: ${p.encargado}</div>` : '';
        const telefono = p.telefono ? `<div>Teléfono: ${p.telefono}</div>` : '';
        return `<div><strong>${name}</strong>${encargado}${telefono}<div>Lat: ${p.lat} — Lng: ${p.lng}</div><div>Actualización: ${updated}</div></div>`;
    }

    private removeMarker(id: string) {
        const m = this.markers[id];
        if (m) {
            m.remove();
            delete this.markers[id];
        }
        this.updateParticipantCounters();
        this.cdr.detectChanges();
    }

    private appendTrailPoint(participant: any) {
        if (!participant || participant.lat == null || participant.lng == null) return;
        const lat = Number(participant.lat);
        const lng = Number(participant.lng);
        const list = this.trails[participant.id] || [];
        list.push([lat, lng]);
        this.trails[participant.id] = list;
    }

    private renderTrail(id: string) {
        if (!this.map || !this.L) return;
        this.activeTrailId = id;

        Object.keys(this.polylines).forEach(key => {
            if (key !== id) {
                this.polylines[key].remove();
                delete this.polylines[key];
            }
        });

        const points = this.trails[id] || [];
        if (points.length < 2) return;

        if (this.polylines[id]) {
            this.polylines[id].setLatLngs(points);
        } else {
            this.polylines[id] = this.L.polyline(points, {
                color: '#1f6feb',
                weight: 4,
                opacity: 0.9
            }).addTo(this.map);
        }
    }

    private clearTrail(id: string) {
        delete this.trails[id];
        if (this.polylines[id]) {
            this.polylines[id].remove();
            delete this.polylines[id];
        }
        if (this.activeTrailId === id) this.activeTrailId = null;
    }

    recenterMap() {
        this.updateBounds(true);
    }

    private updateBounds(force = false) {
        if (!this.map || !this.L) return;
        const ids = Object.keys(this.markers);
        if (ids.length === 0) return;

        if (!force) return;

        if (ids.length === 1) {
            const marker = this.markers[ids[0]];
            const pos = marker.getLatLng();
            this.map.setView(pos, 15, { animate: true });
            return;
        }

        const bounds = this.L.latLngBounds(ids.map(id => this.markers[id].getLatLng()));
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }

    private syncMarkersWithParticipants() {
        // add/update markers
        for (const id of Object.keys(this.participants || {})) {
            this.upsertMarker(this.participants[id]);
            this.appendTrailPoint(this.participants[id]);
        }

        // remove markers that no longer exist
        for (const id of Object.keys(this.markers)) {
            if (!this.participants[id]) this.removeMarker(id);
        }
        this.updateParticipantCounters();
    }

    private updateParticipantCounters() {
        this.participantsList = Object.values(this.participants || {});
        const fromParticipants = this.participantsList.length;
        const fromMarkers = Object.keys(this.markers).length;
        this.participantsCount = Math.max(fromParticipants, fromMarkers);
    }

    private toRoad(v: number) {
        return (v * Math.PI) / 180;
    }

    private haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
        const R = 6371000;
        const dLat = this.toRoad(b.lat - a.lat);
        const dLng = this.toRoad(b.lng - a.lng);
        const lat1 = this.toRoad(a.lat);
        const lat2 = this.toRoad(b.lat);

        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(h));
    }

    private estimateSpeedKmh(id: string, lat: number, lng:number) {
        const now = Date.now();
        const prev = this.lastPositions[id];
        this.lastPositions[id] = { lat, lng, at: now};

        if (!prev) return null;

        const d = this.haversineMeters({lat: prev.lat, lng: prev.lng}, {lat, lng});
        const dt = Math.max(1, (now - prev.at) / 1000);
        const kmh = (d / dt) * 3.6;

        return Math.round(kmh * 10) / 10;

    }

    formatTime(value: string | number | Date | null | undefined) {
        if (!value) return '—';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return new Intl.DateTimeFormat('es-MX', {
            timeStyle: 'short'
        }).format(date);
    }

    focusParticipant(id: string) {
        if(!this.map || !this.markers[id]) return;

        const marker = this.markers[id];
        const pos = marker.getLatLng();

        this.map.setView(pos, 16, {animate: true});
        this.renderTrail(id);
        //marker.openPopup();
    }

    lastWordTech(tec: string | undefined) {
        return tec?.split(' ').pop();
    }
}
