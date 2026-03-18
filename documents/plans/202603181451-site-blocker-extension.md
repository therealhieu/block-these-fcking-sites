# Site Blocker Browser Extension — Implementation Plan

> **Created:** 2026-03-18
> **Status:** Draft

---

## 1. Overview

A Manifest V3 Chrome extension that blocks user-defined sites with:

- Permanent site blocking until explicitly removed
- Typing-challenge removal gate (developer-configured paragraph required to remove a site)
- Schedule-based blocking (day-of-week + time ranges)
- Named profiles with independent configurations

---

## 2. UI Mockups

### 2.1 Popup

Quick-access panel. **Theme: Cream Red.** Read-only — profile switcher, blocked-site count, schedule status, and a link to settings. No destructive actions in popup.

→ [mockup-popup.html](../static/mockup-popup.html)

### 2.2 Options Page

Single-page settings form. **Theme: Cream Red** — warm cream background with burgundy-red accents. Three sections only (Profile, Blocked Sites, Schedule). No sidebar or tabs. The challenge paragraph is **never shown** in settings.

→ [mockup-options.html](../static/mockup-options.html)

### 2.3 Block Page (Intercept Page)

Full browser tab shown when navigation is intercepted. **Theme: Cream Red.** Typing-game style challenge — the paragraph is rendered as inline character spans (green = correct, red = incorrect, gray = pending). No copyable blockquote.

→ [mockup-block-page.html](../static/mockup-block-page.html) *(fully interactive typing game — open in browser)*

---

## 3. Color Scheme — Cream Red

> Selected theme. Apply consistently across all three UI surfaces (popup, options page, block page).

### Palette

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Page background | `--color-bg` | `#f5f0e8` | Outer page / app background |
| Card background | `--color-surface` | `#fdfaf5` | Section cards, list rows |
| Primary text | `--color-text` | `#1a1008` | Body text, labels |
| Muted text | `--color-text-muted` | `#7a6a55` | Secondary labels, timestamps |
| Accent (primary) | `--color-accent` | `#9b1c1c` | Buttons, section labels, borders, icons |
| Accent (hover) | `--color-accent-hover` | `#b91c1c` | Button hover state |
| Accent (subtle bg) | `--color-accent-subtle` | `#fdf2f2` | Blockquote bg, highlight bg |
| Border | `--color-border` | `#e0d5c5` | Input borders, dividers |
| Input background | `--color-input-bg` | `#fdfaf5` | Text inputs, number inputs |
| Input border | `--color-input-border` | `#d6c9b5` | Input strokes |
| Status: locked | `--color-locked` | `#9b1c1c` | Lock status label |
| Status: success | `--color-success` | `#276749` | Unlocked / removed status label |
| Destructive | `--color-danger` | `#9b1c1c` | Delete / Remove actions |

### Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| App title | Inter | 16px | 600 |
| Section label | Inter | 11px | 700, uppercase, letter-spacing 0.08em |
| Body / inputs | Inter | 14px | 400 |
| Status / meta | Inter | 12px | 400 |
| Challenge text | Inter | 14px | 400, italic |

### Component Tokens

