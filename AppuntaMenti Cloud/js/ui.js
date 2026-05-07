/**
 * UI Rendering & DOM Manipulation
 */

import * as state from './state.js';
import * as utils from './utils.js';
import { ImageDB } from './db.js';
import { syncToCloud } from './sync.js';

// --- HELPERS ---

export function showToast(msg, type = 'ok') {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'bell' ? ' bell' : '');
  t.textContent = msg;
  area.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 230);
  }, 3200);
}

export function playBeep() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.value = 920;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .45);
    osc.start();
    osc.stop(ctx.currentTime + .45);
  } catch (e) {}
}

// --- RENDERING ---

export function renderAll() {
  renderTopbar();
  renderDateStrip();
  renderAptList();
  renderMiniCal();
  renderUpcoming();
  populateClientSelect();
  populateBUSelect();
  renderBusinessUnits();
  renderRecurringShifts();
}

export function renderTopbar() {
  const d = new Date(state.selectedDate + 'T00:00:00');
  const isToday = state.selectedDate === utils.isoToday();
  const weekdayEl = document.getElementById('topbar-weekday');
  const titleEl = document.getElementById('topbar-title');

  if (weekdayEl) {
    weekdayEl.textContent = isToday ? 'OGGI — ' + utils.MONTHS[d.getMonth()] + ' ' + d.getFullYear() : utils.MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  if (titleEl) {
    titleEl.textContent = isToday ? 'Oggi' : utils.WEEKDAYS_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + utils.MONTHS[d.getMonth()];
  }
}

export function renderDateStrip() {
  const strip = document.getElementById('date-strip');
  if (!strip) return;
  strip.innerHTML = '';

  const sel = new Date(state.selectedDate + 'T00:00:00');
  const year = sel.getFullYear();
  const month = sel.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(year, month, i);
    const ds = d.toISOString().slice(0, 10);
    const chip = document.createElement('button');
    chip.className = 'date-chip' + (ds === state.selectedDate ? ' active' : '');
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', ds === state.selectedDate ? 'true' : 'false');
    chip.setAttribute('aria-label', utils.formatDisplayDate(ds));

    if (state.appointments.some(a => a.date === ds)) chip.classList.add('has-apt');

    chip.innerHTML = `<span class="d-num">${d.getDate()}</span><span class="d-name">${DAYS[d.getDay()]}</span>`;
    chip.addEventListener('click', () => {
      state.setSelectedDate(ds);
      renderAll();
    });
    strip.appendChild(chip);

    if (ds === state.selectedDate) {
      setTimeout(() => chip.scrollIntoView({ inline: 'center', behavior: 'smooth' }), 60);
    }
  }
}

