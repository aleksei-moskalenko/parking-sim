// Minimal driving HUD: gear, speed, road-wheel angle, hint toggles, messages.

const MESSAGE_MS = 2500;
const FLASH_MS = 350;

export function createHud(root) {
  root.innerHTML = `
    <div class="hud-flash"></div>
    <div class="hud-msg"></div>
    <div class="hud-hints">
      <span data-hint="top">T — вид сверху</span>
      <span data-hint="trajectories">H — траектории</span>
      <span data-view="mirrors">M — зеркала на экране</span>
      <span data-view="mouse">Клик — обзор мышью</span>
    </div>
    <div class="hud-panel">
      <div class="hud-gears">${['P', 'R', 'N', 'D'].map((g) => `<span data-gear="${g}">${g}</span>`).join('')}</div>
      <div class="hud-speed"><b>0</b> км/ч</div>
      <div class="hud-steer">
        <div class="hud-steer-bar"><div class="hud-steer-needle"></div></div>
        <span class="hud-steer-text">колёса 0°</span>
      </div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const gears = [...root.querySelectorAll('[data-gear]')];
  const hints = [...root.querySelectorAll('[data-hint]')];
  const mirrorsToggle = root.querySelector('[data-view="mirrors"]');
  const mouseHint = root.querySelector('[data-view="mouse"]');
  const speed = $('.hud-speed b'), needle = $('.hud-steer-needle'), steerText = $('.hud-steer-text');
  const msg = $('.hud-msg'), flashEl = $('.hud-flash');
  let msgTimer = 0, flashTimer = 0, audio = null;

  return {
    show(on) { root.hidden = !on; },
    update(session, view = {}) {
      mirrorsToggle.classList.toggle('on', !!view.screenMirrors);
      mouseHint.hidden = !!view.mouseLook;
      const v = session.vehicle;
      for (const g of gears) g.classList.toggle('on', g.dataset.gear === v.gear);
      for (const h of hints) h.classList.toggle('on', session.hints[h.dataset.hint]);
      speed.textContent = Math.round(Math.abs(v.speed) * 3.6);
      const max = session.spec.maxSteerDeg;
      const deg = v.steer * 180 / Math.PI;
      // Left is drawn on the left of the bar.
      needle.style.left = `${50 - (deg / max) * 50}%`;
      const arrow = Math.abs(deg) < 0.5 ? '' : deg > 0 ? ' ←' : ' →';
      steerText.textContent = `колёса ${Math.abs(Math.round(deg))}°${arrow}`;
    },
    message(text, ms = MESSAGE_MS) {
      msg.textContent = text;
      msg.classList.add('on');
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => msg.classList.remove('on'), ms);
    },
    flash() {
      flashEl.classList.add('on');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => flashEl.classList.remove('on'), FLASH_MS);
    },
    beep() {
      try {
        audio ??= new AudioContext();
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.frequency.value = 220;
        gain.gain.setValueAtTime(0.25, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
        osc.connect(gain).connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.15);
      } catch {
        // No audio available: the red flash is enough.
      }
    },
  };
}
