/**
 * options.js — Options page controller.
 * Manages Profile, Blocked Sites, and Schedule sections.
 */

import { normalizeDomain, isValidDomain } from '../lib/domain-normalizer.js';
import { isScheduleActive } from '../lib/schedule-engine.js';

// ── Helpers ────────────────────────────────────────────────────────────────

async function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError(elId) {
  const el = document.getElementById(elId);
  el.textContent = '';
  el.classList.add('hidden');
}

// ── State ──────────────────────────────────────────────────────────────────

let state = null; // full storage snapshot
let activeProfileId = null;

function profile() {
  return state.profiles[activeProfileId];
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
  state = await send({ type: 'GET_STATE' });
  activeProfileId = state.activeProfileId;

  // Version badge
  const manifest = chrome.runtime.getManifest();
  document.getElementById('ext-version').textContent = `v${manifest.version}`;

  renderProfiles();
  renderSites();
  renderSchedule();
  bindProfileActions();
  bindSiteActions();
  bindScheduleActions();
}

// ── Profile section ────────────────────────────────────────────────────────

function renderProfiles() {
  const chipRow = document.getElementById('chip-row');
  chipRow.innerHTML = '';

  Object.values(state.profiles).forEach((p) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (p.id === activeProfileId ? ' active' : '');
    chip.textContent = p.name;
    chip.setAttribute('role', 'listitem');
    chip.setAttribute('aria-pressed', String(p.id === activeProfileId));
    chip.addEventListener('click', () => switchToProfile(p.id));
    chipRow.appendChild(chip);
  });

  const p = profile();
  document.getElementById('profile-name-input').value = p.name;

  // Delete disabled if last profile or has sites
  const btnDelete = document.getElementById('btn-delete');
  const isLast = Object.keys(state.profiles).length <= 1;
  const hasSites = (p.sites ?? []).length > 0;
  btnDelete.disabled = isLast || hasSites;
  btnDelete.title = isLast
    ? 'Cannot delete the last profile'
    : hasSites
    ? 'Remove all sites from this profile before deleting it'
    : '';
}

async function switchToProfile(id) {
  await send({ type: 'SWITCH_PROFILE', id });
  state = await send({ type: 'GET_STATE' });
  activeProfileId = id;
  renderProfiles();
  renderSites();
  renderSchedule();
}

function bindProfileActions() {
  document.getElementById('btn-rename').addEventListener('click', async () => {
    clearError('profile-error');
    const name = document.getElementById('profile-name-input').value.trim();
    if (!name) return showError('profile-error', 'Profile name cannot be empty.');
    await send({ type: 'RENAME_PROFILE', id: activeProfileId, name });
    state = await send({ type: 'GET_STATE' });
    renderProfiles();
  });

  document.getElementById('btn-new-profile').addEventListener('click', async () => {
    clearError('profile-error');
    const name = `Profile ${Object.keys(state.profiles).length + 1}`;
    const { profile: newP } = await send({ type: 'CREATE_PROFILE', name });
    state = await send({ type: 'GET_STATE' });
    activeProfileId = newP.id;
    renderProfiles();
    renderSites();
    renderSchedule();
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    clearError('profile-error');
    try {
      await send({ type: 'DELETE_PROFILE', id: activeProfileId });
      state = await send({ type: 'GET_STATE' });
      activeProfileId = state.activeProfileId;
      renderProfiles();
      renderSites();
      renderSchedule();
    } catch (err) {
      showError('profile-error', err.message ?? String(err));
    }
  });
}

// ── Blocked sites section ──────────────────────────────────────────────────

