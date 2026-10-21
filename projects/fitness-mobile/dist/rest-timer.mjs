function restTimerDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function restTimerDuration(value) {
  return [60, 90, 120].includes(value);
}

/** Compound exercises use two minutes; the other supplied guidance uses ninety seconds. */
export function defaultRestSeconds(exercise) {
  return exercise?.rest === '2分钟' ? 120 : 90;
}

export function newRestTimer({ date, exerciseId, label, seconds }, now = Date.now()) {
  const duration = restTimerDuration(seconds) ? seconds : 90;
  return { date, exerciseId, label, duration, remaining: duration,
    endAt: now + duration * 1000, status: 'running' };
}

/** Deadline-based state remains accurate after background tab throttling. */
export function restTimerState(timer, now = Date.now()) {
  if (!timer) return null;
  if (timer.status !== 'running') return { ...timer };
  const remaining = Math.max(0, Math.min(timer.duration, Math.ceil((timer.endAt - now) / 1000)));
  return { ...timer, remaining, endAt: remaining ? timer.endAt : null,
    status: remaining ? 'running' : 'finished' };
}

export function pauseRestTimer(timer, now = Date.now()) {
  const state = restTimerState(timer, now);
  return state?.status === 'running' ? { ...state, endAt: null, status: 'paused' } : state;
}

export function resumeRestTimer(timer, now = Date.now()) {
  const state = restTimerState(timer, now);
  return state && ['paused', 'idle'].includes(state.status)
    ? { ...state, endAt: now + state.remaining * 1000, status: 'running' } : state;
}

export function resetRestTimer(timer, now = Date.now()) {
  const state = restTimerState(timer, now);
  return state ? { ...state, remaining: state.duration, endAt: null, status: 'idle' } : null;
}

/** Session-storage data is untrusted; return a whitelisted canonical state or null. */
export function restoreRestTimer(value, now = Date.now()) {
  let timer = value;
  if (typeof timer === 'string') {
    try { timer = JSON.parse(timer); } catch { return null; }
  }
  if (!timer || typeof timer !== 'object' || Array.isArray(timer)
    || !restTimerDate(timer.date) || typeof timer.exerciseId !== 'string'
    || !/^[a-z][a-z0-9_-]{0,63}$/.test(timer.exerciseId)
    || typeof timer.label !== 'string' || !timer.label.length || timer.label.length > 80
    || !restTimerDuration(timer.duration) || !Number.isInteger(timer.remaining)
    || timer.remaining < 0 || timer.remaining > timer.duration
    || !['idle', 'running', 'paused', 'finished'].includes(timer.status)) return null;
  if (timer.status === 'running') {
    if (!Number.isFinite(timer.endAt) || timer.endAt < 0) return null;
  } else if (timer.endAt !== null
    || timer.status === 'paused' && timer.remaining === 0
    || timer.status === 'idle' && timer.remaining !== timer.duration
    || timer.status === 'finished' && timer.remaining !== 0) return null;
  return restTimerState({ date: timer.date, exerciseId: timer.exerciseId, label: timer.label,
    duration: timer.duration, remaining: timer.remaining, endAt: timer.endAt, status: timer.status }, now);
}
