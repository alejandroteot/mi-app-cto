import { $, esc, createDefaultPorts } from './config.js';
import { saveCto, deleteCtoFromDb } from './supabase.js';

export function renderPanel(ctos, selectedId, stateManager) {
  const c = ctos[selectedId];
  const p = $('panel');

  if (!c) {
    p.style.display = 'none';
    return;
  }

  p.style.display = 'block';
  p.innerHTML = `
    <div class="row">
      <input id="n" value="${esc(c.nombre)}">
      <select id="sp">
        <option value="8">Splitter 1:8</option>
        <option value="16">Splitter 1:16</option>
      </select>
    </div>
    <div class="row">
      <input id="fib" placeholder="Fibra / hilo de entrada" value="${esc(c.fibra)}">
      <input id="nt" placeholder="Notas (poste, dirección)" value="${esc(c.notas)}">
    </div>
    <div id="ps"></div>
    <div class="row">
      <button id="mv">Mover</button>
      <button id="cl">Cerrar</button>
      <button id="rm" style="color:#d6402f">Borrar</button>
    </div>
  `;

  $('sp').value = String(c.ports.length);

  c.ports.forEach(pt => {
    const d = document.createElement('div');
    d.className = 'port ' + pt.estado;
    d.innerHTML = `
      <b>${pt.n}</b>
      <select>
        <option value="libre">Libre</option>
        <option value="ocupado">Ocupado</option>
      </select>
      <input placeholder="Cliente / ONT" value="${esc(pt.cliente)}">
      <input placeholder="dBm" value="${esc(pt.potencia)}">
    `;

    const [, s, cl, pw] = d.children;
    s.value = pt.estado;

    s.onchange = () => {
      pt.estado = s.value;
      d.className = 'port ' + pt.estado;
      saveCto(c);
      stateManager.refreshUI();
    };

    cl.onchange = () => {
      pt.cliente = cl.value;
      if (cl.value && pt.estado === 'libre') {
        pt.estado = 'ocupado';
        s.value = 'ocupado';
        d.className = 'port ocupado';
      }
      saveCto(c);
      stateManager.refreshUI();
    };

    pw.onchange = () => {
      pt.potencia = pw.value;
      saveCto(c);
    };

    $('ps').appendChild(d);
  });

  $('n').onchange = e => { c.nombre = e.target.value; saveCto(c); };
  $('fib').onchange = e => { c.fibra = e.target.value; saveCto(c); };$('nt').onchange = e => { c.notas = e.target.value; saveCto(c); };

  $('sp').onchange = e => {
    const n = +e.target.value;
    if (n < c.ports.length && c.ports.slice(n).some(x => x.cliente) && !confirm('Hay clientes en los puertos que se quitan. ¿Seguir?')) {
      e.target.value = c.ports.length;
      return;
    }
    c.ports = n > c.ports.length ? c.ports.concat(createDefaultPorts(n).slice(c.ports.length)) : c.ports.slice(0, n);
    saveCto(c);
    stateManager.refreshUI();
  };

  $('mv').onclick = () => {
    stateManager.setMode('move');
    $('mv').textContent = 'Tocá el mapa…';
    $('mv').classList.add('on');
  };

  $('cl').onclick = () => {
    stateManager.setSelected(null);
  };

  $('rm').onclick = async () => {
    if (!confirm('¿Borrar esta CTO?')) return;
    const ok = await deleteCtoFromDb(selectedId);
    if (ok) {
      delete ctos[selectedId];
      stateManager.setSelected(null);
    }
  };
}

export function exportCsv(ctos) {
  let t = 'CTO,Puerto,Estado,Cliente,dBm,Fibra,Notas,Lat,Lng\n';
  Object.values(ctos).forEach(c => c.ports.forEach(p => {
    t += [c.nombre, p.n, p.estado, p.cliente, p.potencia, c.fibra, c.notas, c.lat, c.lng]
      .map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"')
      .join(',') + '\n';
  }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' }));
  a.download = 'cto-puertos.csv';
  a.click();
}
