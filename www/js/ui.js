import { $, esc, createDefaultPorts } from './config.js';
import { saveCto, deleteCtoFromDb } from './supabase.js';

export function renderPanel(ctos, selectedId, stateManager, userRole, currentSession) {
  const c = ctos[selectedId];
  const p = $('panel');

  if (!p) return;

  if (!c) {
    p.style.display = 'none';
    return;
  }

  const isMaster = userRole === 'maestro';

  p.style.display = 'block';
  p.innerHTML = `
    <div class="row">
      <input id="n" value="${esc(c.nombre)}" ${isMaster ? '' : 'disabled'}>
      <select id="sp" ${isMaster ? '' : 'disabled'}>
        <option value="8">Splitter 1:8</option>
        <option value="16">Splitter 1:16</option>
      </select>
    </div>
    <div class="row">
      <input id="fib" placeholder="Fibra / hilo de entrada" value="${esc(c.fibra)}" ${isMaster ? '' : 'disabled'}>
      <input id="nt" placeholder="Notas (poste, dirección)" value="${esc(c.notas)}" ${isMaster ? '' : 'disabled'}>
    </div>
    <div id="ps"></div>
    <div class="row">
      ${isMaster ? '<button id="mv">Mover</button>' : ''}
      <button id="cl">Cerrar</button>
      ${isMaster ? '<button id="rm" style="color:#d6402f">Borrar</button>' : ''}
    </div>
  `;

  if ($('sp'))$('sp').value = String((c.ports || []).length);

  (c.ports || []).forEach(pt => {
    const d = document.createElement('div');
    d.className = 'port ' + pt.estado;
    d.innerHTML = `
      <b>${pt.n}</b>
      <select>
        <option value="libre">Libre</option>
        <option value="ocupado">Ocupado</option>
      </select>
      <input placeholder="Cliente / ONT" value="${esc(pt.cliente)}">
    `;

    const [, s, cl] = d.children;
    s.value = pt.estado;

    const updateAudit = () => {
      pt.tecnico = currentSession?.user || 'desconocido';
      pt.fecha = new Date().toISOString();
    };

    s.onchange = () => {
      pt.estado = s.value;
      d.className = 'port ' + pt.estado;
      updateAudit();
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
      updateAudit();
      saveCto(c);
      stateManager.refreshUI();
    };

    if ($('ps'))$('ps').appendChild(d);
  });

  if (isMaster) {
    if ($('n'))$('n').onchange = e => { c.nombre = e.target.value; saveCto(c); };
    if ($('fib'))$('fib').onchange = e => { c.fibra = e.target.value; saveCto(c); };
    if ($('nt'))$('nt').onchange = e => { c.notas = e.target.value; saveCto(c); };

    if ($('sp')) {$('sp').onchange = e => {
        const n = +e.target.value;
        if (n < c.ports.length && c.ports.slice(n).some(x => x.cliente) && !confirm('Hay clientes en los puertos que se quitan. ¿Seguir?')) {
          e.target.value = c.ports.length;
          return;
        }
        c.ports = n > c.ports.length ? c.ports.concat(createDefaultPorts(n).slice(c.ports.length)) : c.ports.slice(0, n);
        saveCto(c);
        stateManager.refreshUI();
      };
    }

    if ($('mv')) {$('mv').onclick = () => {
        stateManager.setMode('move');
        $('mv').textContent = 'Tocá el mapa…';
        $('mv').classList.add('on');
      };
    }

    if ($('rm')) {$('rm').onclick = async () => {
        if (!confirm('¿Borrar esta CTO?')) return;
        const ok = await deleteCtoFromDb(selectedId);
        if (ok) {
          delete ctos[selectedId];
          stateManager.setSelected(null);
        }
      };
    }
  }

  if ($('cl')) {$('cl').onclick = () => {
      stateManager.setSelected(null);
    };
  }
}

export function renderInstallations(ctos, fromStr, toStr) {
  const container = $('inst-list');
  if (!container) return;

  const fromDate = fromStr ? new Date(fromStr + 'T00:00:00') : new Date(0);
  const toDate = toStr ? new Date(toStr + 'T23:59:59') : new Date();

  const logs = [];

  Object.values(ctos).forEach(c => {
    (c.ports || []).forEach(pt => {
      if (pt.cliente && pt.fecha) {
        const d = new Date(pt.fecha);
        if (d >= fromDate && d <= toDate) {
          logs.push({
            fecha: d,
            cto: c.nombre,
            puerto: pt.n,
            cliente: pt.cliente,
            tecnico: pt.tecnico || 'desconocido'
          });
        }
      }
    });
  });

  logs.sort((a, b) => b.fecha - a.fecha);

  if (logs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:20px;">No se encontraron instalaciones en este período.</p>';
    return;
  }

  let html = `
    <table class="inst-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>CTO</th>
          <th>P.</th>
          <th>Cliente</th>
          <th>Técnico</th>
        </tr>
      </thead>
      <tbody>
  `;

  logs.forEach(l => {
    const fStr = `${l.fecha.getDate().toString().padStart(2,'0')}/${(l.fecha.getMonth()+1).toString().padStart(2,'0')} ${l.fecha.getHours().toString().padStart(2,'0')}:${l.fecha.getMinutes().toString().padStart(2,'0')}`;
    const tecClean = l.tecnico.replace('@sidisi.com', '');
    html += `
      <tr>
        <td>${fStr}</td>
        <td><b>${esc(l.cto)}</b></td>
        <td>${l.puerto}</td>
        <td>${esc(l.cliente)}</td>
        <td><span style="text-transform:capitalize; color:#0b6bcb; font-weight:600;">${esc(tecClean)}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}
