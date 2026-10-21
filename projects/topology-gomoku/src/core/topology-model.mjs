import { TOPOLOGY_IDS } from './topology.mjs';

export const TOPOLOGY_FEATURE_SIZE = 249;
export const WINDOW_PATTERN_COUNT = 243;
export const MODEL_TOPOLOGY_IDS = TOPOLOGY_IDS.filter((id) => id !== 'plane');

const POWERS_OF_THREE = [1, 3, 9, 27, 81];
const NORMALIZATION_LOG = Math.log1p(256);

export function encodeFivePattern(pattern) {
  if (!Array.isArray(pattern) || pattern.length !== 5) throw new TypeError('pattern must contain five cells');
  let forward = 0;
  let reverse = 0;
  for (let index = 0; index < 5; index += 1) {
    const value = pattern[index];
    if (!Number.isInteger(value) || value < 0 || value > 2) throw new TypeError('pattern cells must be 0, 1, or 2');
    forward += value * POWERS_OF_THREE[index];
    reverse += value * POWERS_OF_THREE[4 - index];
  }
  return Math.min(forward, reverse);
}

export function extractTopologyFeatures(position, topology, player = position?.toMove ?? 1) {
  const board = position instanceof Map ? position : position?.board;
  if (!(board instanceof Map)) throw new TypeError('position must contain a board Map');
  if (!topology || !Array.isArray(topology.linesOfFive)) throw new TypeError('a topology with five-cell windows is required');
  if (player !== 1 && player !== -1) throw new TypeError('player must be 1 or -1');

  const features = Array(TOPOLOGY_FEATURE_SIZE).fill(0);
  for (const line of topology.linesOfFive) {
    const pattern = line.cells.map((cellId) => {
      const occupant = board.get(cellId);
      if (occupant === player) return 1;
      if (occupant === -player) return 2;
      return 0;
    });
    features[encodeFivePattern(pattern)] += 1;
  }

  const topologyIndex = MODEL_TOPOLOGY_IDS.indexOf(topology.id);
  if (topologyIndex >= 0) features[WINDOW_PATTERN_COUNT + topologyIndex] = 1;
  return features;
}

function validateModel(model) {
  if (!model || typeof model !== 'object') throw new TypeError('model is required');
  if (model.format !== 'topology-evaluator-v1') throw new Error('model format is incompatible');
  if (model.inputSize !== TOPOLOGY_FEATURE_SIZE) throw new Error('model input dimension must be 249');
  const hiddenSize = model.hiddenSize;
  if (!Number.isInteger(hiddenSize) || hiddenSize < 1 || hiddenSize > 1024) throw new Error('model hidden dimension is invalid');
  const expected = {
    inputWeights: TOPOLOGY_FEATURE_SIZE * hiddenSize,
    hiddenBias: hiddenSize,
    outputWeights: hiddenSize,
  };
  for (const [name, length] of Object.entries(expected)) {
    if (!Array.isArray(model[name]) || model[name].length !== length) throw new Error(`model ${name} has an invalid dimension`);
    if (!model[name].every(Number.isFinite)) throw new Error(`model ${name} contains a nonfinite weight`);
  }
  if (!Number.isFinite(model.outputBias)) throw new Error('model output bias must be finite');
  return model;
}

function normalizeFeatures(features) {
  const normalized = Array(TOPOLOGY_FEATURE_SIZE).fill(0);
  const windowCount = Math.max(1, features.slice(0, WINDOW_PATTERN_COUNT).reduce((sum, value) => sum + value, 0));
  const scale = Math.log1p(windowCount) || NORMALIZATION_LOG;
  for (let index = 0; index < WINDOW_PATTERN_COUNT; index += 1) {
    normalized[index] = Math.log1p(features[index]) / scale;
  }
  for (let index = WINDOW_PATTERN_COUNT; index < TOPOLOGY_FEATURE_SIZE; index += 1) normalized[index] = features[index];
  return normalized;
}

function inferValidated(features, model) {
  if (!Array.isArray(features) && !ArrayBuffer.isView(features)) throw new TypeError('features must be an array');
  if (features.length !== TOPOLOGY_FEATURE_SIZE) throw new Error('feature dimension must be 249');
  for (const value of features) if (!Number.isFinite(value) || value < 0) throw new Error('features must contain finite nonnegative values');

  const normalized = normalizeFeatures(features);
  const hidden = Array(model.hiddenSize);
  for (let unit = 0; unit < model.hiddenSize; unit += 1) {
    const offset = unit * TOPOLOGY_FEATURE_SIZE;
    let value = model.hiddenBias[unit];
    for (let feature = 0; feature < TOPOLOGY_FEATURE_SIZE; feature += 1) {
      value += model.inputWeights[offset + feature] * normalized[feature];
    }
    hidden[unit] = Math.tanh(value);
  }
  let output = model.outputBias;
  for (let unit = 0; unit < model.hiddenSize; unit += 1) output += model.outputWeights[unit] * hidden[unit];
  const result = Math.tanh(output);
  if (!Number.isFinite(result)) throw new Error('model returned a nonfinite evaluation');
  return result;
}

export function evaluateWithTopologyModel(features, model) {
  return inferValidated(features, validateModel(model));
}

export function createTopologyModelScorer(model) {
  const validated = validateModel(model);
  return (position, topology, player = position?.toMove ?? 1) =>
    inferValidated(extractTopologyFeatures(position, topology, player), validated);
}