export function renderAptList() {
  const area = document.getElementById('content-area');
  if (!area) return;

  let filtered = state.appointments.filter(a => a.date === state.selectedDate);

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = state.appointments.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.note && a.note.toLowerCase().includes(q))
    );
  }

  filtered.sort((a, b) => a.time.localeCompare(b.time));

  if (!filtered.length) {
    area.innerHTML = `<div class="empty-state">
      <div class="empty-icon-wrap">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M9 4v5M15 4v5"/>
        </svg>
      </div>
      <h3>Nessun appuntamento</h3>
      <p>Niente in programma per questo giorno. Aggiungine uno!</p>
      <button class="btn-add" id="empty-state-add-btn" style="box-shadow:var(--glow)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Aggiungi</span>
      </button>
    </div>`;
    document.getElementById('empty-state-add-btn')?.addEventListener('click', () => openAptModal());
    return;
  }

  const groups = { mattina: [], pomeriggio: [], sera: [] };
  filtered.forEach(a => {
    const h = parseInt(a.time.split(':')[0]);
    if (h < 12) groups.mattina.push(a);
    else if (h < 18) groups.pomeriggio.push(a);
    else groups.sera.push(a);
  });

  const labels = { mattina: 'Mattina', pomeriggio: 'Pomeriggio', sera: 'Sera / Notte' };
  let html = '';
  ['mattina', 'pomeriggio', 'sera'].forEach(period => {
    if (!groups[period].length) return;
    html += `<div class="time-group">
      <div class="time-group-label">${labels[period]}</div>
      <div class="timeline">`;
    groups[period].forEach((apt, idx) => {
      const lo = utils.paletteLo(apt.color);
      const client = state.clients.find(c => c.id === apt.clientId);
      const clientName = client ? client.name : null;

      html += `<div class="apt-card" tabindex="0" role="article" data-id="${apt.id}" aria-label="${utils.esc(apt.title)} alle ${apt.time}" style="animation-delay:${idx * 40}ms">
        <div class="apt-bar" style="background:${apt.color}"></div>
        <div class="apt-time-col">
          <span class="apt-time-start">${apt.time}</span>
        </div>
        <div class="apt-body">
          <div class="apt-title-text">
            ${clientName ? `<span style="color:var(--accent); font-weight:800">${utils.esc(clientName)}</span> • ` : ''}
            ${utils.esc(apt.title)}
          </div>
          ${apt.note ? `<div class="apt-note-text">${utils.esc(apt.note)}</div>` : ''}
          <div class="apt-tags">
            <span class="apt-badge" style="background:${lo};color:${apt.color}">${apt.duration ? apt.duration + ' min' : '60 min'}</span>
            ${apt.treatment ? `<span class="apt-badge" style="background:rgba(255,255,255,.05);color:var(--text-3)" title="${utils.esc(apt.treatment)}">📄 Scheda</span>` : ''}
            ${apt.notifMin ? `<span class="apt-badge" style="background:rgba(255,255,255,.06);color:var(--text-3)">🔔 ${utils.notifLabel(apt.notifMin)}</span>` : ''}
          </div>
        </div>
        <div class="apt-actions-col">
          <button class="apt-action-btn wa-btn" data-action="whatsapp" aria-label="WhatsApp" title="Invia Promemoria">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.4 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
          </button>
          <button class="apt-action-btn" data-action="edit" aria-label="Modifica" title="Modifica">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="apt-action-btn danger" data-action="delete" aria-label="Elimina" title="Elimina">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  });
  area.innerHTML = html;

  // Delegation
  area.querySelectorAll('.apt-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', () => openAptModal(state.appointments.find(a => a.id === id)));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openAptModal(state.appointments.find(a => a.id === id)); });
    
    card.querySelectorAll('.apt-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'delete') deleteApt(id);
        else if (action === 'edit') openAptModal(state.appointments.find(a => a.id === id));
        else if (action === 'whatsapp') sendWhatsAppReminder(id);
      });
    });
  });
}

export function renderMiniCal() {
  const root = document.getElementById('mini-cal-grid-list');
  if (!root) return;
  root.innerHTML = '';
  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();
  for (let m = 0; m < 3; m++) {
    let targetMonth = startMonth + m;
    let targetYear = startYear;
    if (targetMonth > 11) {
      targetYear += Math.floor(targetMonth / 12);
      targetMonth = targetMonth % 12;
    }
    renderMonthBlock(root, targetYear, targetMonth);
  }
}

function renderMonthBlock(parent, year, month) {
  const block = document.createElement('div');
  block.className = 'mini-cal-month-block';

  const header = document.createElement('div');
  header.className = 'mini-cal-month-header';
  header.textContent = utils.MONTHS[month] + ' ' + year;
  block.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'mini-cal-grid';

  utils.DAYS_SHORT.forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-dow'; el.textContent = d[0];
    grid.appendChild(el);
  });

  const first = new Date(year, month, 1);
  let dow = first.getDay(); dow = dow === 0 ? 6 : dow - 1;
  const total = new Date(year, month + 1, 0).getDate();
  const todayStr = utils.isoToday();

  for (let i = 0; i < dow; i++) {
    const space = document.createElement('div'); grid.appendChild(space);
  }

  for (let i = 1; i <= total; i++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const el = document.createElement('button');
    el.className = 'cal-day' + (ds === todayStr ? ' today' : '') + (ds === state.selectedDate ? ' selected' : '');
    if (state.appointments.some(a => a.date === ds)) el.classList.add('has-apt');
    el.textContent = i;
    el.addEventListener('click', () => {
      state.setSelectedDate(ds);
      renderAll();
    });
    grid.appendChild(el);
  }

  block.appendChild(grid);
  parent.appendChild(block);
}

export function renderUpcoming() {
  const ul = document.getElementById('upcoming-list');
  if (!ul) return;
  const today = utils.isoToday();
  const upcoming = state.appointments
    .filter(a => a.date >= today)
    .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
    .slice(0, 6);
  if (!upcoming.length) { ul.innerHTML = `<div class="empty-upcoming">Nessun prossimo evento</div>`; return; }
  ul.innerHTML = upcoming.map(a => `
    <div class="upcoming-item" tabindex="0" data-date="${a.date}" aria-label="${utils.esc(a.title)}">
      <div class="upcoming-dot" style="background:${a.color};box-shadow:0 0 6px ${a.color}66"></div>
      <div class="upcoming-info">
        <div class="upcoming-title">${utils.esc(a.title)}</div>
        <div class="upcoming-meta">${a.date === today ? 'Oggi' : utils.formatShortDate(a.date)} · ${a.time}</div>
      </div>
    </div>`).join('');
  
  ul.querySelectorAll('.upcoming-item').forEach(item => {
    item.addEventListener('click', () => {
      state.setSelectedDate(item.dataset.date);
      renderAll();
    });
  });
}

export function populateClientSelect() {
  const select = document.getElementById('f-client');
  if (!select) return;
  const val = select.value;
  select.innerHTML = '<option value="">Nessuno (Occasionale)</option>' +
    state.clients.map(c => `<option value="${c.id}">${utils.esc(c.name)}</option>`).join('');
  select.value = val;
}

export function populateBUSelect() {
  const select = document.getElementById('fBusinessUnit');
  if (!select) return;
  const val = select.value;
  select.innerHTML = state.businessUnits.map(bu => `<option value="${bu.id}">${utils.esc(bu.name)}</option>`).join('');
  if (!val && state.businessUnits.length) select.value = state.businessUnits[0].id;
  else select.value = val;
}

export function onBUChange() {
  const buId = document.getElementById('fBusinessUnit').value;
  const bu = state.businessUnits.find(b => b.id === buId);
  if (bu) {
    // Set default color based on BU
    const swatches = document.getElementById('swatch-row');
    if (swatches) {
      const target = Array.from(swatches.querySelectorAll('.swatch')).find(s => s.dataset.hex.toLowerCase() === bu.color.toLowerCase());
      if (target) target.click();
    }
    // Set default title if empty
    const titleInput = document.getElementById('f-title');
    if (titleInput && !titleInput.value) {
      titleInput.value = bu.type === 'shift' ? 'Turno ' + bu.name : bu.name;
    }
  }
}

export function renderBusinessUnits() {
  const container = document.getElementById('buList');
  if (!container) return;
  container.innerHTML = state.businessUnits.map(bu => `
    <div class="bu-card">
      <div class="bu-dot" style="background:${bu.color}"></div>
      <div class="bu-info">
        <div class="bu-name">${utils.esc(bu.name)}</div>
        <div class="bu-type">${bu.type === 'shift' ? 'Turno Fisso' : 'Servizio/Lezione'} • €${bu.rate}/${bu.type === 'shift' ? 'turno' : 'ora'}</div>
      </div>
      <button class="icon-btn" onclick="editBU('${bu.id}')">✎</button>
    </div>
  `).join('');
}

export function renderRecurringShifts() {
  const container = document.getElementById('recurringList');
  if (!container) return;
  if (!state.recurringShifts.length) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-dim); padding:10px;">Nessun turno ricorrente impostato.</div>';
    return;
  }
  container.innerHTML = state.recurringShifts.map(s => {
    const bu = state.businessUnits.find(b => b.id === s.buId);
    return `
      <div class="bu-card">
        <div class="bu-dot" style="background:${bu ? bu.color : '#888'}"></div>
        <div class="bu-info">
          <div class="bu-name">${utils.WEEKDAYS_FULL[s.day]}</div>
          <div class="bu-type">${bu ? bu.name : 'Attività'} • ${s.start} - ${s.end}</div>
        </div>
        <button class="icon-btn danger" onclick="removeRecurringShift('${s.id}')">✕</button>
      </div>
    `;
  }).join('');
}

// --- MODALS ---

export function openAptModal(apt = null) {
  state.setEditingId(apt ? apt.id : null);
  populateClientSelect();
  document.getElementById('modal-title').textContent = apt ? 'Modifica Appuntamento' : 'Nuovo Appuntamento';
  document.getElementById('f-title').value = apt ? apt.title : '';
  document.getElementById('f-client').value = apt ? apt.clientId || '' : '';
  document.getElementById('f-date').value = apt ? apt.date : state.selectedDate;
  document.getElementById('f-time').value = apt ? apt.time : '';
  document.getElementById('f-duration').value = apt ? String(apt.duration || 60) : '60';
  document.getElementById('f-note').value = apt ? apt.note : '';
  document.getElementById('f-treatment').value = apt ? apt.treatment || '' : '';
  document.getElementById('f-products').value = apt ? apt.products || '' : '';
  document.getElementById('f-notif').value = apt ? String(apt.notifMin) : '15';
  
  buildSwatches(apt ? apt.color : utils.PALETTE[0].hex);
  renderCustomFieldsInModal('apt', 'apt-custom-fields-container', apt ? apt.customFields : {});

  if (state.editingId) renderGallery(state.editingId);
  else document.getElementById('apt-gallery').innerHTML = '';

  document.getElementById('apt-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('f-title').focus(), 60);
}

export function buildSwatches(selColor) {
  const row = document.getElementById('swatch-row');
  if (!row) return;
  row.innerHTML = '';
  utils.PALETTE.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (p.hex === selColor ? ' sel' : '');
    btn.style.background = p.hex;
    btn.style.boxShadow = `0 0 10px ${p.hex}66`;
    btn.setAttribute('aria-label', 'Colore ' + p.name);
    btn.dataset.hex = p.hex;
    btn.addEventListener('click', () => {
      row.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
      btn.classList.add('sel');
    });
    row.appendChild(btn);
  });
}

export function closeAptModal() {
  document.getElementById('apt-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

export function renderCustomFieldsInModal(type, targetContainerId, existingData = {}) {
  const container = document.getElementById(targetContainerId);
  if (!container) return;

  const defs = type === 'apt' ? state.customFieldsApt : state.customFieldsClient;
  if (defs.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="divider-v"></div>
    <div class="form-row fields-row-wrap">
      ${defs.map(f => `
        <div class="form-group">
          <label class="form-label">${f.label}</label>
          <input class="form-input custom-field-input" data-id="${f.id}" type="${f.type}" 
                 value="${existingData[f.id] || ''}" placeholder="...">
        </div>
      `).join('')}
    </div>
  `;
}

export function getCustomFieldValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return {};
  const values = {};
  container.querySelectorAll('.custom-field-input').forEach(input => {
    values[input.dataset.id] = input.value;
  });
  return values;
}

// --- GALLERY ---

export async function renderGallery(refId) {
  const container = document.getElementById('apt-gallery');
  if (!container) return;
  container.innerHTML = '<div class="stats-sub">Caricamento galleria...</div>';

  try {
    const images = await ImageDB.getByRef(refId);
    if (!images.length) {
      container.innerHTML = '<div class="stats-sub" style="grid-column:1/-1; opacity:0.6; font-size:0.7rem">Nessuna foto caricata per questo lavoro.</div>';
      return;
    }
    container.innerHTML = images.map(img => `
      <div class="gallery-item" data-id="${img.id}">
        <img src="${img.data}" alt="Foto Lavoro">
        <button class="del-btn" data-id="${img.id}">×</button>
      </div>
    `).join('');
    
    container.querySelectorAll('.gallery-item').forEach(item => {
      const id = item.dataset.id;
      item.addEventListener('click', () => {
        const img = images.find(i => i.id == id);
        if(img) window.open(img.data, '_blank');
      });
      item.querySelector('.del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteGalleryItem(id, refId);
      });
    });
  } catch (e) { container.innerHTML = 'Errore IDB'; }
}

async function deleteGalleryItem(id, refId) {
  if (confirm('Eliminare questa foto?')) {
    await ImageDB.delete(id);
    renderGallery(refId);
    showToast('Foto eliminata');
  }
}

// --- CLIENTS ---

export function renderClients() {
  const container = document.getElementById('clients-list-area');
  if (!container) return;
  const term = document.getElementById('client-search-input').value.toLowerCase();

  const filtered = state.clients.filter(c =>
    c.name.toLowerCase().includes(term) ||
    (c.phone && c.phone.replace(/\s/g, '').includes(term.replace(/\s/g, '')))
  ).sort((a, b) => a.name.localeCompare(b.name));

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Nessun cliente trovato</h3><p>Cerca o aggiungi il tuo primo cliente.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="client-card">
      <div class="client-info-main">
        <div class="client-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="client-name">${utils.esc(c.name)}</div>
          <div class="client-meta">
            ${c.phone ? `<span>📞 ${utils.esc(c.phone)}</span>` : '<span style="opacity:0.4;font-size:0.75rem">Nessun telefono</span>'}
          </div>
        </div>
      </div>
      <div class="client-actions">
        <button class="icon-btn" data-action="history" data-id="${c.id}" title="Storico Trattamenti e Scheda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
        <button class="icon-btn" data-action="edit" data-id="${c.id}" title="Modifica Anagrafica"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="icon-btn danger" data-action="delete" data-id="${c.id}" title="Elimina Profilo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.client-card').forEach(card => {
    card.querySelectorAll('.icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if(action === 'history') openClientHistory(id);
        else if(action === 'edit') openEditClient(id);
        else if(action === 'delete') deleteClient(id);
      });
    });
  });
}

