/**
 * Application State & Persistence
  */

  export let appointments = JSON.parse(localStorage.getItem('apt_data')) || [];
  export let clients = JSON.parse(localStorage.getItem('apt_clients')) || [];
  export let editingId = null;
  export let currentView = 'agenda';
  export let selectedDate = new Date().toISOString().split('T')[0];
  export let calYear = new Date().getFullYear();
  export let calMonth = new Date().getMonth();
  export let currentTheme = localStorage.getItem('apt_theme') || 'lilla';
  export let soundEnabled = localStorage.getItem('apt_sound') !== 'false';
  export let notifEnabled = localStorage.getItem('apt_notif') === 'true';
  export let searchQuery = '';
  export let appName = localStorage.getItem('apt_app_name') || 'AppuntaMenti';
  export let logoType = localStorage.getItem('apt_logo_type') || 'sq';
  export let cloudConfig = JSON.parse(localStorage.getItem('apt_cloud_config')) || { 
    url: 'https://grzvhucviqtbqfzxlmnh.supabase.co', 
      key: 'sb_publishable_E9vfSAsXVM5H-OA2Qp3zsQ_wllefVi1' 
      };

      // SaaS / Business Units
      export let businessUnits = JSON.parse(localStorage.getItem('apt_business_units')) || [
          { id: 'pizzeria', name: 'Pizzeria', color: 'red', type: 'shift', rate: 50 },
            { id: 'ballo', name: 'Lezioni di Ballo', color: 'purple', type: 'service', rate: 20 }
];
export let recurringShifts = JSON.parse(localStorage.getItem('apt_recurring_shifts')) || [];

// Persistence
export function saveApts(data) {
  appointments = data;
    localStorage.setItem('apt_data', JSON.stringify(appointments));
    }

    export function saveClients(data) {
      clients = data;
        localStorage.setItem('apt_clients', JSON.stringify(clients));
        }

        export function saveBusinessUnits(data) {
          businessUnits = data;
            localStorage.setItem('apt_business_units', JSON.stringify(businessUnits));
            }
            
