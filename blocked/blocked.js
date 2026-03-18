/**
 * blocked.js — Block page typing challenge controller.
 *
 * Security notes:
 *   - CHALLENGE string lives only in a JS closure (not in the DOM)
 *   - Characters rendered via CSS ::before { content: attr(data-c) }
 *     so querySelectorAll('.char').map(s => s.textContent).join('') → ''
 *   - copy/cut events on the typing area are intercepted and cleared
 *   - user-select: none applied to .typing-area via CSS
 */

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(location.search);
  const domain = params.get('domain') ?? 'unknown site';

  document.getElementById('blocked-domain').textContent = `${domain} is blocked`;
  document.title = `Blocked — ${domain}`;

  // Load profile name + challenge text from storage
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const activeProfile = state.profiles?.[state.activeProfileId];
  const profileName = activeProfile?.name ?? 'your blocklist';
  const CHALLENGE = state.config?.unlockChallengeText ?? '';

  document.getElementById('blocked-sub').textContent = `Part of your ${profileName} blocklist`;
  document.getElementById('page-footer').textContent =
    `blockthesefckingsites · ${profileName}`;

  buildChallenge(CHALLENGE, domain, state.activeProfileId);
}

// ── Challenge UI ───────────────────────────────────────────────────────────

function buildChallenge(CHALLENGE, domain, profileId) {
  const display   = document.getElementById('chars-display');
  const input     = document.getElementById('hidden-input');
  const fill      = document.getElementById('progress-fill');
  const progressBar = document.getElementById('progress-bar');
  const pct       = document.getElementById('progress-pct');
  const btn       = document.getElementById('btn-remove');
  const errorEl   = document.getElementById('removal-error');
  const typingArea = document.getElementById('typing-area');
  const BTN_LABEL = btn.textContent; // read from HTML — single source of truth

  // Build all character spans in one DocumentFragment — single DOM insertion.
  // data-c holds the char; textContent is empty → DOM extraction yields ''.
  const fragment = document.createDocumentFragment();
  const spans = [...CHALLENGE].map((ch) => {
    const s = document.createElement('span');
    s.className = 'char pending';
    s.dataset.c = ch;
    fragment.appendChild(s);
    return s;
  });
  display.appendChild(fragment);

  // Scope copy/cut/paste to the typing area — prevents extracting or pasting the challenge text
  typingArea.addEventListener('copy', (e) => {
    e.clipboardData.setData('text/plain', '');
    e.preventDefault();
  });
  typingArea.addEventListener('cut', (e) => {
    e.clipboardData.setData('text/plain', '');
    e.preventDefault();
  });
  // Block paste on the hidden input directly (no shortcuts bypass)
  input.addEventListener('paste', (e) => {
    e.preventDefault();
  });

  let lastProgress = -1;

  function update() {
    const typed = input.value;
    let correctCount = 0;
    let allCorrect = true;

    spans.forEach((s, i) => {
      let next;
      if (i < typed.length) {
        if (typed[i] === CHALLENGE[i]) {
          next = 'char correct';
          correctCount++;
        } else {
          next = 'char wrong';
          allCorrect = false;
        }
      } else if (i === typed.length) {
        next = 'char cursor pending';
        allCorrect = false;
      } else {
        next = 'char pending';
        allCorrect = false;
      }
      // Only write to DOM if class actually changed
      if (s.className !== next) s.className = next;
    });

    const progress = CHALLENGE.length
      ? Math.round((correctCount / CHALLENGE.length) * 100)
      : 100;
    if (progress !== lastProgress) {
      fill.style.width = progress + '%';
      pct.textContent  = progress + '%';
      progressBar.setAttribute('aria-valuenow', progress);
      lastProgress = progress;
    }

    const complete = allCorrect && typed.length >= CHALLENGE.length;
    btn.disabled = !complete;
    return complete;
  }

  input.addEventListener('input', update);
  // Move focus to hidden input on click — replaces the blocked inline onclick
  typingArea.addEventListener('click', () => input.focus());
  update(); // initialise cursor on first char
  input.focus();

  // ── Remove button ──────────────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;

    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Unlocking…';

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UNLOCK_SITE',
        profileId,
        domain,
        typedChallenge: input.value,
      });

      if (result.success) {
        // Navigate to the now-unlocked site
        location.replace(`https://${domain}`);
      } else {
        errorEl.textContent = result.error ?? result.reason ?? 'Unlock failed. Try again.';
        errorEl.classList.remove('hidden');
        btn.textContent = BTN_LABEL;
        update();
      }
    } catch (err) {
      errorEl.textContent = err.message ?? 'An unexpected error occurred.';
      errorEl.classList.remove('hidden');
      btn.textContent = BTN_LABEL;
      btn.disabled = false;
    }
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

init().catch((err) => {
  console.error('[blocked.js] init error:', err);
  document.getElementById('blocked-domain').textContent = 'Site Blocked';
  document.getElementById('blocked-sub').textContent = 'Could not load extension state.';
});
