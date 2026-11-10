/* Browser / Node shared, with no dependency on the DOM or the current clock. */
(function (root, factory) {
  const calculator = factory();
  if (typeof module === 'object' && module.exports) module.exports = calculator;
  else root.HpwrCalculator = calculator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_HP = 480;
  const WATER_COST = 10;
  const DAY_END = 24 * 60;

  class InputError extends Error {
    constructor(field, message) {
      super(message);
      this.name = 'InputError';
      this.field = field;
    }
  }

  function parseTime(value, field = 'current') {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new InputError(field, field === 'future'
        ? '水やり予定時刻を00:00〜23:59で入力してください。'
        : '確認した時刻を00:00〜23:59で入力してください。');
    }
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function formatTime(minutes) {
    if (!Number.isInteger(minutes) || minutes < 0) throw new RangeError('時刻は0以上の整数で指定してください。');
    if (minutes === DAY_END) return '24:00';
    const days = Math.floor(minutes / DAY_END);
    const inDay = minutes % DAY_END;
    const time = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
    return `${days === 0 ? '' : days === 1 ? '翌日 ' : `${days}日後 `}${time}`;
  }

  function calculatePlan({ hp, currentTime, mode = 'now', wateringTime } = {}) {
    // Reject empty strings, fractions and non-decimal representations instead of rounding/clamping.
    const value = typeof hp === 'string' && /^\d+$/.test(hp.trim()) ? Number(hp.trim()) : hp;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_HP) {
      throw new InputError('hp', 'HPwrは0〜480の整数で入力してください。');
    }
    const start = parseTime(currentTime);
    if (mode !== 'now' && mode !== 'scheduled') throw new InputError('mode', '水やりの方法を選んでください。');
    const action = mode === 'scheduled' ? parseTime(wateringTime, 'future') : start;
    if (action < start) throw new InputError('future', '予定時刻は、確認した時刻以降にしてください。翌日の指定はできません。');
    const elapsed = action - start;
    const before = Math.min(MAX_HP, value + elapsed);
    const remainingMinutes = DAY_END - action;
    // Largest affordable count whose midnight balance is still 480.
    // If 480 is unreachable even without watering, preserve all available HPwr.
    const requiredAtAction = Math.max(0, MAX_HP - remainingMinutes);
    const count = Math.max(0, Math.floor((before - requiredAtAction) / WATER_COST));
    const after = before - count * WATER_COST;
    const ending = Math.min(MAX_HP, after + remainingMinutes);
    const wasteBefore = Math.max(0, value + elapsed - MAX_HP);
    const wasteAfter = Math.max(0, after + remainingMinutes - MAX_HP);
    return {
      start, action, remainingMinutes, before, after, count,
      used: count * WATER_COST, ending, reachesTarget: ending === MAX_HP,
      wasteBefore, wasteAfter, wasteTotal: wasteBefore + wasteAfter,
      fullWithoutWater: start + MAX_HP - value,
      fullAfterWater: action + MAX_HP - after,
    };
  }
  return Object.freeze({ MAX_HP, WATER_COST, DAY_END, InputError, parseTime, formatTime, calculatePlan });
});
