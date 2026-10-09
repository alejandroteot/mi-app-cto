import { saveCto } from './supabase.js';

let map;
let markers = {};

export function initMap(onMapClick) {
  const osm = { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' };
  const sat = { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18, attribution: 'Esri' };

  map = new maplibregl.Map({
    container: 'map',
    center: [-67.80, -37.88],
    zoom: 14,
    minZoom: 10,
    maxZoom: 20,
    renderWorldCopies: false,
    style: {
      version: 8,
      sources: { osm, sat },
      layers: [
        { id: 'osm', type: 'raster', source: 'osm' },
        { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } }
      ]
    }
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }));

  map.on('click', onMapClick);

  return map;
}

export function toggleSatelliteLayer() {
  const on = map.getLayoutProperty('sat', 'visibility') === 'none';
  map.setLayoutProperty('sat', 'visibility', on ? 'visible' : 'none');
}

export function renderMarkers(ctos, selectedId, onSelectCto) {
  Object.values(markers).forEach(m => m.remove());
  markers = {};

  Object.values(ctos).forEach(c => {
    const libres = c.ports.filter(p => p.estado === 'libre').length;
    const el = document.createElement('div');
    el.className = 'pin';
    el.textContent = libres;
    el.style.background = c.id === selectedId ? '#0b6bcb' : (libres ? '#1a9d55' : '#d6402f');

    el.onclick = e => {
      e.stopPropagation();
      onSelectCto(c.id);
    };

    const mk = new maplibregl.Marker({ element: el, draggable: c.id === selectedId })
      .setLngLat([c.lng, c.lat])
      .addTo(map);

    mk.on('dragend', async () => {
      const p = mk.getLngLat();
      c.lat = p.lat;
      c.lng = p.lng;
      await saveCto(c);
    });

    markers[c.id] = mk;
  });
}
