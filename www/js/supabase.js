import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export async function loginUser(username, password) {
  const cleanUser = username.toLowerCase().trim();
  const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@sidisi.com`;

  if (!sb) return { ok: false, message: 'No se pudo conectar con el servidor' };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { ok: false, message: 'Usuario o contraseña incorrectos' };

  const role = data.user.app_metadata?.role || 'tecnico';
  const userSession = { user: data.user.email, role };
  localStorage.setItem('sidisi_session', JSON.stringify(userSession));
  return { ok: true, session: userSession };
}

export function getCurrentSession() {
  const s = localStorage.getItem('sidisi_session');
  return s ? JSON.parse(s) : null;
}

export async function logoutUser() {
  if (sb) await sb.auth.signOut().catch(() => {});
  localStorage.removeItem('sidisi_session');
}

export async function fetchCtos() {
  if (!sb) return [];
  const { data, error } = await sb.from('ctos').select('*');
  if (error) {
    alert('Error al cargar la base de datos: ' + error.message);
    return [];
  }
  return data || [];
}

export async function insertCto(ctoData) {
  if (!sb) return null;
  const { data, error } = await sb.from('ctos').insert(ctoData).select().single();
  if (error) {
    alert(error.message);
    return null;
  }
  return data;
}

export async function saveCto(c) {
  if (!sb) return false;
  const { error } = await sb.from('ctos').update({
    nombre: c.nombre,
    lat: c.lat,
    lng: c.lng,
    fibra: c.fibra,
    notas: c.notas,
    ports: c.ports
  }).eq('id', c.id);
  if (error) {
    alert(error.message);
    return false;
  }
  return true;
}

export async function deleteCtoFromDb(id) {
  if (!sb) return false;
  const { error } = await sb.from('ctos').delete().eq('id', id);
  if (error) {
    alert(error.message);
    return false;
  }
  return true;
}
