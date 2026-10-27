import { loadModels } from './render/models.js';
import { startRun } from './app.js';

const params = new URLSearchParams(location.search);
const models = await loadModels();
window.run = startRun({
  exercise: params.get('ex') ?? 'parallel',
  level: Number(params.get('level') ?? 1),
  carId: params.get('car') ?? 'sedan',
}, { models });