export function openEditClient(id) {
  const c = state.clients.find(cl => cl.id === id);
  if (!c) return;
  state.setEditingClientId(id); // I need to add this to state
  document.getElementById('client-modal-title').textContent = 'Modifica Cliente';
  document.getElementById('c-name').value = c.name;
  document.getElementById('c-phone').value = c.phone || '';
  document.getElementById('c-email').value = c.email || '';
  document.getElementById('c-notes').value = c.notes || '';

  renderCustomFieldsInModal('client', 'client-custom-fields-container', c.customFields || {});

  document.getElementById('client-overlay').classList.add('open');
}

export function deleteClient(id) {
  if (!confirm('Eliminare questo cliente? Gli appuntamenti rimarranno ma non saranno più collegati.')) return;
  state.saveClients(state.clients.filter(c => c.id !== id));
  renderClients();
  populateClientSelect();
  showToast('Cliente rimosso');
}

export function openClientHistory(id) {
  const c = state.clients.find(cl => cl.id === id);
  if (!c) return;
  const history = state.appointments.filter(a => a.clientId === id).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const historyHtml = `
    <div class="modal modal-md">
      <div class="modal-header">
        <h2 class="modal-title">Scheda: ${utils.esc(c.name)}</h2>
        <button class="modal-close" id="history-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="history-meta">📞 ${utils.esc(c.phone || 'N/D')} • ✉️ ${utils.esc(c.email || 'N/D')}</div>
      <div style="margin-bottom: var(--s4);">
        <button class="btn-save settings-btn-save-sm" id="export-pdf-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Esporta PDF Scheda
        </button>
      </div>
      <div class="history-notes-box">
        <strong>Note Generali:</strong><br>${utils.esc(c.notes || 'Nessuna nota.')}
      </div>
      <h3 class="history-section-title">Cronologia Trattamenti</h3>
      <div class="history-scroll-area">
        ${history.length === 0 ? '<p class="empty-state-text">Nessun trattamento registrato finora.</p>' :
    history.map(a => `
          <div class="history-item" style="border-left:2px solid ${a.color}">
            <div class="history-item-date">${utils.formatDisplayDate(a.date)} - ${a.time}</div>
            <div class="history-item-title">${utils.esc(a.title)}</div>
            ${a.treatment ? `<div class="history-item-detail"><strong>Lavoro:</strong> ${utils.esc(a.treatment)}</div>` : ''}
            ${a.products ? `<div class="history-item-detail"><strong>Prodotti:</strong> ${utils.esc(a.products)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const div = document.createElement('div');
  div.id = 'history-overlay';
  div.className = 'overlay open';
  div.innerHTML = historyHtml;
  document.body.appendChild(div);
  
  document.getElementById('history-close').addEventListener('click', () => div.remove());
  document.getElementById('export-pdf-btn').addEventListener('click', () => generateClientPDF(id));
}

export function generateClientPDF(clientId) {
  const c = state.clients.find(cl => cl.id === clientId);
  if (!c) return;
  const history = state.appointments.filter(a => a.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setTextColor(159, 122, 234);
  doc.text(state.appName, 14, 20);

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`Scheda Cliente: ${c.name}`, 14, 32);

  doc.setFontSize(10);
  doc.text(`Tel: ${c.phone || 'N/D'} | Email: ${c.email || 'N/D'}`, 14, 40);
  doc.text(`Note: ${c.notes || 'Nessuna.'}`, 14, 46);

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 50, 196, 50);

  const tableData = history.map(a => [
    utils.formatDisplayDate(a.date),
    a.time,
    a.title,
    a.treatment || '-',
    a.products || '-'
  ]);

  doc.autoTable({
    startY: 55,
    head: [['Data', 'Ora', 'Servizio', 'Trattamento', 'Prodotti']],
    body: tableData,
    headStyles: { fillColor: [159, 122, 234] },
    theme: 'grid'
  });

  doc.save(`Scheda_${c.name.replace(/\s+/g, '_')}.pdf`);
  showToast('📄 PDF generato con successo');
}

// --- STATS ---

export function renderStats() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthApts = state.appointments.filter(a => {
    const d = new Date(a.date + 'T00:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const lastMonthApts = state.appointments.filter(a => {
    const d = new Date(a.date + 'T00:00:00');
    const lm = currentMonth === 0 ? 11 : currentMonth - 1;
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  document.getElementById('stat-month-count').textContent = monthApts.length;
  document.getElementById('stat-client-count').textContent = state.clients.length;

  const services = {};
  monthApts.forEach(a => services[a.title] = (services[a.title] || 0) + 1);
  let topS = '-'; let max = 0;
  for (let s in services) { if (services[s] > max) { max = services[s]; topS = s; } }
  document.getElementById('stat-top-service').textContent = topS;

  const diff = monthApts.length - lastMonthApts.length;
  const sub = document.getElementById('stat-month-diff'); // I'll add this ID to HTML
  if (sub) {
    if (diff > 0) sub.innerHTML = `<span style="color:var(--green)">↑ +${diff}</span> rispetto al mese scorso`;
    else if (diff < 0) sub.innerHTML = `<span style="color:var(--red)">↓ ${diff}</span> rispetto al mese scorso`;
    else sub.textContent = 'Stesso volume del mese scorso';
  }

  renderStatsCharts(monthApts);
  renderEarningsByActivity();
}

export function renderEarningsByActivity() {
  const area = document.getElementById('earningsSection');
  if (!area) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Calculate from appointments
  const buEarnings = {};
  state.businessUnits.forEach(bu => buEarnings[bu.id] = 0);

  state.appointments.forEach(a => {
    const d = new Date(a.date + 'T00:00:00');
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const buId = a.businessUnitId || 'default';
      const price = parseFloat(a.price) || 0;
      if (buEarnings[buId] !== undefined) buEarnings[buId] += price;
      else buEarnings['other'] = (buEarnings['other'] || 0) + price;
    }
  });

  // 2. Calculate from recurring shifts (Pizzeria example)
  state.recurringShifts.forEach(s => {
    const bu = state.businessUnits.find(b => b.id === s.buId);
    if (!bu) return;
    
    // Count occurrences of day s.day in current month
    const count = utils.countDaysInMonth(currentYear, currentMonth, s.day);
    const earn = count * (bu.rate || 0);
    buEarnings[s.buId] = (buEarnings[s.buId] || 0) + earn;
  });

  let html = `
    <div class="section-header-wrap">
      <div class="section-accent"></div>
      <div class="report-section-title m-0">Riepilogo Guadagni per Attività</div>
    </div>
    <div class="earnings-grid">
  `;

  for (let buId in buEarnings) {
    const bu = state.businessUnits.find(b => b.id === buId);
    const name = bu ? bu.name : 'Altro';
    const total = buEarnings[buId];
    if (total === 0 && buId === 'other') continue;

    html += `
      <div class="earn-item">
        <div class="earn-val">€${total.toFixed(2)}</div>
        <div class="earn-label">${utils.esc(name)}</div>
      </div>
    `;
  }

  html += `</div>`;
  area.innerHTML = html;
}

export function renderStatsCharts(apts) {
  const container = document.getElementById('stats-charts-container');
  if (!container) return;

  const days = {};
  apts.forEach(a => {
    const day = new Date(a.date + 'T00:00:00').getDate();
    days[day] = (days[day] || 0) + 1;
  });

  const maxVal = Math.max(...Object.values(days), 5);
  const chartHeight = 120;
  const chartWidth = container.clientWidth - 40 || 300;
  const barWidth = Math.max(chartWidth / 31 - 4, 4);

  let svg = `<svg width="100%" height="${chartHeight + 40}" viewBox="0 0 ${chartWidth} ${chartHeight + 40}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" />
        <stop offset="100%" stop-color="var(--accent-lo)" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

  for (let i = 1; i <= 31; i++) {
    const val = days[i] || 0;
    const h = (val / maxVal) * chartHeight;
    const x = (i - 1) * (chartWidth / 31);
    svg += `<rect x="${x}" y="${chartHeight - h + 10}" width="${barWidth}" height="${h}" rx="2" fill="url(#barGrad)" filter="url(#glow)" opacity="${val ? 1 : 0.1}">
      <title>Giorno ${i}: ${val} appuntamenti</title>
    </rect>
    <text x="${x + barWidth / 2}" y="${chartHeight + 30}" font-size="8" fill="var(--text-3)" text-anchor="middle">${i % 5 === 0 || i === 1 ? i : ''}</text>`;
  }
  svg += `</svg>`;
  container.innerHTML = `<div class="stats-card" style="grid-column: 1/-1">
    <div class="stats-label">Attività Mensile (Appuntamenti per Giorno)</div>
    <div style="margin-top: 20px">${svg}</div>
  </div>`;
}

// --- BRANDING ---

export function updateBranding() {
  const { appName, appLogo, logoType } = state;
  const savedLogo = localStorage.getItem('apt_app_logo');
  
  document.title = appName;
  const brandNameEl = document.getElementById('app-brand-name');
  if (brandNameEl) brandNameEl.textContent = appName;

  const settingsInput = document.getElementById('f-app-name');
  if (settingsInput) settingsInput.value = appName;

  const logoIcon = document.getElementById('default-logo-icon');
  const logoImg = document.getElementById('app-logo-img');
  const btnRemoveLogo = document.getElementById('btn-remove-logo');
  const logoMark = document.querySelector('.logo-mark');
  const logoContainer = document.querySelector('.logo');

  if (savedLogo) {
    if (logoIcon) logoIcon.classList.add('hidden');
    if (logoImg) {
      logoImg.src = savedLogo;
      logoImg.classList.remove('hidden');
    }
    if (btnRemoveLogo) btnRemoveLogo.classList.remove('hidden');
    
    if (logoType === 'hr') {
      logoMark?.classList.add('logo-mark-hr');
      logoContainer?.classList.add('logo-hr-wrap');
    } else {
      logoMark?.classList.remove('logo-mark-hr');
      logoContainer?.classList.remove('logo-hr-wrap');
    }
  } else {
    if (logoIcon) logoIcon.classList.remove('hidden');
    if (logoImg) {
      logoImg.src = '';
      logoImg.classList.add('hidden');
    }
    if (btnRemoveLogo) btnRemoveLogo.classList.add('hidden');
    logoMark?.classList.remove('logo-mark-hr');
    logoContainer?.classList.remove('logo-hr-wrap');
  }

  document.querySelectorAll('.logo-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === logoType);
  });
}

// --- HELPERS (Cont.) ---

function deleteApt(id) {
  if(!confirm('Eliminare questo appuntamento?')) return;
  // I need a way to cancel notifications, which I'll move to app.js or a separate manager
  state.saveApts(state.appointments.filter(a => a.id !== id));
  renderAll();
  showToast('🗑️ Appuntamento eliminato');
}

function sendWhatsAppReminder(aptId) {
  const apt = state.appointments.find(a => a.id === aptId);
  if (!apt) return;
  const client = state.clients.find(c => c.id === apt.clientId);
  if (!client || !client.phone) {
    showToast('Inserisci un numero di telefono per inviare promemoria!', 'error');
    return;
  }
  const cleanPhone = client.phone.replace(/\D/g, '');
  const dateStr = new Date(apt.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const msg = `Ciao ${client.name}! 🌟 Ti ricordo il tuo appuntamento per "${apt.title}" il giorno ${dateStr} alle ore ${apt.time} presso ${state.appName}. A presto! 👋`;
  window.open(`https://wa.me/${cleanPhone.startsWith('39') ? '' : '39'}${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}
