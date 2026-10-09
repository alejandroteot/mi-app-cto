import { $, createDefaultPorts } from './config.js';
import { fetchCtos, insertCto, saveCto } from './supabase.js';
import { initMap, toggleSatelliteLayer, renderMarkers } from './map.js';
import { renderPanel, exportCsv } from './ui.js';

let ctos = {};
let sel = null;
let mode = null;

const stateManager = {
  refreshUI() {
    renderMarkers(ctos, sel, onSelectCto);
    renderPanel(ctos, sel, stateManager);
  },
  setSelected(id) {
    sel = id;
    this.refreshUI();
  },
  setMode(m) {
    mode = m;
  }
};

function onSelectCto(id) {
  sel = id;
  stateManager.refreshUI();
}

async function handleMapClick(e) {
  if (!mode) return;

  if (mode === 'move' && ctos[sel]) {
    ctos[sel].lat = e.lngLat.lat;
    ctos[sel].lng = e.lngLat.lng;
    await saveCto(ctos[sel]);
  } else if (mode === 'add') {
    const c = {
      nombre: 'CTO ' + (Object.keys(ctos).length + 1),
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
      fibra: '',
      notas: '',
      ports: createDefaultPorts(8)
    };
    const data = await insertCto(c);
    if (data) {
      ctos[data.id] = data;
      sel = data.id;
    }
  }

  mode = null;
  if ($('add')) $('add').classList.remove('on');
  stateManager.refreshUI();
}

async function start() {
  initMap(handleMapClick);

  if ($('add')) {
    $('add').onclick = () => {
      mode = mode === 'add' ? null : 'add';
      $('add').classList.toggle('on', !!mode);
    };
  }

  if ($('sat')) $('sat').onclick = toggleSatelliteLayer;
  if ($('csv')) $('csv').onclick = () => exportCsv(ctos);

  const data = await fetchCtos();
  data.forEach(c => ctos[c.id] = c);
  stateManager.refreshUI();
}

start();
