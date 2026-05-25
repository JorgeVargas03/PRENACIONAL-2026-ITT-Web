import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from "@angular/core";
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
    private L: any;
    private map?: any;
    private markers: Record<string, any> = {};

    constructor(private socketService: SocketService, @Inject(PLATFORM_ID) private platformId: Object) { }

    ngOnInit(): void {
        // Enter admin room early
        this.socketService.emit('admin:join');
    }

    async ngAfterViewInit(): Promise<void> {
        // only run map code in the browser (avoid SSR window errors)
        if (!isPlatformBrowser(this.platformId)) return;

        // load Leaflet dynamically
        const L = await import('leaflet');
        this.L = L;

        // ensure default marker icons load (use CDN paths)
        (L as any).Icon.Default.mergeOptions({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
        });

        // initialize Leaflet map
        this.map = L.map(this.mapContainer.nativeElement).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        // initial list
        this.socketService.listen('participant:list', (data: any) => {
            this.participants = data || {};
            this.syncMarkersWithParticipants();
        });

        // real-time update
        this.socketService.listen('participant:updated', (participant: any) => {
            this.participants[participant.id] = participant;
            this.upsertMarker(participant);
        });

        // participant removed
        this.socketService.listen('participant:removed', (id: string)=>{
            delete this.participants[id];
            this.removeMarker(id);
        });
    }

    ngOnDestroy(): void {
        try {
            Object.values(this.markers).forEach(m => m.remove());
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
            const marker = this.L.marker([lat, lng]);
            marker.bindPopup(this.markerPopupContent(participant));
            marker.addTo(this.map);
            this.markers[participant.id] = marker;
        }
    }

    private markerPopupContent(p: any){
        const name = p.tecnologico || p.encargado || p.id;
        const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
        return `<div><strong>${name}</strong><br/>Lat: ${p.lat} — Lng: ${p.lng}<br/>${updated}</div>`;
    }

    private removeMarker(id: string){
        const m = this.markers[id];
        if(m){
            m.remove();
            delete this.markers[id];
        }
    }

    private syncMarkersWithParticipants(){
        // add/update markers
        for(const id of Object.keys(this.participants || {})){
            this.upsertMarker(this.participants[id]);
        }

        // remove markers that no longer exist
        for(const id of Object.keys(this.markers)){
            if(!this.participants[id]) this.removeMarker(id);
        }
    }
}
