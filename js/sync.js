/**
 * Cloud Sync Engine (Supabase)
 */

import * as state from './state.js';

export async function syncToCloud() {
  const { cloudConfig, appointments, clients } = state;
  if (!cloudConfig.url || !cloudConfig.key) return;
  
  const syncDot = document.getElementById('sync-dot');
  const syncText = document.getElementById('sync-status-text');
  
  try {
    if (syncDot) syncDot.className = 'sync-dot syncing';
    if (syncText) syncText.textContent = 'Sincronizzazione...';
    
    const headers = { 
      "apikey": cloudConfig.key, 
      "Authorization": `Bearer ${cloudConfig.key}`, 
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    };

    const syncData = async (table, data) => {
      if (!data.length) return;
      await fetch(`${cloudConfig.url}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
    };

    await syncData('appointments', appointments);
    await syncData('clients', clients);

    if (syncDot) syncDot.className = 'sync-dot online';
    if (syncText) {
      syncText.textContent = 'Sincronizzato ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  } catch (err) {
    console.warn('Sync failed', err);
    if (syncDot) syncDot.className = 'sync-dot offline';
    if (syncText) syncText.textContent = 'Errore di connessione';
  }
}

export async function fetchFromCloud(onComplete) {
  const { cloudConfig } = state;
  if (!cloudConfig.url || !cloudConfig.key) return;
  
  try {
    const headers = { "apikey": cloudConfig.key, "Authorization": `Bearer ${cloudConfig.key}` };
    
    const get = async (table) => {
      const resp = await fetch(`${cloudConfig.url}/rest/v1/${table}?select=*`, { headers });
      return resp.json();
    };
    
    const remoteApts = await get('appointments');
    const remoteClients = await get('clients');
    
    if (Array.isArray(remoteApts) && remoteApts.length) {
      state.saveApts(remoteApts);
    }
    if (Array.isArray(remoteClients) && remoteClients.length) {
      state.saveClients(remoteClients);
    }
    
    if (onComplete) onComplete();
  } catch(e) {
    console.error('Fetch from cloud failed', e);
    throw e;
  }
}