```css
:root {
  --color-bg:             #f5f0e8;
  --color-surface:        #fdfaf5;
  --color-text:           #1a1008;
  --color-text-muted:     #7a6a55;
  --color-accent:         #9b1c1c;
  --color-accent-hover:   #b91c1c;
  --color-accent-subtle:  #fdf2f2;
  --color-border:         #e0d5c5;
  --color-input-bg:       #fdfaf5;
  --color-input-border:   #d6c9b5;
  --color-locked:         #9b1c1c;
  --color-success:        #276749;
  --color-danger:         #9b1c1c;

  --radius-sm:  4px;
  --radius-md:  6px;
  --radius-pill: 999px;

  --font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐   │
│  │   Popup UI   │   │  Options UI  │   │  Block Page    │   │
│  │ (quick view) │   │ (full config)│   │ (intercept pg) │   │
│  └──────┬───────┘   └──────┬───────┘   └───────┬────────┘   │
│         │                  │                    │            │
│         ▼                  ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Background Service Worker              │     │
│  │                                                     │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │     │
│  │  │ BlockEngine │  │ScheduleEngine│  │ProfileMgr │  │     │
│  │  │             │  │              │  │           │  │     │
│  │  │ - matchURL  │  │ - isActive() │  │ - CRUD    │  │     │
│  │  │ - enforce() │  │ - cron check │  │ - switch  │  │     │
│  │  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │     │
│  │         │                │                │        │     │
│  │         ▼                ▼                ▼        │     │
│  │  ┌─────────────────────────────────────────────┐   │     │
│  │  │        chrome.storage.local / sync          │   │     │
│  │  └─────────────────────────────────────────────┘   │     │
│  │                                                     │     │
│  │  Uses: chrome.webNavigation.onBeforeNavigate        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. File Structure

```
block-these-fcking-sites/
├── manifest.json
├── background/
│   └── service-worker.js        # orchestrates all engines
├── lib/
│   ├── block-engine.js          # URL matching + enforcement
│   ├── schedule-engine.js       # time-window evaluation
│   ├── domain-normalizer.js     # user input → canonical domain
│   ├── profile-manager.js       # profile CRUD + switching
│   ├── removal-manager.js       # removal gate logic + typing verification
│   └── storage.js               # thin wrapper over chrome.storage
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── blocked/
│   ├── blocked.html             # shown when navigation is intercepted
│   ├── blocked.css
│   └── blocked.js               # typing challenge UI
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── documents/
│   └── plans/
└── README.md
```

---

## 6. Data Model

All state lives in `chrome.storage.local`.

```jsonc
{
  "activeProfileId": "work",
  "profiles": {
    "work": {
      "id": "work",
      "name": "Work Mode",
      "sites": [
        {
          "domain": "reddit.com"    // matched against hostname (exact + subdomain)
        }
      ],
      "schedule": {
        "enabled": true,
        "rules": [
          {
            "days": [1, 2, 3, 4, 5],       // 0=Sun, 1=Mon, ..., 6=Sat
            "startTime": "09:00",           // 24h format
            "endTime": "18:00"
          }
        ]
      }
    }
  },
  "config": {
    "unlockChallengeText": "I solemnly declare that I am wasting my precious time on distractions instead of focusing on what truly matters. I understand that every minute spent here is a minute I will never get back. I choose discipline over comfort, and I am closing this site now."
  }
}
```

---

## 7. Core Module Specifications

### 7.1 Block Engine (`lib/block-engine.js`)

**Responsibility:** Intercept top-level navigations and redirect blocked URLs to the block page.

- Listens to `chrome.webNavigation.onBeforeNavigate`
- Filters: `frameId === 0` (top-level only)
- Matches `url.hostname` against active profile's site list (exact match + subdomain match via `.endsWith('.' + domain)`)
- Delegates to Schedule Engine — skips (allows navigation) if outside active schedule window
- Redirects to `blocked/blocked.html?domain=<encoded_domain>`
- On schedule activation: calls `chrome.tabs.query({})` and redirects any open tab whose hostname matches a blocked domain

### 7.2 Schedule Engine (`lib/schedule-engine.js`)

**Responsibility:** Determine if the current time falls within any active blocking window.

```js
// Returns true if blocking is active RIGHT NOW
function isWithinSchedule(rules) → boolean
```

- Compares `new Date().getDay()` against `rule.days`
- Compares `HH:MM` string against `rule.startTime` / `rule.endTime`
- If `schedule.enabled === false`, blocking is **always active** (no time restrictions — blocks all day)
- Supports multiple rules (OR logic — any matching rule activates blocking)
- On schedule window **start**: sweeps all open tabs and redirects any matching blocked domains

> **UX note:** The schedule toggle is labelled **"Limit blocking to specific hours"**. Off = block all day (default, most restrictive); On = block only during configured windows.

### 7.3 Removal Manager (`lib/removal-manager.js`)

**Responsibility:** Enforce the two-gate removal check and typing challenge verification.

```js
// Is removal currently permitted? (schedule gate + challenge gate)
function canRemoveSite(profile, domain) → boolean

