/**
 * Main Application Orchestrator
 */

import * as state from './state.js';
import * as utils from './utils.js';
import * as ui from './ui.js';
import { ImageDB } from './db.js';
import { syncToCloud, fetchFromCloud } from './sync.js';

// --- NOTIFICATION MANAGER ---

const scheduledNotifs = {};

function scheduleNotif(apt) {
  if (!state.notifEnabled && !state.soundEnabled) return;
  
  const ms = (new Date(apt.date + 'T' + apt.time) - Date.now()) - apt.notifMin * 60000;
  if (ms < 0) return;
  
  cancelNotif(apt.id);
  scheduledNotifs[apt.id] = setTimeout(() => fireNotif(apt), ms);
}

function cancelNotif(id) {
  if (scheduledNotifs[id]) {
    clearTimeout(scheduledNotifs[id]);
    delete scheduledNotifs[id];
  }
}

function fireNotif(apt) {
  ui.showToast(`🔔 "${apt.title}" alle ${apt.time}`, 'bell');
  if (state.soundEnabled) ui.playBeep();
  if (state.notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(state.appName, { body: `"${apt.title}" alle ${apt.time}` });
  }
}

// --- BOOTSTRAP ---

async function init() {
  // Initialize Database
  await ImageDB.init();

  // Set Theme
  document.documentElement.setAttribute('data-theme', state.currentTheme);
  ui.updateBranding();

  // Initial Render
  ui.renderAll();
  
  // Schedule existing notifications
  state.appointments.forEach(a => {
    if (a.notifMin > 0) scheduleNotif(a);
  });

  // Check Cloud Connect
  if (state.cloudConfig.url) {
    syncToCloud();
  }

  // Setup Event Listeners
  setupListeners();
}

function setupListeners() {
  // Navigation
  document.getElementById('nav-agenda')?.addEventListener('click', () => ui.showView('agenda'));
  document.getElementById('nav-clients')?.addEventListener('click', () => ui.showView('clients'));
  document.getElementById('nav-stats')?.addEventListener('click', () => ui.showView('stats'));

  // Main UI Actions
  document.getElementById('btn-add')?.addEventListener('click', () => ui.openAptModal());
  document.getElementById('modal-close')?.addEventListener('click', ui.closeAptModal);
  document.getElementById('modal-cancel')?.addEventListener('click', ui.closeAptModal);
  
  document.getElementById('apt-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'apt-overlay') ui.closeAptModal();
  });

  // Form Submission
  document.getElementById('apt-form')?.addEventListener('submit', handleAptSubmit);

  // Search
  document.getElementById('search-input')?.addEventListener('input', e => {
    state.setSearchQuery(e.target.value);
    ui.renderAll();
  });

  // Settings
  document.getElementById('settings-btn-sidebar')?.addEventListener('click', openSettings);
  document.getElementById('settings-btn-mobile')?.addEventListener('click', openSettings);
  document.getElementById('settings-close')?.addEventListener('click', closeSettings);
  document.getElementById('settings-done')?.addEventListener('click', closeSettings);
  document.getElementById('settings-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'settings-overlay') closeSettings();
  });

  // Client Mgmt
  document.getElementById('client-search-input')?.addEventListener('input', ui.renderClients);
  document.getElementById('btn-add-client')?.addEventListener('click', openNewClientModal);
  document.getElementById('client-close')?.addEventListener('click', closeClientModal);
  document.getElementById('client-form')?.addEventListener('submit', handleClientSubmit);
  document.getElementById('btn-quick-add-client')?.addEventListener('click', openQuickClientModal);

  // Notifications Modal
  document.getElementById('notif-settings-btn')?.addEventListener('click', openNotifModal);
  document.getElementById('notif-close')?.addEventListener('click', closeNotifModal);
  document.getElementById('notif-done')?.addEventListener('click', closeNotifModal);
  document.getElementById('notif-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'notif-overlay') closeNotifModal();
  });

  // Toggles
  document.getElementById('t-browser')?.addEventListener('click', toggleBrowserNotifs);
  document.getElementById('t-sound')?.addEventListener('click', toggleSound);
  document.getElementById('t-sound-set')?.addEventListener('click', toggleSound);

  // Branding & Themes
  document.getElementById('btn-save-name')?.addEventListener('click', saveBrandingName);
  document.getElementById('btn-upload-logo')?.addEventListener('click', () => document.getElementById('f-logo-upload').click());
  document.getElementById('f-logo-upload')?.addEventListener('change', handleLogoUpload);
  document.getElementById('btn-remove-logo')?.addEventListener('click', removeLogo);
  
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const t = card.dataset.theme;
      state.currentTheme = t;
      localStorage.setItem('apt_theme', t);
      document.documentElement.setAttribute('data-theme', t);
      document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === t));
    });
  });

  document.querySelectorAll('.logo-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.setLogoType(btn.dataset.type);
      ui.updateBranding();
    });
  });

  // Export / Import
  document.getElementById('btn-export')?.addEventListener('click', exportData);
  document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('f-import').click());
  document.getElementById('f-import')?.addEventListener('change', importData);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ui.closeAptModal();
      closeNotifModal();
      closeSettings();
    }
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName === 'BODY') ui.openAptModal();
  });

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(() => console.log('SW Registered'));
    });
  }
}

