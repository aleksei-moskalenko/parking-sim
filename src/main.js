// Bootstrap: load models once, then menu → run → result.
// URL ?ex=garage&level=3&car=minivan starts that run directly.

import { loadModels } from './render/models.js';
import { startRun } from './app.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { markPassed } from './progress.js';
import { CAR_SPECS } from './sim/cars.js';

const overlay = document.getElementById('overlay');
const hud = createHud(document.getElementById('hud'));
const screens = createScreens(overlay);
let run = null;
let models = null;

const ui = {
  onReady: () => screens.hide(),
  onResume: () => screens.hide(),
  onPause: (r) => screens.showPause({
    onResume: () => r.lock(),
    onRestart: () => start(r.config),
    onMenu: menu,
  }),
  onFinish: (r) => {
    const { result } = r.session;
    if (result.passed) markPassed(r.config.exercise, r.config.carId, r.config.level);
    screens.showResult(result, r.config, {
      onRetry: () => start(r.config),
      onNext: () => start({ ...r.config, level: r.config.level + 1 }),
      onMenu: menu,
    });
  },
};

function stopRun() {
  run?.stop();
  run = null;
  window.run = null;
}

function start(config) {
  stopRun();
  run = startRun(config, { models, hud, ui });
  window.run = run;
}

function menu() {
  stopRun();
  hud.show(false);
  screens.showMenu({ onStart: start });
}

overlay.innerHTML = '<div class="screen"><div class="card narrow"><p>Загрузка моделей…</p></div></div>';
models = await loadModels();

const params = new URLSearchParams(location.search);
const level = Number(params.get('level'));
if (params.get('ex') in { parallel: 1, garage: 1 } && level >= 1 && level <= 6) {
  start({ exercise: params.get('ex'), level, carId: CAR_SPECS[params.get('car')] ? params.get('car') : 'sedan' });
} else {
  menu();
}
