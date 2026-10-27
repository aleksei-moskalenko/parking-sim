// Overlay screens: menu, start prompt, pause, result.

import { LEVEL_NAMES } from '../sim/levels.js';
import { CAR_SPECS } from '../sim/cars.js';
import { formatFault } from '../sim/scoring.js';
import { isPassed } from '../progress.js';

const EXERCISES = { parallel: 'Параллельная парковка', garage: 'Гараж задним ходом' };

const CONTROLS = [
  ['W', 'газ'],
  ['S', 'тормоз'],
  ['A / D', 'руль — медленно, сам не возвращается'],
  ['1 2 3 4', 'P / R / N / D — стоя и с нажатым тормозом'],
  ['T', 'вид сверху'],
  ['H', 'траектории колёс'],
  ['мышь', 'смотреть по сторонам, клик — голову прямо'],
  ['Esc', 'пауза'],
];

const controlsHtml = () => `
  <dl class="controls">${CONTROLS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  <p class="muted">Заезд заканчивается, когда вы ставите P. Времени нет, но считается каждое касание.</p>`;

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createScreens(root) {
  const selection = { exercise: 'parallel', carId: 'sedan' };
  const show = (html) => { root.innerHTML = html; };
  const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);

  function showMenu({ onStart }) {
    const seg = (group, options, current) => `
      <div class="seg">${Object.entries(options).map(([v, label]) =>
        `<button data-group="${group}" data-value="${v}" class="${v === current ? 'on' : ''}">${label}</button>`).join('')}</div>`;
    const cars = Object.fromEntries(Object.values(CAR_SPECS).map((c) => [c.id, `${c.name} · ${c.length.toFixed(2)} м`]));
    show(`
      <div class="screen">
        <div class="card">
          <h1>Тренажёр парковки</h1>
          ${seg('exercise', EXERCISES, selection.exercise)}
          ${seg('carId', cars, selection.carId)}
          <div class="levels">${LEVEL_NAMES.map((name, i) => {
            const passed = isPassed(selection.exercise, selection.carId, i + 1);
            return `<button data-level="${i + 1}">${i + 1}. ${name}${passed ? ' <span class="ok">✓</span>' : ''}</button>`;
          }).join('')}</div>
          ${controlsHtml()}
        </div>
      </div>`);
    root.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
      selection[b.dataset.group] = b.dataset.value;
      showMenu({ onStart });
    }));
    root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => {
      onStart({ ...selection, level: Number(b.dataset.level) });
    }));
  }

  function showPrompt(config, { onClick }) {
    show(`
      <div class="prompt">
        <b>${EXERCISES[config.exercise]} · ${CAR_SPECS[config.carId].name} · ${config.level}. ${LEVEL_NAMES[config.level - 1]}</b>
        <p>Кликните, чтобы начать</p>
      </div>`);
    on('.prompt', onClick);
  }

  function showPause({ onResume, onRestart, onMenu }) {
    show(`
      <div class="screen">
        <div class="card narrow">
          <h2>Пауза</h2>
          <div class="actions">
            <button class="primary" data-a="resume">Продолжить</button>
            <button data-a="restart">Заново</button>
            <button data-a="menu">В меню</button>
          </div>
          ${controlsHtml()}
        </div>
      </div>`);
    on('[data-a="resume"]', onResume);
    on('[data-a="restart"]', onRestart);
    on('[data-a="menu"]', onMenu);
  }

  function showResult(result, config, { onRetry, onNext, onMenu }) {
    const counts = new Map();
    for (const f of result.faults) {
      const text = formatFault(f, config.exercise);
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    const faults = counts.size
      ? [...counts].map(([t, n]) => `<li>${escape(t)}${n > 1 ? ` × ${n}` : ''}</li>`).join('')
      : '<li class="ok">Ошибок нет</li>';
    const m = result.measures;
    const measures = [
      m.curbDistance !== undefined && `До бордюра: ${Math.round(m.curbDistance * 100)} см`,
      `Угол: ${m.angleDeg.toFixed(1)}°`,
      m.lateralOffset !== undefined && `Смещение от центра: ${Math.round(m.lateralOffset * 100)} см`,
      `Смен направления: ${result.directionChanges}`,
      result.hintsUsed && 'С подсказками',
    ].filter(Boolean);
    show(`
      <div class="screen see-through">
        <div class="card narrow">
          <h2 class="${result.passed ? 'ok' : 'bad'}">${result.passed ? 'Сдал' : 'Не сдал'}</h2>
          <p class="muted">${EXERCISES[config.exercise]} · ${CAR_SPECS[config.carId].name} · ${config.level}. ${LEVEL_NAMES[config.level - 1]}</p>
          <ul class="faults">${faults}</ul>
          <ul class="measures">${measures.map((s) => `<li>${s}</li>`).join('')}</ul>
          <div class="actions">
            <button class="primary" data-a="retry">Ещё раз</button>
            ${config.level < LEVEL_NAMES.length ? '<button data-a="next">Следующий уровень</button>' : ''}
            <button data-a="menu">Меню</button>
          </div>
        </div>
      </div>`);
    on('[data-a="retry"]', onRetry);
    on('[data-a="next"]', onNext);
    on('[data-a="menu"]', onMenu);
  }

  return { showMenu, showPrompt, showPause, showResult, hide: () => show('') };
}
