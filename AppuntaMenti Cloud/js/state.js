/**
 * Application State & Persistence
 */

import { isoToday } from './utils.js';

export let appointments = JSON.parse(localStorage.getItem('apt_data')) || [];
export let clients = JSON.parse(localStorage.getItem('apt_clients')) || [];
export let editingId = null;
export let currentView = 'agenda';
export let selectedDate = isoToday();
export let calYear = new Date().getFullYear();
export let calMonth = new Date().getMonth();
export let currentTheme = localStorage.getItem('apt_theme') || 'lilla';
export let soundEnabled = localStorage.getItem('apt_sound') !== 'false';
export let notifEnabled = localStorage.getItem('apt_notif') === 'true';
export let searchQuery = '';
export let appName = localStorage.getItem('apt_app_name') || 'AppuntaMenti';
export let logoType = localStorage.getItem('apt_logo_type') || 'sq';
export let cloudConfig = JSON.parse(localStorage.getItem('apt_cloud_config')) || { url: '', key: '' };

// Custom Field Definitions
export let customFieldsApt = JSON.parse(localStorage.getItem('apt_fields_def_apt')) || [];
export let customFieldsClient = JSON.parse(localStorage.getItem('apt_fields_def_client')) || [];

// SaaS / Business Units
export let businessUnits = JSON.parse(localStorage.getItem('apt_business_units')) || [
  { id: 'pizzeria', name: 'Pizzeria', color: 'red', type: 'shift', rate: 50 }, // Example default for user
  { id: 'ballo', name: 'Lezioni di Ballo', color: 'purple', type: 'service', rate: 20 }
];
export let recurringShifts = JSON.parse(localStorage.getItem('apt_recurring_shifts')) || [];

// Setters
export function setEditingId(id) { editingId = id; }
export function setCurrentView(view) { currentView = view; }
export function setSelectedDate(date) { selectedDate = date; }
export function setCalYear(year) { calYear = year; }
export function setCalMonth(month) { calMonth = month; }
export function setAppName(name) {
  appName = name;
  localStorage.setItem('apt_app_name', name);
}
export function setLogoType(type) {
  logoType = type;
  localStorage.setItem('apt_logo_type', type);
}
export function setSearchQuery(q) { searchQuery = q; }
export function setSoundEnabled(val) {
  soundEnabled = val;
  localStorage.setItem('apt_sound', val);
}
export function setNotifEnabled(val) {
  notifEnabled = val;
  localStorage.setItem('apt_notif', val);
}

// Persistence
export function saveApts(data) {
  appointments = data;
  localStorage.setItem('apt_data', JSON.stringify(appointments));
}

export function saveClients(data) {
  clients = data;
  localStorage.setItem('apt_clients', JSON.stringify(clients));
}

export function saveFieldDefs(aptDefs, clientDefs) {
  customFieldsApt = aptDefs;
  customFieldsClient = clientDefs;
  localStorage.setItem('apt_fields_def_apt', JSON.stringify(customFieldsApt));
  localStorage.setItem('apt_fields_def_client', JSON.stringify(customFieldsClient));
}

export function setCloudConfig(config) {
  cloudConfig = config;
  localStorage.setItem('apt_cloud_config', JSON.stringify(cloudConfig));
}

export function saveBusinessUnits(data) {
  businessUnits = data;
  localStorage.setItem('apt_business_units', JSON.stringify(businessUnits));
}

export function saveRecurringShifts(data) {
  recurringShifts = data;
  localStorage.setItem('apt_recurring_shifts', JSON.stringify(recurringShifts));
}
