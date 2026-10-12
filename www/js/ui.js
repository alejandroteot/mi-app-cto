import { $, esc, createDefaultPorts } from './config.js';
import { saveCto, deleteCtoFromDb } from './supabase.js';

function parseCoordinates(value) {
  const input = value.trim();
  let lat;
  let lng;
  const decimalMatch = input.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[,;]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/)
    || input.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);

  if (decimalMatch) {
    lat = Number(decimalMatch[1]);
    lng = Number(decimalMatch[2]);
  } else {
    const hemisphereMatch = input.match(/^(\d+(?:\.\d+)?)\s*°?\s*([NS])\s*[,; ]+\s*(\d+(?:\.\d+)?)\s*°?\s*([EW])$/i);
    const dmsMatch = input.match(/^(\d{1,3})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*['′]\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″])?\s*([NS])\s*[,; ]+\s*(\d{1,3})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*['′]\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″])?\s*([EW])$/i);

    if (hemisphereMatch) {
      lat = Number(hemisphereMatch[1]) * (hemisphereMatch[2].toUpperCase() === 'S' ? -1 : 1);
      lng = Number(hemisphereMatch[3]) * (hemisphereMatch[4].toUpperCase() === 'W' ? -1 : 1);
    } else if (dmsMatch) {
      const toDecimal = (degrees, minutes, seconds, hemisphere) => {
        const mins = Number(minutes);
        const secs = Number(seconds || 0);
        if (mins >= 60 || secs >= 60) return NaN;
        const sign = hemisphere.toUpperCase() === 'S' || hemisphere.toUpperCase() === 'W' ? -1 : 1;
        return sign * (Number(degrees) + mins / 60 + secs / 3600);
      };
      lat = toDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
      lng = toDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
    } else {
      return null;
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

export function renderPanel(ctos, selectedId, stateManager, userRole, currentSession) {
  const c = ctos[selectedId];
  const p = $('panel');

  if (!p) return;

  if (!c) {
    p.style.display = 'none';
    return;
  }

  const isMaster = userRole === 'maestro';
  
  // Determinar splitter actual (soporta 1:8, 1:16, 2:16)
  const currentSplitter = c.splitter || ((c.ports || []).length === 16 ? '1:16' : '1:8');
  const is2x16 = currentSplitter === '2:16';

  p.style.display = 'block';
  p.innerHTML = `
    <div class="row">
      <input id="n" placeholder="Nombre CTO" value="${esc(c.nombre)}" ${isMaster ? '' : 'disabled'}>
      <select id="sp" ${isMaster ? '' : 'disabled'}>
        <option value="1:8" ${currentSplitter === '1:8' ? 'selected' : ''}>Splitter 1:8</option>
        <option value="1:16" ${currentSplitter === '1:16' ? 'selected' : ''}>Splitter 1:16</option>
        <option value="2:16" ${currentSplitter === '2:16' ? 'selected' : ''}>Splitter 2:16</option>
      </select>
    </div>

    <!-- Hilos de entrada de fibra -->
    <div class="row">
      <input id="fib" placeholder="${is2x16 ? 'Fibra 1 (hilo entrada)' : 'Fibra / hilo de entrada'}" value="${esc(c.fibra)}" ${isMaster ? '' : 'disabled'}>
      ${is2x16 ? `<input id="fib2" placeholder="Fibra 2 (hilo entrada)" value="${esc(c.fibra2 || '')}" ${isMaster ? '' : 'disabled'}>` : ''}
    </div>

    <!-- Notas -->
    <div class="row">
      <input id="nt" placeholder="Notas (poste, dirección)" value="${esc(c.notas)}" ${isMaster ? '' : 'disabled'}>
    </div>

    <!-- Coordenadas GPS -->
    <div class="row">
      <input id="coords" type="text" inputmode="decimal" placeholder="Coordenadas" aria-label="Coordenadas" title="Pegá las coordenadas copiadas de Google Earth" value="${c.lat == null || c.lng == null ? '' : `${c.lat}, ${c.lng}`}" ${isMaster ? '' : 'disabled'}>
    </div>

    <div id="ps"></div>

    <div class="row">
      ${isMaster ? '<button id="mv">Mover en mapa</button>' : ''}
      <button id="cl">Cerrar</button>
      ${isMaster ? '<button id="rm" style="color:#d6402f">Borrar CTO</button>' : ''}
    </div>
  `;

  // Renderizar puertos con permisos controlados
  (c.ports || []).forEach(pt => {
    const d = document.createElement('div');
    const isOccupied = pt.estado === 'ocupado' || Boolean(pt.cliente);
    d.className = 'port ' + (pt.estado || 'libre');

    // Si NO es maestro y el puerto está ocupado: el técnico no puede tocar nada
    const lockForTech = !isMaster && isOccupied;

    d.innerHTML = `
      <b>${pt.n}</b>
      <select ${lockForTech ? 'disabled' : ''}>
        ${isMaster || !isOccupied ? '<option value="libre">Libre</option>' : ''}
        <option value="ocupado">Ocupado</option>
      </select>
      <input placeholder="Cliente / ONT" value="${esc(pt.cliente)}" ${lockForTech ? 'disabled' : ''}>
    `;

    const [, s, cl] = d.children;
    s.value = pt.estado || 'libre';

    const updateAudit = () => {
      pt.tecnico = currentSession?.user || 'desconocido';
      pt.fecha = new Date().toISOString();
    };

    s.onchange = () => {
      // Bloqueo preventivo de paso a libre para técnicos
      if (!isMaster && s.value === 'libre') {
        alert('Solo el usuario Maestro puede liberar puertos.');
        s.value = 'ocupado';
        return;
      }
      pt.estado = s.value;
      d.className = 'port ' + pt.estado;
      updateAudit();
      saveCto(c);
      stateManager.refreshUI();
    };

    cl.onchange = () => {
      const val = cl.value.trim();

      // Un técnico no puede vaciar el cliente de un puerto ocupado
      if (!isMaster && pt.cliente && !val) {
        alert('Solo el usuario Maestro puede quitar clientes de un puerto.');
        cl.value = pt.cliente;
        return;
      }

      pt.cliente = val;
      if (val && pt.estado === 'libre') {
        pt.estado = 'ocupado';
        s.value = 'ocupado';
        d.className = 'port ocupado';
      }
      updateAudit();
      saveCto(c);
      stateManager.refreshUI();
    };

    if ($('ps')) $('ps').appendChild(d);
  });

  // Eventos para campos del Maestro
  if (isMaster) {
    if ($('n')) $('n').onchange = e => { c.nombre = e.target.value; saveCto(c); };
    if ($('fib')) $('fib').onchange = e => { c.fibra = e.target.value; saveCto(c); };
    if ($('fib2')) $('fib2').onchange = e => { c.fibra2 = e.target.value; saveCto(c); };
    if ($('nt')) $('nt').onchange = e => { c.notas = e.target.value; saveCto(c); };

    // Acepta coordenadas copiadas de Google Earth y actualiza la CTO y el mapa.
    if ($('coords')) $('coords').onchange = async e => {
      const coordinates = parseCoordinates(e.target.value);
      if (!coordinates) {
        alert('Coordenadas inválidas. Pegá latitud y longitud, por ejemplo: -37.88, -67.80.');
        e.target.value = c.lat == null || c.lng == null ? '' : `${c.lat}, ${c.lng}`;
        return;
      }

      c.lat = coordinates.lat;
      c.lng = coordinates.lng;
      await saveCto(c);
      stateManager.refreshUI();
    };

    // Cambio de splitter (1:8, 1:16, 2:16)
    if ($('sp')) {
      $('sp').onchange = e => {
        const val = e.target.value;
        const targetPorts = val === '1:8' ? 8 : 16;

        if (targetPorts < c.ports.length && c.ports.slice(targetPorts).some(x => x.cliente) && !confirm('Hay clientes en los puertos que se van a recortar. ¿Continuar?')) {
          e.target.value = currentSplitter;
          return;
        }

        c.splitter = val;
        c.ports = targetPorts > c.ports.length
          ? c.ports.concat(createDefaultPorts(targetPorts).slice(c.ports.length))
          : c.ports.slice(0, targetPorts);

        saveCto(c);
        stateManager.refreshUI();
      };
    }

    if ($('mv')) {
      $('mv').onclick = () => {
        stateManager.setMode('move');
        $('mv').textContent = 'Tocá el mapa…';
        $('mv').classList.add('on');
      };
    }

    if ($('rm')) {
      $('rm').onclick = async () => {
        if (!confirm('¿Borrar esta CTO?')) return;
        const ok = await deleteCtoFromDb(selectedId);
        if (ok) {
          delete ctos[selectedId];
          stateManager.setSelected(null);
        }
      };
    }
  }

  if ($('cl')) {
    $('cl').onclick = () => {
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