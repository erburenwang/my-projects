import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopology } from '../src/core/topology.mjs';
import { chooseMove } from '../src/core/ai.mjs';

const modelModule = await import('../src/core/topology-model.mjs').catch(() => null);

test('extracts 243 normalized five-cell pattern counters and six topology markers', () => {
  assert.ok(modelModule?.extractTopologyFeatures, 'topology feature extractor must exist');
  const topology = getTopology('cylinder');
  const board = new Map([[topology.cellAt(0, 2), 1], [topology.cellAt(1, 2), -1], [topology.cellAt(2, 2), 1]]);
  const features = modelModule.extractTopologyFeatures({ board }, topology, 1);

  assert.equal(features.length, 249);
  assert.equal(features.slice(0, 243).reduce((sum, value) => sum + value, 0), topology.linesOfFive.length);
  assert.equal(features.slice(243).filter(Boolean).length, 1);
  assert.equal(features[243], 1);
});

test('relative pattern features are invariant when the two colors and side to move swap', () => {
  assert.ok(modelModule?.extractTopologyFeatures, 'topology feature extractor must exist');
  const topology = getTopology('klein');
  const original = new Map([[topology.cellAt(0, 1), 1], [topology.cellAt(1, 1), -1], [topology.cellAt(2, 1), 1]]);
  const swapped = new Map([...original].map(([cellId, player]) => [cellId, -player]));
  const first = modelModule.extractTopologyFeatures({ board: original }, topology, 1);
  const second = modelModule.extractTopologyFeatures({ board: swapped }, topology, -1);

  assert.deepEqual(first, second);
});

test('canonical pattern buckets are direction independent and plane has no non-planar marker', () => {
  assert.ok(modelModule?.encodeFivePattern, 'five-cell pattern encoder must exist');
  const pattern = [1, 0, 2, 1, 0];
  assert.equal(modelModule.encodeFivePattern(pattern), modelModule.encodeFivePattern([...pattern].reverse()));
  const topology = getTopology('plane');
  const features = modelModule.extractTopologyFeatures({ board: new Map() }, topology, 1);
  assert.equal(features.slice(243).reduce((sum, value) => sum + value, 0), 0);
});

test('model inference returns finite values and rejects missing, incompatible, or nonfinite weights', () => {
  assert.ok(modelModule?.evaluateWithTopologyModel, 'topology model evaluator must exist');
  const model = {
    format: 'topology-evaluator-v1',
    inputSize: 249,
    hiddenSize: 2,
    inputWeights: Array(249 * 2).fill(0),
    hiddenBias: [0, 0],
    outputWeights: [0.25, -0.5],
    outputBias: 0.1,
  };
  const features = Array(249).fill(0);
  assert.equal(modelModule.evaluateWithTopologyModel(features, model), Math.tanh(0.1));
  assert.throws(() => modelModule.evaluateWithTopologyModel(features, null), /model/i);
  assert.throws(() => modelModule.evaluateWithTopologyModel(features, { ...model, inputSize: 248 }), /dimension|input/i);
  assert.throws(() => modelModule.evaluateWithTopologyModel(features, { ...model, outputBias: Infinity }), /finite|weight|bias/i);
});

test('experimental model evaluation can be selected explicitly and invalid models do not silently fall back', () => {
  const topology = getTopology('cylinder');
  const model = {
    format: 'topology-evaluator-v1',
    inputSize: 249,
    hiddenSize: 2,
    inputWeights: Array(249 * 2).fill(0),
    hiddenBias: [0, 0],
    outputWeights: [0, 0],
    outputBias: 0,
  };
  const result = chooseMove({ board: new Map(), toMove: 1 }, topology, { difficulty: 'casual', budgetMs: 2, evaluationModel: model });
  assert.ok(topology.cells.includes(result.cellId));
  assert.throws(() => chooseMove({ board: new Map(), toMove: 1 }, topology, { evaluationModel: { ...model, inputSize: 248 } }), /dimension|input/i);
});
