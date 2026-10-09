import { $, createDefaultPorts } from './config.js';
import { fetchCtos, insertCto, saveCto, loginUser, getCurrentSession, logoutUser } from './supabase.js';
import { initMap, renderMarkers } from './map.js';
import { renderPanel } from './ui.js';

let ctos = {};
let sel = null;
let mode = null;
let currentSession = null;

const stateManager = {
  refreshUI() {
    renderMarkers(ctos, sel, onSelectCto, currentSession?.role);
    renderPanel(ctos, sel, stateManager, currentSession?.role);
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
  if (!mode || currentSession?.role !== 'maestro') return;

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
  if ($('add'))$('add').classList.remove('on');
  stateManager.refreshUI();
}

async function initApp() {
  if ($('login-screen'))$('login-screen').style.display = 'none';
  if ($('hd'))$('hd').style.display = 'flex';
  if ($('map'))$('map').style.display = 'block';

  if ($('user-role-badge'))$('user-role-badge').textContent = currentSession?.role || '';

  if (currentSession?.role === 'maestro') {
    if ($('add')) {
      $('add').style.display = 'inline-block';$('add').onclick = () => {
        mode = mode === 'add' ? null : 'add';
        $('add').classList.toggle('on', !!mode);
      };
    }
  } else {
    if ($('add'))$('add').style.display = 'none';
  }

  initMap(handleMapClick);

  const data = await fetchCtos();
  data.forEach(c => { if (c?.id) ctos[c.id] = c; });
  stateManager.refreshUI();
}

function setupAuth() {
  const session = getCurrentSession();
  if (session) {
    currentSession = session;
    initApp();
  } else {
    if ($('login-screen'))$('login-screen').style.display = 'flex';
    if ($('hd'))$('hd').style.display = 'none';
    if ($('map'))$('map').style.display = 'none';
  }

  if ($('login-form')) {$('login-form').onsubmit = async e => {
      e.preventDefault();
      const u = $('login-user')?.value || '';
      const p = $('login-pass')?.value || '';
      if ($('login-error'))$('login-error').style.display = 'none';

      const res = await loginUser(u, p);
      if (res.ok) {
        currentSession = res.session;
        initApp();
      } else {
        if ($('login-error')) {$('login-error').textContent = res.message;
          $('login-error').style.display = 'block';
        }
      }
    };
  }

  if ($('logout-btn')) {$('logout-btn').onclick = async () => {
      await logoutUser();
      location.reload();
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuth);
} else {
  setupAuth();
}
