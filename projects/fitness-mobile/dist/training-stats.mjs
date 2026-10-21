const missing = value => value === undefined || value === null || value === '';
const inRange = (value, min, max) => typeof value === 'number'
  && Number.isFinite(value) && value >= min && value <= max;
const validReps = value => Number.isInteger(value) && inRange(value, 1, 100);
const recordObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const completedSet = value => isValidTrainingSet(value) && value.done === true && value.skipped !== true;
const percent = (completed, planned) => planned ? Math.round(completed / planned * 100) : 0;
const countFields = ['plannedSets', 'completedSets', 'recordedSets', 'skippedSets',
  'totalReps', 'loadReps', 'targetMetSets', 'partialRecords'];
const emptyCounts = () => Object.fromEntries(countFields.map(key => [key, 0]));

/** Recorded numbers are validated independently of the completion checkbox. */
export function isValidTrainingSet(set) {
  return recordObject(set) && inRange(set.kg, 0, 500) && validReps(set.reps)
    && (missing(set.rir) || inRange(set.rir, 0, 10));
}

/** Only planned, valid, explicitly completed and unskipped rows add actual work. */
export function exerciseStats(exercise, records = []) {
  const result = { ...emptyCounts(), percent: 0, rows: [], extraCompletedSets: 0 };
  const source = Array.isArray(records) ? records : [];
  result.plannedSets = Number.isInteger(exercise?.sets) && exercise.sets > 0 ? exercise.sets : 0;

  for (let index = 0; index < result.plannedSets; index++) {
    const set = source[index];
    const object = recordObject(set);
    const valid = isValidTrainingSet(set);
    const skipped = object && set.skipped === true;
    const completed = completedSet(set);
    const targetMet = completed && Number.isFinite(exercise?.min) && set.reps >= exercise.min;
    const filled = object
      ? ['kg', 'reps', 'rir'].some(key => !missing(set[key])) || set.done === true
      : !missing(set);
    const malformed = object
      ? (!missing(set.kg) && !inRange(set.kg, 0, 500))
        || (!missing(set.reps) && !validReps(set.reps))
        || (!missing(set.rir) && !inRange(set.rir, 0, 10))
      : filled;
    const status = skipped ? 'skipped' : completed ? 'completed' : valid ? 'recorded'
      : !filled ? 'empty' : malformed ? 'invalid' : 'partial';

    result.rows.push({
      index, status, valid, completed, targetMet,
      reps: valid ? set.reps : null,
      loadReps: valid ? set.kg * set.reps : null,
    });
    if (valid) result.recordedSets++;
    if (skipped) result.skippedSets++;
    if (!valid && filled) result.partialRecords++;
    if (completed) {
      result.completedSets++;
      result.totalReps += set.reps;
      result.loadReps += set.kg * set.reps;
    }
    if (targetMet) result.targetMetSets++;
  }

  result.percent = percent(result.completedSets, result.plannedSets);
  result.extraCompletedSets = source.slice(result.plannedSets).filter(completedSet).length;
  return result;
}

/** Session percentage uses all planned sets, rather than averaging exercise percentages. */
export function sessionStats(exercises = [], day = {}) {
  const planned = Array.isArray(exercises) ? exercises : [];
  const result = {
    ...emptyCounts(), percent: 0, completedExercises: 0,
    totalExercises: planned.length, exercises: {},
  };
  for (const exercise of planned) {
    const stats = exerciseStats(exercise, day?.sets?.[exercise.id]);
    result.exercises[exercise.id] = stats;
    for (const key of countFields) result[key] += stats[key];
    if (stats.plannedSets > 0 && stats.completedSets === stats.plannedSets) result.completedExercises++;
  }
  result.percent = percent(result.completedSets, result.plannedSets);
  return result;
}

function actualDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A prior session can supply a comparison even when that exercise was only partly completed. */
export function previousExercise(days, beforeDate, id) {
  if (!actualDate(beforeDate)) return null;
  const dates = Object.keys(days || {}).filter(date => actualDate(date) && date < beforeDate).sort().reverse();
  for (const date of dates) {
    const records = days[date]?.sets?.[id];
    const sets = Array.isArray(records) ? records.filter(completedSet) : [];
    if (!sets.length) continue;
    return {
      date, sets,
      totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
      loadReps: sets.reduce((sum, set) => sum + set.kg * set.reps, 0),
    };
  }
  return null;
}
