import { $, esc } from './config.js';
import { saveCto } from './supabase.js';
import { contarLibres } from './ui.js';

let ctosRef = {};
let sessionRef = null;
let onSavedRef = null;

// Puerto libre: sin estado 'ocupado' y sin cliente cargado (misma regla que contarLibres)
const puertosLibres = c => (c?.ports || []).filter(pt => pt.estado !== 'ocupado' && !pt.cliente);

function mostrarError(msg) {
  const el = $('ni-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function ocultarError() {
  const el = $('ni-error');
  if (el) el.style.display = 'none';
}

function cargarPuertos() {
  const c = ctosRef[$('ni-cto')?.value];
  const sel = $('ni-port');
  if (!sel) return;

  const libres = puertosLibres(c);
  sel.innerHTML = libres.length
    ? libres.map(pt => `<option value="${pt.n}">Puerto ${pt.n}</option>`).join('')
    : '<option value="">Sin puertos libres</option>';
}

function cargarCtos(preferidaId) {
  const sel = $('ni-cto');
  if (!sel) return;

  const lista = Object.values(ctosRef)
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

  sel.innerHTML = lista.length
    ? lista.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} (${contarLibres(c)} libres)</option>`).join('')
    : '<option value="">No hay CTOs cargadas</option>';

  // Preselecciona la CTO que está abierta en el mapa, si existe
  if (preferidaId && ctosRef[preferidaId]) sel.value = preferidaId;
  cargarPuertos();
}

function cerrar() {
  const modal = $('new-inst-modal');
  if (modal) modal.style.display = 'none';
}

export function openNewInstallation(ctos, session, onSaved, preferidaId = null) {
  ctosRef = ctos || {};
  sessionRef = session;
  onSavedRef = onSaved;

  const client = $('ni-client');
  if (client) client.value = '';
  ocultarError();
  cargarCtos(preferidaId);

  const modal = $('new-inst-modal');
  if (modal) modal.style.display = 'flex';
  client?.focus();
}

async function guardarInstalacion() {
  ocultarError();

  const cto = ctosRef[$('ni-cto')?.value];
  const n = Number($('ni-port')?.value);
  const cliente = ($('ni-client')?.value || '').trim();

  if (!cto) return mostrarError('Elegí una CTO.');
  if (!cliente) return mostrarError('Ingresá el nombre del cliente o el ID de la ONT.');

  const pt = (cto.ports || []).find(p => p.n === n);
  if (!pt || pt.estado === 'ocupado' || pt.cliente) {
    cargarPuertos();
    return mostrarError('Ese puerto ya no está libre. Elegí otro.');
  }

  // Guardamos el estado previo por si el guardado falla
  const previo = { estado: pt.estado, cliente: pt.cliente, tecnico: pt.tecnico, fecha: pt.fecha };

  pt.estado = 'ocupado';
  pt.cliente = cliente;
  pt.tecnico = sessionRef?.user || 'desconocido';
  pt.fecha = new Date().toISOString();

  const btn = $('ni-save');
  if (btn) btn.disabled = true;
  const ok = await saveCto(cto);
  if (btn) btn.disabled = false;

  if (!ok) {
    Object.assign(pt, previo);
    cargarPuertos();
    return mostrarError('No se pudo guardar la instalación. Revisá la conexión e intentá de nuevo.');
  }

  cerrar();
  onSavedRef?.();
}

export function initNewInstallation() {
  const cto = $('ni-cto');
  if (cto) cto.onchange = cargarPuertos;

  const save = $('ni-save');
  if (save) save.onclick = guardarInstalacion;

  const cancel = $('ni-cancel');
  if (cancel) cancel.onclick = cerrar;

  const close = $('ni-close');
  if (close) close.onclick = cerrar;
}