function renderSites() {
  const list = document.getElementById('site-list');
  list.innerHTML = '';

  const sites = profile().sites ?? [];
  const scheduleActive = isScheduleActive(profile().schedule);

  if (sites.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sites-empty';
    empty.textContent = 'No sites blocked yet.';
    list.appendChild(empty);
    return;
  }

  sites.forEach(({ domain }) => {
    const item = document.createElement('div');
    item.className = 'site-item';

    const locked = scheduleActive;
    const tooltip = locked
      ? 'Cannot remove during active schedule window'
      : 'Visit the blocked site to complete the typing challenge';

    // ── Left ──
    const left = document.createElement('div');
    left.className = 'site-item-left';

    const icon = document.createElement('span');
    icon.className = 'site-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔒';

    const domainEl = document.createElement('span');
    domainEl.className = 'site-domain';
    domainEl.textContent = domain; // safe: textContent, not innerHTML

    left.append(icon, domainEl);

    // ── Right ──
    const right = document.createElement('div');
    right.className = 'site-item-right';

    const badge = document.createElement('span');
    badge.className = 'site-status-badge';
    badge.textContent = 'Locked';

    const removeBtn = document.createElement('button');
    removeBtn.className = `site-remove ${locked ? 'locked' : 'open'}`;
    removeBtn.disabled = locked;
    removeBtn.title = locked
      ? 'Cannot remove during active schedule window'
      : 'Permanently remove from blocklist';
    removeBtn.dataset.domain = domain;
    removeBtn.setAttribute('aria-label', `Remove ${domain}`);
    removeBtn.textContent = 'Remove';

    right.append(badge, removeBtn);
    item.append(left, right);
    list.appendChild(item);
  });

  // Permanent removal — no challenge required from settings
  list.querySelectorAll('.site-remove.open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      try {
        await send({ type: 'REMOVE_SITE', profileId: activeProfileId, domain });
        state = await send({ type: 'GET_STATE' });
        renderSites();
        renderProfiles();
      } catch (err) {
        showError('site-error', err.message ?? String(err));
      }
    });
  });
}

function bindSiteActions() {
  document.getElementById('btn-add-site').addEventListener('click', addSite);
  document.getElementById('add-domain').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSite();
  });
}

async function addSite() {
  clearError('site-error');
  const input = document.getElementById('add-domain');
  const raw = input.value.trim();
  if (!raw) return;

  const domain = normalizeDomain(raw);
  if (!isValidDomain(domain)) {
    return showError('site-error', `"${raw}" is not a valid domain.`);
  }

  await send({ type: 'ADD_SITE', profileId: activeProfileId, domain });
  input.value = '';
  state = await send({ type: 'GET_STATE' });
  renderSites();
  renderProfiles(); // update delete eligibility
}

// ── Schedule section ───────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderSchedule() {
  const sched = profile().schedule;
  const enabled = sched?.enabled ?? false;
  const rule = sched?.rules?.[0] ?? { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' };

  document.getElementById('schedule-enabled').checked = enabled;
  document.getElementById('schedule-config').style.opacity = enabled ? '1' : '0.45';

  // Day pills
  const daysRow = document.getElementById('days-row');
  daysRow.innerHTML = '';
  DAY_NAMES.forEach((label, index) => {
    const pill = document.createElement('button');
    pill.className = 'day-pill' + (rule.days.includes(index) ? ' active' : '');
    pill.textContent = label;
    pill.dataset.day = index;
    pill.setAttribute('aria-pressed', String(rule.days.includes(index)));
    pill.addEventListener('click', () => toggleDay(index));
    daysRow.appendChild(pill);
  });

  document.getElementById('time-start').value = rule.startTime;
  document.getElementById('time-end').value = rule.endTime;
}

function currentScheduleRule() {
  const sched = profile().schedule;
  return sched?.rules?.[0] ?? { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' };
}

async function toggleDay(dayIndex) {
  const rule = { ...currentScheduleRule() };
  rule.days = rule.days.includes(dayIndex)
    ? rule.days.filter((d) => d !== dayIndex)
    : [...rule.days, dayIndex].sort((a, b) => a - b);
  await persistSchedule(rule);
}

async function persistSchedule(ruleOverride) {
  const enabled = document.getElementById('schedule-enabled').checked;
  const rule = ruleOverride ?? currentScheduleRule();
  const startTime = document.getElementById('time-start').value || rule.startTime;
  const endTime = document.getElementById('time-end').value || rule.endTime;

  const schedule = {
    enabled,
    rules: [{ days: rule.days, startTime, endTime }],
  };

  await send({ type: 'UPDATE_SCHEDULE', profileId: activeProfileId, schedule });
  state = await send({ type: 'GET_STATE' });
  renderSchedule();
  renderSites(); // re-evaluate lock state
}

function bindScheduleActions() {
  document.getElementById('schedule-enabled').addEventListener('change', () => persistSchedule());
  document.getElementById('time-start').addEventListener('change', () => persistSchedule());
  document.getElementById('time-end').addEventListener('change', () => persistSchedule());
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

init().catch(console.error);
