import { loadModels } from './render/models.js';
import { startRun } from './app.js';
import { createHud } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const overlay = document.getElementById('overlay');
const hud = createHud(document.getElementById('hud'));
const prompt = (text) => { overlay.innerHTML = text ? `<div class="prompt">${text}</div>` : ''; };

const ui = {
  onReady: () => prompt('Кликните по экрану, чтобы начать'),
  onResume: () => prompt(''),
  onPause: () => prompt('Пауза — кликните по экрану, чтобы продолжить'),
  onFinish: (run) => prompt(run.session.result.passed ? 'Сдал' : 'Не сдал'),
};

overlay.addEventListener('click', () => window.run?.lock());

const models = await loadModels();
window.run = startRun({
  exercise: params.get('ex') ?? 'parallel',
  level: Number(params.get('level') ?? 1),
  carId: params.get('car') ?? 'sedan',
}, { models, hud, ui });
