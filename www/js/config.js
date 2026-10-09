export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

export const SUPABASE_URL = 'https://qcsvnjzhmovpcushgeyv.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc3ZuanpobW92cGN1c2hnZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDUwNDQsImV4cCI6MjEwNzEyMTA0NH0.LEj1TnngvyTBZXWga5-Ipm2KIrZ5C3EBnLXWKEl15VM';

export function createDefaultPorts(n) {
  return Array.from({ length: n }, (_, i) => ({ n: i + 1, estado: 'libre', cliente: '', potencia: '' }));
}
