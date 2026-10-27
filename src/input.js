// Keyboard state read by physical key position (event.code), so it works with
// any layout, including Russian.

const HELD = { KeyW: 'throttle', KeyS: 'brake', KeyA: 'left', KeyD: 'right' };
const PRESS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyT', 'KeyH']);

export function createInput(target = window) {
  const state = { throttle: false, brake: false, left: false, right: false };
  const handlers = [];

  const releaseAll = () => {
    for (const k of Object.keys(state)) state[k] = false;
  };
  const onDown = (e) => {
    if (HELD[e.code]) {
      state[HELD[e.code]] = true;
      e.preventDefault?.();
    } else if (PRESS.has(e.code) && !e.repeat) {
      for (const h of handlers) h(e.code);
    }
  };
  const onUp = (e) => {
    if (HELD[e.code]) state[HELD[e.code]] = false;
  };

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', releaseAll);

  return {
    state,
    onKey: (h) => handlers.push(h),
    releaseAll,
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', releaseAll);
    },
  };
}
