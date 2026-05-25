import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from "@angular/core";
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { SocketService } from "../../services/socket.service";

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
    private L: any;
    private map?: any;
    private markers: Record<string, any> = {};
    private trails: Record<string, Array<[number, number]>> = {};
    private polylines: Record<string, any> = {};
    private activeTrailId: string | null = null;

    constructor(
        private socketService: SocketService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef,
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
        this.map = L.map(this.mapContainer.nativeElement).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        // initial list
        this.socketService.listen('participant:list', (data: any) => {
            this.ngZone.run(() => {
                this.participants = data || {};
                this.syncMarkersWithParticipants();
                this.updateBounds();
                this.updateParticipantCounters();
                this.cdr.detectChanges();
            });
        });

        // real-time update
        this.socketService.listen('participant:updated', (participant: any) => {
            this.ngZone.run(() => {
                this.participants = {
                    ...this.participants,
                    [participant.id]: participant
                };
                this.upsertMarker(participant);
                this.appendTrailPoint(participant);
                if (this.activeTrailId === participant.id) {
                    this.renderTrail(participant.id);
                }
                this.updateBounds();
                this.updateParticipantCounters();
                this.cdr.detectChanges();
            });
        });

        // participant removed
        this.socketService.listen('participant:removed', (id: string)=>{
            this.ngZone.run(() => {
                const next = { ...this.participants };
                delete next[id];
                this.participants = next;
                this.removeMarker(id);
                this.clearTrail(id);
                this.updateBounds();
                this.updateParticipantCounters();
                this.cdr.detectChanges();
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

    private upsertMarker(participant: any){
        if(!participant || participant.lat == null || participant.lng == null) return;

        const lat = Number(participant.lat);
        const lng = Number(participant.lng);

        if(this.markers[participant.id]){
            this.markers[participant.id].setLatLng([lat, lng]);
            this.markers[participant.id].setPopupContent(this.markerPopupContent(participant));
        } else if(this.map){
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

    private buildMarkerIcon(participant: any){
        const label = (participant?.tecnologico || participant?.encargado || '').toString().slice(0, 2).toUpperCase();
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
        const html = `<div style="width:42px;height:48px">${svg}</div>`;

        return this.L.divIcon({
            html,
            className: '',
            iconSize: [42, 48],
            iconAnchor: [21, 46]
        });
    }

    private markerPopupContent(p: any){
        const name = p.tecnologico || p.encargado || p.id;
        const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
        const encargado = p.encargado ? `<div>Encargado: ${p.encargado}</div>` : '';
        const telefono = p.telefono ? `<div>Teléfono: ${p.telefono}</div>` : '';
        return `<div><strong>${name}</strong>${encargado}${telefono}<div>Lat: ${p.lat} — Lng: ${p.lng}</div><div>${updated}</div></div>`;
    }

    private removeMarker(id: string){
        const m = this.markers[id];
        if(m){
            m.remove();
            delete this.markers[id];
        }
        this.updateParticipantCounters();
        this.cdr.detectChanges();
    }

    private appendTrailPoint(participant: any){
        if(!participant || participant.lat == null || participant.lng == null) return;
        const lat = Number(participant.lat);
        const lng = Number(participant.lng);
        const list = this.trails[participant.id] || [];
        list.push([lat, lng]);
        this.trails[participant.id] = list;
    }

    private renderTrail(id: string){
        if(!this.map || !this.L) return;
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

    private clearTrail(id: string){
        delete this.trails[id];
        if (this.polylines[id]) {
            this.polylines[id].remove();
            delete this.polylines[id];
        }
        if (this.activeTrailId === id) this.activeTrailId = null;
    }

    private updateBounds(){
        if(!this.map || !this.L) return;
        const ids = Object.keys(this.markers);
        if (ids.length === 0) return;

        if (ids.length === 1) {
            const marker = this.markers[ids[0]];
            const pos = marker.getLatLng();
            this.map.setView(pos, 15, { animate: true });
            return;
        }

        const bounds = this.L.latLngBounds(ids.map(id => this.markers[id].getLatLng()));
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }

    private syncMarkersWithParticipants(){
        // add/update markers
        for(const id of Object.keys(this.participants || {})){
            this.upsertMarker(this.participants[id]);
            this.appendTrailPoint(this.participants[id]);
        }

        // remove markers that no longer exist
        for(const id of Object.keys(this.markers)){
            if(!this.participants[id]) this.removeMarker(id);
        }
        this.updateParticipantCounters();
    }

    private updateParticipantCounters(){
        this.participantsList = Object.values(this.participants || {});
        const fromParticipants = this.participantsList.length;
        const fromMarkers = Object.keys(this.markers).length;
        this.participantsCount = Math.max(fromParticipants, fromMarkers);
    }
}