// --- HANDLERS ---

function handleAptSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('f-title').value.trim();
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  const duration = parseInt(document.getElementById('f-duration').value) || 60;
  
  if (!title || !date || !time) {
    ui.showToast('⚠️ Compila tutti i campi obbligatori', 'warn');
    return;
  }
  
  const endTime = utils.addMinutes(time, duration);
  const overlap = state.appointments.some(a => {
    if (a.date !== date || a.id === state.editingId) return false;
    const aStart = a.time;
    const aEnd = utils.addMinutes(a.time, a.duration || 60);
    return (time < aEnd && endTime > aStart);
  });

  if (overlap) {
    ui.showToast('⚠️ Attenzione: Sovrapposizione rilevata!', 'warn');
    if (!confirm('Questo appuntamento si sovrappone a un altro. Continuare comunque?')) return;
  }

  const color = document.getElementById('swatch-row').querySelector('.swatch.sel')?.dataset.hex || utils.PALETTE[0].hex;
  const notifMin = parseInt(document.getElementById('f-notif').value) || 0;
  const note = document.getElementById('f-note').value.trim();
  const clientId = document.getElementById('f-client').value;
  const treatment = document.getElementById('f-treatment').value.trim();
  const products = document.getElementById('f-products').value.trim();
  const customFields = ui.getCustomFieldValues('apt-custom-fields-container');
  
  if (state.editingId) {
    const idx = state.appointments.findIndex(a => a.id === state.editingId);
    if (idx > -1) {
      const businessUnitId = document.getElementById('fBusinessUnit').value;
      state.appointments[idx] = { ...state.appointments[idx], title, date, time, duration, note, color, notifMin, clientId, treatment, products, customFields, businessUnitId };
      cancelNotif(state.editingId);
      if (notifMin > 0) scheduleNotif(state.appointments[idx]);
      state.saveApts(state.appointments);
    }
    ui.showToast('✅ Appuntamento aggiornato');
  } else {
    const businessUnitId = document.getElementById('fBusinessUnit').value;
    const apt = { id: Date.now().toString(), title, date, time, duration, note, color, notifMin, clientId, treatment, products, customFields, businessUnitId };
    state.appointments.push(apt);
    if (notifMin > 0) scheduleNotif(apt);
    state.saveApts(state.appointments);
    ui.showToast('✅ Appuntamento salvato');
  }

  ui.closeAptModal();
  if (date !== state.selectedDate) {
    state.setSelectedDate(date);
    const d = new Date(date + 'T00:00:00');
    state.setCalMonth(d.getMonth());
    state.setCalYear(d.getFullYear());
  }
  ui.renderAll();
}

function handleClientSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('c-name').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const notes = document.getElementById('c-notes').value.trim();
  if(!name) return;
  
  const customFields = ui.getCustomFieldValues('client-custom-fields-container');

  if (state.editingClientId) {
    const idx = state.clients.findIndex(c => c.id === state.editingClientId);
    if(idx !== -1) state.clients[idx] = { ...state.clients[idx], name, phone, email, notes, customFields };
  } else {
    state.clients.push({ id: Date.now().toString(), name, phone, email, notes, customFields });
  }
  
  state.saveClients(state.clients);
  document.getElementById('client-overlay').classList.remove('open');
  ui.renderClients();
  ui.populateClientSelect();
  ui.showToast(state.editingClientId ? 'Cliente aggiornato' : 'Cliente salvato');
  state.setEditingClientId(null);
}

// ... more handlers (Settings, Branding, etc.) ...

function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function openNewClientModal() {
  state.setEditingClientId(null);
  document.getElementById('client-modal-title').textContent = 'Nuovo Cliente';
  document.getElementById('client-form').reset();
  ui.renderCustomFieldsInModal('client', 'client-custom-fields-container', {});
  document.getElementById('client-overlay').classList.add('open');
}
function closeClientModal() {
  document.getElementById('client-overlay').classList.remove('open');
}
function openQuickClientModal() {
  openNewClientModal();
  document.getElementById('client-overlay').style.zIndex = '2000';
}

