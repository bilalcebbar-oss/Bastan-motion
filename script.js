// ===== Year in footer =====
document.querySelectorAll('.year').forEach(el => el.textContent = new Date().getFullYear());

// ===== Header solid on scroll =====
const header = document.getElementById('siteHeader');
if (header) {
  const onScroll = () => {
    if (window.scrollY > 40) header.classList.add('solid');
    else header.classList.remove('solid');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ===== Reveal on scroll =====
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
}

// ===== Dropdown menu (clapperboard-style reveal) =====
(function initMenu(){
  const toggle = document.getElementById('menuToggle');
  const panel = document.getElementById('menuPanel');
  const backdrop = document.getElementById('menuBackdrop');
  if (!toggle || !panel) return;

  function openMenu(){
    toggle.setAttribute('aria-expanded', 'true');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.classList.add('open');
  }
  function closeMenu(){
    toggle.setAttribute('aria-expanded', 'false');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.classList.remove('open');
  }
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeMenu(); else openMenu();
  });
  if (backdrop) backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
})();

// ===== Page transitions, styled like NLE edit transitions =====
(function initPageTransitions(){
  const overlay = document.getElementById('pageTransition');
  if (!overlay) return;
  const label = overlay.querySelector('.ov-label');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal animation on arrival, based on what the previous page stored
  const incoming = sessionStorage.getItem('bm_transition');
  const incomingLabel = sessionStorage.getItem('bm_transition_label');
  sessionStorage.removeItem('bm_transition');
  sessionStorage.removeItem('bm_transition_label');

  if (incoming && !reduced) {
    overlay.classList.add(incoming + '-reveal');
    if (label && incomingLabel) label.textContent = incomingLabel;
    const durations = { wipe: 550, dissolve: 600, cut: 260 };
    setTimeout(() => { overlay.remove(); }, durations[incoming] || 550);
  } else {
    overlay.remove();
  }

  // Intercept clicks on internal links carrying data-transition
  document.querySelectorAll('a[data-transition]').forEach(a => {
    a.addEventListener('click', (e) => {
      if (reduced) return; // let the browser navigate immediately
      e.preventDefault();
      const url = a.getAttribute('href');
      const type = a.getAttribute('data-transition');
      const labelText = a.getAttribute('data-transition-label') || '';

      let freshOverlay = document.getElementById('pageTransition');
      if (!freshOverlay) {
        freshOverlay = document.createElement('div');
        freshOverlay.id = 'pageTransition';
        freshOverlay.innerHTML = '<div class="ov-panel"></div><span class="ov-label mono"></span>';
        document.body.appendChild(freshOverlay);
      }
      const freshLabel = freshOverlay.querySelector('.ov-label');
      if (freshLabel) freshLabel.textContent = labelText;
      freshOverlay.className = type + '-cover';

      sessionStorage.setItem('bm_transition', type);
      sessionStorage.setItem('bm_transition_label', labelText);

      const durations = { wipe: 430, dissolve: 400, cut: 150 };
      setTimeout(() => { window.location.href = url; }, durations[type] || 430);
    });
  });
})();

// ===== Ambient scrub timecode on About page =====
(function initScrubFiller(){
  const tc = document.getElementById('scrubTc');
  if (!tc) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let frame = 0;
  setInterval(() => {
    frame += 2;
    const loopFrames = frame % (24 * 30);
    const f = loopFrames % 24;
    const s = Math.floor(loopFrames / 24) % 60;
    const m = Math.floor(loopFrames / 24 / 60);
    const pad = n => String(n).padStart(2, '0');
    tc.textContent = `00:${pad(m)}:${pad(s)}:${pad(f)}`;
  }, 90);
})();

// ===== Editor timeline: ruler, waveform, draggable playhead =====
(function initEditorTimeline(){
  const ruler = document.getElementById('timelineRuler');
  const waveform = document.getElementById('waveformLane');
  const tracks = document.getElementById('timelineTracks');
  const playhead = document.getElementById('playhead');
  const tcOut = document.getElementById('editorTc');
  if (!ruler || !waveform || !tracks || !playhead) return;

  const totalSeconds = 48;
  const tickCount = 16;
  for (let i = 0; i <= tickCount; i++) {
    const pct = (i / tickCount) * 100;
    const sec = Math.round((pct / 100) * totalSeconds);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = pct + '%';
    tick.textContent = `${mm}:${ss}`;
    ruler.appendChild(tick);
  }

  let seed = 7;
  function rand(){ seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  const barCount = 140;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const h = 4 + Math.round(rand() * 24);
    bar.style.height = h + 'px';
    waveform.appendChild(bar);
  }

  function updateTimecode(pct){
    const sec = (pct / 100) * totalSeconds;
    const totalFrames = Math.round(sec * 24);
    const frames = totalFrames % 24;
    const s = Math.floor(totalFrames / 24) % 60;
    const m = Math.floor(totalFrames / 24 / 60);
    const pad = n => String(n).padStart(2, '0');
    if (tcOut) tcOut.textContent = `00:${pad(m)}:${pad(s)}:${pad(frames)}`;
  }

  function setPlayheadByClientX(clientX){
    const rect = tracks.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    playhead.style.left = pct + '%';
    updateTimecode(pct);
  }

  let dragging = false;
  playhead.addEventListener('pointerdown', (e) => { dragging = true; playhead.setPointerCapture(e.pointerId); });
  playhead.addEventListener('pointermove', (e) => { if (dragging) setPlayheadByClientX(e.clientX); });
  playhead.addEventListener('pointerup', () => { dragging = false; });
  playhead.addEventListener('pointercancel', () => { dragging = false; });

  tracks.addEventListener('pointerdown', (e) => {
    if (e.target === playhead || playhead.contains(e.target)) return;
    setPlayheadByClientX(e.clientX);
  });

  playhead.addEventListener('keydown', (e) => {
    const current = parseFloat(playhead.style.left) || 0;
    let next = current;
    if (e.key === 'ArrowLeft') next = Math.max(0, current - 2);
    else if (e.key === 'ArrowRight') next = Math.min(100, current + 2);
    else return;
    e.preventDefault();
    playhead.style.left = next + '%';
    updateTimecode(next);
  });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let idlePct = 22;
    let direction = 1;
    setInterval(() => {
      if (dragging) return;
      idlePct += direction * 0.15;
      if (idlePct > 92 || idlePct < 8) direction *= -1;
      playhead.style.left = idlePct + '%';
      updateTimecode(idlePct);
    }, 90);
  } else {
    updateTimecode(22);
  }
})();
