import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export async function fetchCtos() {
  const { data, error } = await sb.from('ctos').select('*');
  if (error) {
    alert('Error al cargar la base de datos: ' + error.message);
    return [];
  }
  return data;
}

export async function insertCto(ctoData) {
  const { data, error } = await sb.from('ctos').insert(ctoData).select().single();
  if (error) {
    alert(error.message);
    return null;
  }
  return data;
}

export async function saveCto(c) {
  const { error } = await sb.from('ctos').update({
    nombre: c.nombre,
    lat: c.lat,
    lng: c.lng,
    fibra: c.fibra,
    notas: c.notas,
    ports: c.ports
  }).eq('id', c.id);
  if (error) alert(error.message);
}

export async function deleteCtoFromDb(id) {
  const { error } = await sb.from('ctos').delete().eq('id', id);
  if (error) {
    alert(error.message);
    return false;
  }
  return true;
}