function openNotifModal() {
  document.getElementById('notif-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeNotifModal() {
  document.getElementById('notif-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function toggleBrowserNotifs() {
  if (!state.notifEnabled) {
    if (!('Notification' in window)) {
      setNotifStatus('❌ Browser non supportato.');
      return;
    }
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      state.setNotifEnabled(true);
      document.getElementById('t-browser').classList.add('on');
      setNotifStatus('✅ Notifiche browser attivate!');
    } else {
      setNotifStatus('❌ Permesso negato.');
    }
  } else {
    state.setNotifEnabled(false);
    document.getElementById('t-browser').classList.remove('on');
    setNotifStatus('Notifiche disattivate.');
  }
}

function toggleSound() {
  state.setSoundEnabled(!state.soundEnabled);
  const t1 = document.getElementById('t-sound');
  const t2 = document.getElementById('t-sound-set');
  if(t1) t1.classList.toggle('on', state.soundEnabled);
  if(t2) t2.classList.toggle('on', state.soundEnabled);
  setNotifStatus(state.soundEnabled ? '🔊 Suono attivato' : '🔇 Suono disattivato');
}

function setNotifStatus(msg = '') {
  const el = document.getElementById('notif-status');
  if(el) el.textContent = msg;
}

function saveBrandingName() {
  const name = document.getElementById('f-app-name').value.trim();
  if (name) {
    state.setAppName(name);
    ui.updateBranding();
    ui.showToast('Branding aggiornato!');
  }
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = re => {
    localStorage.setItem('apt_app_logo', re.target.result);
    ui.updateBranding();
    ui.showToast('Logo caricato!');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  localStorage.removeItem('apt_app_logo');
  ui.updateBranding();
  ui.showToast('Logo rimosso');
}

function exportData() {
  const data = JSON.stringify(state.appointments, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `agenda_backup_${utils.isoToday()}.json`;
  a.click();
  ui.showToast('📥 Backup scaricato');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = re => {
    try {
      const imported = JSON.parse(re.target.result);
      if (Array.isArray(imported)) {
        if (confirm('Sovrascrivere tutti gli appuntamenti?')) {
          state.saveApts(imported);
          ui.renderAll();
          ui.showToast('📤 Dati importati');
        }
      }
    } catch (err) { ui.showToast('❌ Errore importazione', 'warn'); }
  };
  reader.readAsText(file);
}

// --- GLOBAL HANDLERS FOR HTML ---
window.addNewBU = () => {
  const name = prompt("Nome attività (es. Pizzeria, Ballo):");
  if (!name) return;
  const rate = parseFloat(prompt("Tariffa (€ per ora o per turno):", "50")) || 0;
  const color = prompt("Colore esadecimale (es. #ff0000):", utils.PALETTE[Math.floor(Math.random()*utils.PALETTE.length)].hex);
  const type = confirm("È un turno fisso (SÌ) o un servizio a ore (NO)?") ? 'shift' : 'service';
  
  const newBU = { id: 'bu_' + Date.now(), name, rate, color, type };
  state.businessUnits.push(newBU);
  state.saveBusinessUnits(state.businessUnits);
  ui.renderBusinessUnits();
  ui.populateBUSelect();
  ui.showToast('Attività aggiunta!');
};

window.addRecurringShift = () => {
  if (!state.businessUnits.length) {
    ui.showToast("Crea prima un'attività!", "warn");
    return;
  }
  const buNames = state.businessUnits.map((b, i) => `${i}: ${b.name}`).join("\n");
  const buIdx = prompt("Scegli attività:\n" + buNames, "0");
  const bu = state.businessUnits[parseInt(buIdx)];
  if (!bu) return;

  const day = parseInt(prompt("Giorno della settimana (0=Dom, 1=Lun, ..., 6=Sab):", "1"));
  const start = prompt("Ora inizio (HH:mm):", "19:00");
  const end = prompt("Ora fine (HH:mm):", "23:00");

  const newShift = { id: 'rs_' + Date.now(), buId: bu.id, day, start, end };
  state.recurringShifts.push(newShift);
  state.saveRecurringShifts(state.recurringShifts);
  ui.renderRecurringShifts();
  ui.showToast('Turno ricorrente salvato!');
};

window.removeRecurringShift = (id) => {
  if (confirm("Rimuovere questo turno ricorrente?")) {
    state.saveRecurringShifts(state.recurringShifts.filter(s => s.id !== id));
    ui.renderRecurringShifts();
  }
};

window.sendFeatureRequest = () => {
  const msg = "Ciao! Vorrei richiedere una nuova funzionalità per la mia attività su AppuntaMenti Cloud...";
  const mailto = `mailto:support@appuntamenti.cloud?subject=Richiesta Funzionalità SaaS&body=${encodeURIComponent(msg)}`;
  window.open(mailto, '_blank');
  ui.showToast("🚀 Grazie! Il tuo feedback è prezioso.");
};

window.onBUChange = ui.onBUChange;

// Start the app
init();
