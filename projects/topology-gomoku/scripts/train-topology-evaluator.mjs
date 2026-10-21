import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { TOPOLOGY_FEATURE_SIZE, WINDOW_PATTERN_COUNT } from '../src/core/topology-model.mjs';

function parseArguments(argv) {
  const values = new Map();
  for (const item of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (match) values.set(match[1], match[2] ?? 'true');
  }
  return values;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function prepareFeatures(features) {
  if (!Array.isArray(features) || features.length !== TOPOLOGY_FEATURE_SIZE || features.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('训练样本必须包含 249 个有限非负特征');
  }
  const normalized = new Float64Array(TOPOLOGY_FEATURE_SIZE);
  let windowCount = 0;
  for (let index = 0; index < WINDOW_PATTERN_COUNT; index += 1) windowCount += features[index];
  const divisor = Math.log1p(Math.max(1, windowCount));
  for (let index = 0; index < WINDOW_PATTERN_COUNT; index += 1) normalized[index] = Math.log1p(features[index]) / divisor;
  for (let index = WINDOW_PATTERN_COUNT; index < TOPOLOGY_FEATURE_SIZE; index += 1) normalized[index] = features[index];
  return normalized;
}

function forward(features, model) {
  const hidden = new Float64Array(model.hiddenSize);
  for (let unit = 0; unit < model.hiddenSize; unit += 1) {
    const offset = unit * TOPOLOGY_FEATURE_SIZE;
    let value = model.hiddenBias[unit];
    for (let feature = 0; feature < TOPOLOGY_FEATURE_SIZE; feature += 1) value += model.inputWeights[offset + feature] * features[feature];
    hidden[unit] = Math.tanh(value);
  }
  let output = model.outputBias;
  for (let unit = 0; unit < model.hiddenSize; unit += 1) output += model.outputWeights[unit] * hidden[unit];
  return { prediction: Math.tanh(output), hidden };
}

function loss(samples, model) {
  if (!samples.length) return null;
  let total = 0;
  for (const sample of samples) {
    const { prediction } = forward(sample.features, model);
    const difference = prediction - sample.label;
    total += difference * difference;
  }
  return total / samples.length;
}

function trainOne(sample, model, learningRate) {
  const { prediction, hidden } = forward(sample.features, model);
  const outputDelta = (prediction - sample.label) * (1 - prediction * prediction);
  const hiddenDeltas = new Float64Array(model.hiddenSize);
  for (let unit = 0; unit < model.hiddenSize; unit += 1) {
    const activation = hidden[unit];
    hiddenDeltas[unit] = outputDelta * model.outputWeights[unit] * (1 - activation * activation);
    model.outputWeights[unit] -= learningRate * outputDelta * activation;
  }
  model.outputBias -= learningRate * outputDelta;
  for (let unit = 0; unit < model.hiddenSize; unit += 1) {
    const offset = unit * TOPOLOGY_FEATURE_SIZE;
    model.hiddenBias[unit] -= learningRate * hiddenDeltas[unit];
    for (let feature = 0; feature < TOPOLOGY_FEATURE_SIZE; feature += 1) {
      model.inputWeights[offset + feature] -= learningRate * hiddenDeltas[unit] * sample.features[feature];
    }
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const inputPath = resolve(args.get('input') ?? 'work/topology-training-data.jsonl');
  const outputPath = resolve(args.get('output') ?? 'work/topology-evaluator-trained.json');
  const epochs = Math.max(1, Math.min(200, Number(args.get('epochs') ?? '12')));
  const seed = Number(args.get('seed') ?? '20261018');
  const text = await readFile(inputPath, 'utf8');
  const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const train = [];
  const validation = [];
  const trainSeeds = new Set();
  const validationSeeds = new Set();
  for (const record of records) {
    if (!Number.isFinite(record.label) || record.label < -1 || record.label > 1) throw new Error('训练样本标签必须位于 -1 到 1');
    const sample = { features: prepareFeatures(record.features), label: record.label };
    if (record.split === 'validation') {
      validation.push(sample);
      validationSeeds.add(record.openingSeed);
    } else if (record.split === 'train') {
      train.push(sample);
      trainSeeds.add(record.openingSeed);
    } else throw new Error(`未知数据集拆分：${record.split}`);
  }
  if (!train.length || !validation.length) throw new Error('训练集和验证集都必须至少包含一个开局种子样本');
  for (const trainingSeed of trainSeeds) if (validationSeeds.has(trainingSeed)) throw new Error(`开局种子 ${trainingSeed} 同时出现在训练集与验证集`);

  const hiddenSize = 64;
  const random = seededRandom(seed);
  const limit = Math.sqrt(6 / (TOPOLOGY_FEATURE_SIZE + hiddenSize));
  const model = {
    hiddenSize,
    inputWeights: Array.from({ length: TOPOLOGY_FEATURE_SIZE * hiddenSize }, () => (random() * 2 - 1) * limit),
    hiddenBias: Array(hiddenSize).fill(0),
    outputWeights: Array.from({ length: hiddenSize }, () => (random() * 2 - 1) * 0.08),
    outputBias: 0,
  };
  const validationBefore = loss(validation, model);
  const learningRate = Number(args.get('learning-rate') ?? '0.004');
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const order = train.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    for (const index of order) trainOne(train[index], model, learningRate);
    console.log(`epoch ${epoch + 1}/${epochs} train_mse=${loss(train, model).toFixed(6)} validation_mse=${loss(validation, model).toFixed(6)}`);
  }
  const output = {
    format: 'topology-evaluator-v1',
    version: 1,
    inputSize: TOPOLOGY_FEATURE_SIZE,
    hiddenSize,
    normalization: 'log1p-window-frequency-v1',
    inputWeights: model.inputWeights,
    hiddenBias: model.hiddenBias,
    outputWeights: model.outputWeights,
    outputBias: model.outputBias,
    metadata: {
      trainedAt: new Date().toISOString(),
      seed,
      epochs,
      learningRate,
      source: 'terminal outcomes from deterministic self-play using the topology-native search teacher',
      trainSamples: train.length,
      validationSamples: validation.length,
      trainOpeningSeeds: trainSeeds.size,
      validationOpeningSeeds: validationSeeds.size,
      validationMseBefore: validationBefore,
      validationMseAfter: loss(validation, model),
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`模型已写入 ${outputPath}；样本 ${train.length} / ${validation.length}，验证 MSE ${validationBefore.toFixed(6)} → ${output.metadata.validationMseAfter.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
