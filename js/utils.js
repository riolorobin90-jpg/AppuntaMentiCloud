/**
 * Constants & Utility Functions
 */

export const PALETTE = [
  { hex: '#6c63ff', lo: 'rgba(108,99,255,.15)', name: 'Viola' },
  { hex: '#34d399', lo: 'rgba(52,211,153,.15)', name: 'Verde' },
  { hex: '#f87171', lo: 'rgba(248,113,113,.15)', name: 'Rosso' },
  { hex: '#fbbf24', lo: 'rgba(251,191,36,.15)', name: 'Ambra' },
  { hex: '#60a5fa', lo: 'rgba(96,165,250,.15)', name: 'Blu' },
  { hex: '#f472b6', lo: 'rgba(244,114,182,.15)', name: 'Rosa' },
  { hex: '#2dd4bf', lo: 'rgba(45,212,191,.15)', name: 'Teal' },
  { hex: '#a78bfa', lo: 'rgba(167,139,250,.15)', name: 'Lavanda' },
];

export const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const WEEKDAYS_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export function isoToday() { 
  return new Date().toISOString().slice(0, 10); 
}

export function countDaysInMonth(year, month, dayOfWeek) {
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === dayOfWeek) count++;
  }
  return count;
}

export function esc(s) { 
  return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; 
}

export function notifLabel(m) { 
  if (!m) return ''; 
  if (m < 60) return m + 'm'; 
  if (m === 60) return '1h'; 
  if (m === 1440) return '1g'; 
  return m + 'm'; 
}

export function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(); 
  date.setHours(h, m + mins);
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

export function paletteLo(hex) { 
  return PALETTE.find(p => p.hex === hex)?.lo || 'rgba(108,99,255,.15)'; 
}

export function formatDisplayDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return WEEKDAYS_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

export function formatShortDate(ds) {
  const d = new Date(ds + 'T00:00:00');
  return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
