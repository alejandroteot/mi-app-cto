import { contarLibres, estadoCto, COLOR_VERDE, COLOR_AMARILLO, COLOR_ROJO } from './ui.js';

// Escapa texto para HTML y XML (se usa en ambos sentidos en la descripción)
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

// KML usa color en formato aabbggrr (no rgb)
const hexToKml = hex => 'ff' + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);

const ESTILOS = [
  { id: 'cto-verde', estado: 'verde', color: COLOR_VERDE, etiqueta: 'Verde' },
  { id: 'cto-amarillo', estado: 'amarillo', color: COLOR_AMARILLO, etiqueta: 'Amarillo' },
  { id: 'cto-rojo', estado: 'rojo', color: COLOR_ROJO, etiqueta: 'Rojo' },
];

const estiloPara = estado => ESTILOS.find(e => e.estado === estado);

function fechaLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function descripcion(c, libres, total, estado) {
  const partes = [
    `<b>${esc(c.nombre)}</b>`,
    `Puertos libres: ${libres} de ${total}`,
    `Ocupados: ${total - libres}`,
    `Estado: ${estiloPara(estado).etiqueta}`,
  ];
  if (c.fibra) partes.push(`Fibra: ${esc(c.fibra)}`);
  if (c.fibra2) partes.push(`Fibra 2: ${esc(c.fibra2)}`);
  if (c.notas) partes.push(`Notas: ${esc(c.notas)}`);
  return partes.join('<br>');
}

// Devuelve { kml, incluidas, omitidas }. Las CTOs sin coordenadas se omiten.
export function construirKml(ctos) {
  const lista = Object.values(ctos).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const conCoords = lista.filter(c => c.lat != null && c.lng != null);
  const omitidas = lista.length - conCoords.length;

  const estilos = ESTILOS.map(e => `
    <Style id="${e.id}">
      <IconStyle>
        <color>${hexToKml(e.color)}</color>
        <scale>1.3</scale>
        <Icon><href>https://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.9</scale></LabelStyle>
    </Style>`).join('');

  const marcas = conCoords.map(c => {
    const total = (c.ports || []).length;
    const libres = contarLibres(c);
    const estado = estadoCto(c);
    const html = descripcion(c, libres, total, estado);
    return `
    <Placemark>
      <name>${esc(c.nombre)} · ${libres} libres</name>
      <description>${esc(html)}</description>
      <styleUrl>#${estiloPara(estado).id}</styleUrl>
      <Point><coordinates>${Number(c.lng)},${Number(c.lat)},0</coordinates></Point>
    </Placemark>`;
  }).join('');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SIDISI - CTOs ${fechaLocal()}</name>${estilos}
    <Folder>
      <name>CTOs</name>${marcas}
    </Folder>
  </Document>
</kml>
`;
  return { kml, incluidas: conCoords.length, omitidas };
}

// Dentro de la app (APK) el navegador interno no guarda descargas.
// Devuelve los plugins nativos si estamos en Android/iOS, o null en el navegador.
function pluginsNativos() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const { Filesystem, Share } = cap.Plugins || {};
  return Filesystem && Share ? { Filesystem, Share } : null;
}

// Escribe el KML en la caché de la app y abre el menú de compartir del sistema
async function compartirKmlNativo({ Filesystem, Share }, nombre, kml) {
  const { uri } = await Filesystem.writeFile({
    path: nombre,
    data: kml,
    directory: 'CACHE',
    encoding: 'utf8',
  });
  await Share.share({
    title: nombre,
    dialogTitle: 'Compartir KML de SIDISI',
    files: [uri],
  });
}

// En el navegador de la PC: descarga normal del archivo
function descargarEnNavegador(nombre, kml) {
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function descargarKml(ctos) {
  const { kml, incluidas, omitidas } = construirKml(ctos);
  if (!incluidas) {
    alert('No hay CTOs con coordenadas para exportar.');
    return;
  }

  if (omitidas) {
    alert(`${omitidas} CTO(s) sin coordenadas no se incluyeron en el KML.`);
  }

  const nombre = `SIDISI_CTOs_${fechaLocal()}.kml`;
  const nativo = pluginsNativos();

  if (!nativo) {
    descargarEnNavegador(nombre, kml);
    return;
  }

  try {
    await compartirKmlNativo(nativo, nombre, kml);
  } catch (err) {
    const msg = String(err?.message || err);
    // Cerrar el menú de compartir sin elegir nada no es un error
    if (!/cancel/i.test(msg)) alert('No se pudo compartir el KML: ' + msg);
  }
}
