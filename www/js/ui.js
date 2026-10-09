import { $, esc, createDefaultPorts } from './config.js';
import { saveCto, deleteCtoFromDb } from './supabase.js';

export function renderPanel(ctos, selectedId, stateManager, userRole) {
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