// Does the typed text match the configured challenge?
function verifyTypingChallenge(expected, typed) → boolean

// Remove site after both gates pass
function removeSite(profileId, domain) → Promise<void>
```

- `canRemoveSite`: returns `true` only when current time is **outside** all active schedule windows
- `verifyTypingChallenge`: normalizes whitespace, trims, case-insensitive comparison
- On successful verification + `canRemoveSite`: deletes the domain from `profile.sites` and persists
- No cooldown. No alarms. No `isUnlocked` flag.
- **Challenge non-persistence (intentional):** The typing challenge state is not stored. If a user completes the challenge while the schedule gate is closed, they must retype when it opens. This prevents pre-queued removals.

### 7.4 Profile Manager (`lib/profile-manager.js`)

**Responsibility:** CRUD operations on profiles and profile switching.

```js
function createProfile(name) → profile
function deleteProfile(id) → void
function switchProfile(id) → void
function getActiveProfile() → profile
function addSite(profileId, domain) → void
function removeSite(profileId, domain) → void   // guarded by canRemoveSite()
```

- Prevents deleting the last remaining profile
- **Profile deletion policy:** A profile with blocked sites **cannot** be deleted; user must remove all sites from it first or the Delete button is disabled with tooltip _"Remove all sites from this profile before deleting it"_
- Switching profiles updates `activeProfileId` and triggers block engine re-evaluation
- `addSite` only requires a normalized domain — no interval or unlock state fields

### 7.5 Domain Normalizer (`lib/domain-normalizer.js`)

**Responsibility:** Accept loose user input and produce a canonical domain for blocking.

```js
function normalizeDomain(input) → string
// 'facebook'        → 'facebook.com'
// 'www.reddit.com'  → 'reddit.com'
// 'YouTube'         → 'youtube.com'
// 'https://x.com/foo' → 'x.com'
// 'sub.example.co.uk' → 'sub.example.co.uk'
```

Algorithm:
1. `trim()` + `toLowerCase()`
2. Strip protocol: `s.replace(/^https?:\/\//, '')`
3. Strip `www.` prefix: `s.replace(/^www\./, '')`
4. Take only the hostname: `s.split('/')[0]`
5. If result contains no `.`, append `.com`

### 7.6 Storage (`lib/storage.js`)

**Responsibility:** Thin async wrapper over `chrome.storage.local`.

```js
async function get(keys) → object
async function set(data) → void
async function initDefaults() → void   // seeds initial state on install
```

---

## 8. UI Specifications

### 8.1 Popup (`popup/`)

Minimal status dashboard:

- Shows active profile name with a dropdown to switch
- Lists blocked sites count for active profile
- Shows schedule status (active/inactive/next window)
- "Options" button → opens full options page
- No ability to add/remove sites from popup (intentional friction)

### 8.2 Options Page (`options/`)

Single-page, Cream Red theme (`#fdfaf5` card background). Three sections only — no tabs, no sidebar:

- **Profile:** Profile name input + Rename / New Profile / Delete buttons; segmented switcher for existing profiles
- **Blocked Sites:** Inline add-site row (domain + Add button); list of sites with lock status; Remove link per row
- **Blocking Schedule:** Enable/disable toggle; day-of-week pill selector (Mon–Sun); From/To time inputs
- Form validation: domain format, valid time ranges
- The challenge paragraph text is **never displayed** in the settings page — it only appears inside the typing game on the block page

#### Site Removal Eligibility

The **Remove** action is conditionally available based on two independent gates.
Both gates must be open simultaneously for removal to be permitted:

| Gate | Condition | Remove allowed? |
|---|---|---|
| Schedule gate | Schedule disabled OR current time is **outside** all blocking windows | ✅ Open |
| Schedule gate | Schedule enabled AND current time is **inside** a blocking window | 🔒 Locked |
| Challenge gate | User has typed the full challenge paragraph correctly | ✅ Open |
| Challenge gate | Challenge not yet completed in this session | 🔒 Locked |
| **Combined** | **Both gates open** | ✅ **Remove enabled** |
| **Combined** | **Either gate locked** | 🔒 **Remove disabled** |

When Remove is disabled, the link renders as muted (`--color-text-muted`) with a tooltip: _"Cannot remove while schedule is active"_ or _"Type the unlock challenge to remove this site"_ as appropriate.

### 8.3 Block Page (`blocked/`)

Shown when a blocked site is intercepted. The UI is modelled on a typing speed game (monkeytype / typeracer style):

- Displays: "{domain} is blocked" with flat shield icon and profile name
- Label **"TYPE TO REMOVE"** in burgundy uppercase
- Small instruction: _"Type the passage below. Do not stop — mistakes must be corrected."_
- **Typing area** — the challenge paragraph is rendered as character-level `<span>` elements using **CSS `::before { content: attr(data-c) }`**. The `textContent` of each span is empty, so `querySelectorAll('.char').map(s => s.textContent).join('')` yields an empty string. The full challenge string lives only in a JS closure.
  - Correctly typed: `::before` color `#276749` green
  - Incorrectly typed: `::before` color `#9b1c1c` red, `background: #fdf2f2`
  - Pending: `::before` color `#7a6a55` muted
  - Blinking burgundy cursor at current position
  - `copy` and `cut` DOM events are intercepted and cleared
  - **No copyable text anywhere on the page**
- Progress bar below the typing area: `--color-border` track, `--color-accent` fill, percentage label
- **"Remove Site"** button: disabled until progress reaches 100%
- On submission:
  - If schedule window is active → inline error _"Cannot remove during active schedule window"_
  - If outside schedule → domain removed from blocklist, browser navigates away

---

## 9. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "blockthesefckingsites",
  "version": "1.0.0",
  "description": "Block distracting sites with a typing challenge to remove them",
  "permissions": ["storage", "webNavigation", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_page": "options/options.html",
  "incognito": "spanning",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

## 10. Key Design Decisions

| Decision | Rationale |
|---|---|
| `webNavigation.onBeforeNavigate` over `declarativeNetRequest` | Need runtime conditional logic (schedule checks, challenge verification). Declarative rules can't express this. |
| `chrome.storage.local` over `sync` | Sync has 100KB quota; local supports ~10MB. Sufficient for thousands of sites. |
| No unlock-interval / no relock | Simpler model: sites are permanently blocked until removed. No cooldown timers, no alarms, no `isUnlocked` state. |
| Typing challenge gates removal | To remove a site, user must type the full developer-configured paragraph. Prevents impulsive removal. |
| Schedule gate also blocks removal | If inside an active blocking window, removal is refused even if the challenge is passed. Both gates must be open simultaneously. |
| Challenge state not persisted | Challenge must be retyped each time Remove is attempted. Prevents pre-queuing a removal during a blocked window. |
| Developer-configured challenge text | Stored in extension config, not user-editable. Prevents trivial bypass by setting a 1-char challenge. |
| DOM text extraction mitigation | Characters rendered via CSS `::before { content: attr(data-c) }`. `textContent` of each span is empty. Copy/cut events cleared. |
| Active tab sweep on schedule start | On schedule activation, open tabs matching blocked domains are redirected immediately, not just on next navigation. |
| Domain normalization | User input `"facebook"` → stored as `"facebook.com"`. Strips protocol, `www.`, path. Appends `.com` if no `.` in result. |
| Profile deletion requires empty profile | Profiles with blocked sites cannot be deleted. User must clear sites first, preventing accidental data loss. |
| `incognito: "spanning"` | Extension runs in incognito windows too. User must explicitly enable in `chrome://extensions`, but we declare intent. |

---

## 11. Anti-Circumvention Measures

> Browser extensions are inherently bypassable (user can disable/uninstall). These measures maximize friction:

1. **Typing challenge required to remove** — User must type the full developer-configured paragraph before a site can be removed from the blocklist
2. **Schedule gate blocks removal** — Even after passing the typing challenge, removal is refused during active schedule windows. The user must wait until outside the blocking window
3. **Incognito coverage** — Extension declares `spanning` mode
4. **No popup shortcuts** — Popup is read-only; all mutations go through Options page
5. **Hard limit accepted** — DevTools and extension uninstall cannot be prevented; this is a self-discipline tool, not a parental control

---

## 12. Phased Implementation

### Phase 1 — Foundation (2–3 hrs)

- [ ] `manifest.json` with all permissions
- [ ] `background/service-worker.js` — lifecycle + message routing
- [ ] `lib/storage.js` — init defaults on `chrome.runtime.onInstalled`
- [ ] `lib/block-engine.js` — URL matching + redirect to block page
- [ ] `blocked/blocked.html` — static "site blocked" page (no challenge yet)
- [ ] **Verify:** Load unpacked, add hardcoded domain, confirm redirect works

### Phase 2 — Storage & Profiles (3–4 hrs)

- [ ] `lib/profile-manager.js` — full CRUD
- [ ] `options/options.html` + `options.js` — profile management UI
- [ ] Site management UI in options (add domain, remove with gate enforcement)
- [ ] Wire block engine to read from storage instead of hardcoded list
- [ ] **Verify:** Create profile, add sites, switch profiles, confirm blocking respects active profile

### Phase 3 — Schedule Engine (2 hrs)

- [ ] `lib/schedule-engine.js` — `isWithinSchedule()` implementation
- [ ] Schedule configuration UI in options page (day checkboxes + time pickers)
- [ ] Integrate schedule check into block engine's decision flow
- [ ] **Verify:** Set schedule, confirm sites are accessible outside the window and blocked inside it

### Phase 4 — Removal System (2–3 hrs)

- [ ] `lib/removal-manager.js` — `canRemoveSite()` (schedule gate) + `verifyTypingChallenge()`
- [ ] `blocked/blocked.js` — typing challenge UI with live character diff and progress bar
- [ ] Wire "Remove Site" button: check schedule gate, call `removeSite()` on success
- [ ] Options page Remove link: disable during active schedule, show tooltip
- [ ] **Verify:** Add a site, visit it, complete the typing challenge, confirm it is removed from the blocklist; confirm removal is rejected during active schedule window

### Phase 5 — Popup UI (2 hrs)

- [ ] `popup/popup.html` + `popup.js` — status dashboard
- [ ] Active profile display + switcher dropdown
- [ ] Blocked sites count + schedule status
- [ ] Link to options page
- [ ] **Verify:** Verify popup reflects current state accurately after profile switches and site changes

### Phase 6 — Polish (2–3 hrs)

- [ ] Icon generation (16, 48, 128px)
- [ ] Error handling in all storage operations
- [ ] Edge cases: empty profiles, overlapping schedules, midnight-crossing time ranges
- [ ] CSS polish for all three UIs (popup, options, block page)
- [ ] README with installation and usage instructions
- [ ] **Verify:** Full end-to-end test across all features

---

## 13. Testing Strategy

| Layer | Approach |
|---|---|
| **Unit** | Test `schedule-engine` and `removal-manager` in isolation (pure functions, no Chrome APIs) |
| **Integration** | Load unpacked extension, manually verify each phase's acceptance criteria |
| **Edge cases** | Midnight-crossing schedules, subdomain matching, simultaneous profile switches, storage quota limits |
| **Regression** | After each phase, re-verify previous phases still work |

---

## 14. Future Enhancements (Out of Scope for v1)

- Cross-device sync via `chrome.storage.sync` (metadata only)
- Firefox/Safari port (WebExtension API compatibility)
- Import/export profiles as JSON
- Statistics dashboard (time saved, blocks count)
- Allowlist mode (block everything except listed sites)
- Customizable block page themes
