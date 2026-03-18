/**
 * popup.js — Popup UI controller.
 * Read-only status view: profile switcher, site count, schedule status.
 */

import { isScheduleActive } from '../lib/schedule-engine.js';

async function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

async function init() {
  const state = await send({ type: 'GET_STATE' });

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  const { profiles, activeProfileId, config: _config } = state;
  const profile = profiles[activeProfileId];

  // ── Profile select ──
  const select = document.getElementById('profile-select');
  Object.values(profiles).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    opt.selected = p.id === activeProfileId;
    select.appendChild(opt);
  });

  select.addEventListener('change', async () => {
    await send({ type: 'SWITCH_PROFILE', id: select.value });
    // Reload to reflect new profile
    location.reload();
  });

  // ── Stats ──
  document.getElementById('stat-sites').textContent = (profile.sites ?? []).length;

  const scheduleActive = isScheduleActive(profile.schedule);
  const dot = document.getElementById('schedule-dot');
  dot.classList.add(scheduleActive ? 'active' : 'inactive');
  document.getElementById('schedule-status').textContent = scheduleActive ? 'Blocking On' : 'Blocking Off';

  const firstRule = profile.schedule?.rules?.[0];
  if (profile.schedule?.enabled && firstRule) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabels = firstRule.days.map((d) => days[d]).join('·');
    document.getElementById('schedule-sub').textContent =
      `${dayLabels} ${firstRule.startTime}–${firstRule.endTime}`;
  } else if (!profile.schedule?.enabled) {
    document.getElementById('schedule-sub').textContent = 'All day';
  }

  // ── Sites list ──
  const list = document.getElementById('sites-list');
  const empty = document.getElementById('sites-empty');
  const sites = profile.sites ?? [];

  if (sites.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.remove();
    sites.forEach(({ domain }) => {
      const row = document.createElement('div');
      row.className = 'site-row';

      const left = document.createElement('div');
      left.className = 'site-left';

      const lock = document.createElement('span');
      lock.className = 'site-lock';
      lock.setAttribute('aria-hidden', 'true');
      lock.textContent = '🔒';

      const domainEl = document.createElement('span');
      domainEl.className = 'site-domain';
      domainEl.textContent = domain; // safe: textContent, not innerHTML

      left.append(lock, domainEl);
      row.appendChild(left);
      list.appendChild(row);
    });
  }

  // ── Settings button ──
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-open-settings').addEventListener('click', openSettings);
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

init().catch(console.error);
