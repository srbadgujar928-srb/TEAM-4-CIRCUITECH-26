(() => {
  "use strict";
  const cfg = window.CIRCUITTECH_APP_CONFIG || {};
  const ready = Boolean(cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-") &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_") &&
    window.supabase && window.supabase.createClient);
  const $ = id => document.getElementById(id);
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  let selectedClient = "client1";
  let publicSettings = null;
  let refreshTimer = null;

  async function invoke(name, options={}) {
    const { data, error } = await client.functions.invoke(name, options);
    if (error) {
      let detail = error.message || "Request failed";
      try { if (error.context) { const body = await error.context.json(); detail = body.error || detail; } } catch (_) {}
      throw new Error(detail);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  function showStatus(msg, bad=false) {
    const el = $("status"); if (!el) return;
    el.textContent = msg; el.className = bad ? "status error" : "status";
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function sensorMarkup(sensor, value, timestamp) {
    const v = value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
      ? "—" : Number(value).toFixed(Number(sensor.decimals ?? 1));
    const stamp = timestamp ? new Date(timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "No data";
    return `<article class="sensor-card"><div class="sensor-top"><span class="sensor-icon">◉</span><span>${escapeHtml(sensor.name)}</span></div><div class="sensor-value">${v}<small>${escapeHtml(sensor.unit || "")}</small></div><div class="sensor-meta"><span>Latest reading</span><span>${escapeHtml(stamp)}</span></div></article>`;
  }
  async function loadPublicSettings() {
    // Public endpoint returns only the non-secret sensor display configuration.
    const { data, error } = await client.from("public_site_settings").select("settings").eq("id", true).single();
    if (error) throw new Error("Could not load public sensor settings. Check SQL migration and table/view permissions.");
    publicSettings = data.settings;
  }
  async function refreshDashboard() {
    if (!ready) {
      $("sensors").innerHTML = '<div class="empty">Setup required: edit app-config.js with your Supabase project URL and publishable/anon key.</div>';
      return;
    }
    try {
      if (!publicSettings) await loadPublicSettings();
      const data = await invoke("client-data", { method: "POST", body: { client: selectedClient } });
      const sensors = publicSettings.sensors || [];
      const feeds = data.feeds || [];
      const latest = feeds.length ? feeds[feeds.length - 1] : {};
      $("sensors").innerHTML = sensors.map(s => sensorMarkup(s, latest[`field${Number(s.field)}`], latest.created_at)).join("");
      $("clientTitle").textContent = ((publicSettings.clients || []).find(c => c.id === selectedClient)?.name || selectedClient) + " readings";
      $("lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
      $("error").hidden = true;
    } catch (e) {
      $("error").hidden = false; $("error").textContent = e.message;
      $("sensors").innerHTML = '<div class="empty">Could not load readings. Check backend deployment and ThingSpeak settings.</div>';
    }
  }

  function renderEditor(settings) {
    $("settingsEditor").innerHTML = `<label>Shared settings JSON (advanced)<textarea id="settingsJson" spellcheck="false"></textarea></label>
      <p class="muted">Edit client display names, sensor field numbers (1–8), units, decimals and warning thresholds. Do not paste API keys here.</p>`;
    $("settingsJson").value = JSON.stringify(settings, null, 2);
  }
  async function loadAdminSettings() {
    const result = await invoke("admin-settings", { method: "GET" });
    renderEditor(result.settings);
    showStatus("Shared settings loaded from the backend.");
  }
  async function setupAdmin() {
    if (!ready) { showStatus("Setup required: edit app-config.js with your Supabase project URL and publishable/anon key.", true); return; }
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      $("loginPanel").hidden = true; $("settingsPanel").hidden = false;
      try { await loadAdminSettings(); } catch(e) { showStatus(e.message, true); }
    } else {
      $("loginPanel").hidden = false; $("settingsPanel").hidden = true;
    }
  }

  document.querySelectorAll("[data-client]").forEach(btn => btn.addEventListener("click", () => {
    selectedClient = btn.dataset.client;
    document.querySelectorAll("[data-client]").forEach(b => b.classList.toggle("selected", b === btn));
    refreshDashboard();
  }));
  if ($("refresh")) $("refresh").addEventListener("click", refreshDashboard);

  if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!ready) return showStatus("Configure app-config.js first.", true);
      const { error } = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
      if (error) return showStatus("Sign-in failed: " + error.message, true);
      $("password").value = "";
      await setupAdmin();
    });
    $("signOut").addEventListener("click", async () => { await client.auth.signOut(); $("settingsPanel").hidden = true; $("loginPanel").hidden = false; showStatus("Signed out."); });
    $("reloadSettings").addEventListener("click", async () => { try { await loadAdminSettings(); } catch(e) { showStatus(e.message,true); } });
    $("saveSettings").addEventListener("click", async () => {
      try {
        const settings = JSON.parse($("settingsJson").value);
        await invoke("admin-settings", { method: "PUT", body: { settings } });
        showStatus("Saved. Shared settings are now updated for all visitors.");
      } catch(e) { showStatus("Save failed: " + e.message, true); }
    });
    if (ready) client.auth.onAuthStateChange(() => { setupAdmin(); });
    setupAdmin();
  } else if ($("sensors")) {
    refreshDashboard();
    refreshTimer = setInterval(refreshDashboard, Math.max(30, Number(cfg.REFRESH_SECONDS) || 30) * 1000);
  }
})();
