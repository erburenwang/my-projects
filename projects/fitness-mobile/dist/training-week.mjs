import { addDays } from './core.mjs';
import { programPlan } from './program.mjs';
import { EXERCISES, exercisePlan } from './training.mjs';
import { sessionStats } from './training-stats.mjs';

function trainingWeekType(value) {
  return ['UA', 'LA', 'UB', 'LB', 'A', 'B'].includes(value);
}

function trainingWeekLevel(value) {
  return Number.isInteger(value) && value >= 1 && value <= 3;
}

/** Rebuild trusted instructions while retaining only the historical target fields. */
export function plannedExercises(day = {}, plan = {}) {
  if (Array.isArray(day?.trainingPlan)) {
    const seen = new Set();
    return day.trainingPlan.flatMap(ex => {
      if (!ex || !Object.hasOwn(EXERCISES, ex.id) || seen.has(ex.id)
        || typeof ex.name !== 'string' || !ex.name.length || ex.name.length > 80
        || !trainingWeekLevel(ex.sets) || !Number.isInteger(ex.min) || ex.min < 1
        || !Number.isInteger(ex.max) || ex.max < ex.min || ex.max > 100) return [];
      seen.add(ex.id);
      return [{ ...EXERCISES[ex.id], id: ex.id, name: ex.name,
        sets: ex.sets, min: ex.min, max: ex.max }];
    });
  }
  const type = trainingWeekType(day?.workoutType) ? day.workoutType
    : plan?.active && trainingWeekType(plan.type) ? plan.type : '';
  const level = trainingWeekLevel(day?.setLevel) ? day.setLevel
    : plan?.active && trainingWeekLevel(plan.sets) ? plan.sets : 3;
  return type ? exercisePlan(type, level) : [];
}

function trainingWeekHasRecords(day) {
  return Object.values(day?.sets || {}).some(records => Array.isArray(records)
    && records.some(set => set && typeof set === 'object' && !Array.isArray(set)
      && (set.done === true || set.skipped === true
        || ['kg', 'reps', 'rir'].some(key => set[key] !== undefined
          && set[key] !== null && set[key] !== ''))));
}

/** Calendar-week totals count actual completed sets and preserve records across pauses. */
export function trainingWeekStats(days, selectedDate, program, todayDate = selectedDate) {
  const monday = addDays(selectedDate, -((new Date(`${selectedDate}T00:00:00Z`).getUTCDay() + 6) % 7));
  const result = { monday, end: addDays(monday, 6), plannedSessions: 0, trainedSessions: 0,
    completedSessions: 0, plannedSets: 0, completedSets: 0, skippedSets: 0,
    totalReps: 0, loadReps: 0, percent: 0, rows: [] };
  for (let index = 0; index < 7; index++) {
    const date = addDays(monday, index), day = days?.[date] || {};
    const plan = programPlan(date, program);
    const hasRecords = trainingWeekHasRecords(day);
    const scheduled = plan.active && trainingWeekType(plan.type);
    const exercises = scheduled || hasRecords ? plannedExercises(day, plan) : [];
    const stats = sessionStats(exercises, day);
    const complete = stats.plannedSets > 0 && stats.completedSets === stats.plannedSets;
    const status = complete ? 'completed' : stats.completedSets > 0 ? 'trained'
      : hasRecords && stats.plannedSets > 0 ? 'recorded'
        : stats.plannedSets > 0 ? date < todayDate ? 'unrecorded' : 'pending'
          : plan.status === 'paused' ? 'paused' : 'rest';
    const row = { date, type: exercises.length
      ? trainingWeekType(day.workoutType) ? day.workoutType : plan.type : '',
    plannedSets: stats.plannedSets, completedSets: stats.completedSets,
    skippedSets: stats.skippedSets, totalReps: stats.totalReps,
    loadReps: stats.loadReps, percent: stats.percent, status };
    result.rows.push(row);
    if (stats.plannedSets > 0) result.plannedSessions++;
    if (stats.completedSets > 0) result.trainedSessions++;
    if (complete) result.completedSessions++;
    for (const key of ['plannedSets', 'completedSets', 'skippedSets', 'totalReps', 'loadReps']) result[key] += row[key];
  }
  result.percent = result.plannedSets ? Math.round(result.completedSets / result.plannedSets * 100) : 0;
  return result;
}
