const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePlan, parseTime, formatTime, InputError } = require('../calculator.js');

function plan(hp, currentTime, wateringTime) {
  return calculatePlan({ hp, currentTime, mode: wateringTime === undefined ? 'now' : 'scheduled', wateringTime });
}

const examples = [
  ['今すぐ・ちょうど無駄なし', 480, '20:00', undefined, { count: 24, before: 480, after: 240, ending: 480, wasteTotal: 0 }],
  ['指定時刻まで回復してから消費', 300, '18:00', '21:00', { count: 18, before: 480, after: 300, ending: 480, wasteTotal: 0 }],
  ['予定時刻より前の上限超過', 470, '18:00', '21:00', { count: 18, before: 480, wasteBefore: 170, wasteAfter: 0 }],
  ['端数を切り上げない', 475, '23:00', undefined, { count: 5, after: 425, ending: 480, wasteAfter: 5 }],
  ['回復だけでちょうど480', 420, '23:00', undefined, { count: 0, ending: 480, wasteAfter: 0 }],
  ['回復が1不足しても消費しない', 419, '23:00', undefined, { count: 0, ending: 479, reachesTarget: false }],
  ['残量0・深夜直前', 0, '23:59', undefined, { count: 0, ending: 1, fullAfterWater: 1919 }],
  ['満タン・深夜直前', 480, '23:59', undefined, { count: 0, ending: 480, wasteAfter: 1 }],
  ['10分で1回復分の水やり', 480, '23:50', undefined, { count: 1, after: 470, ending: 480, wasteTotal: 0 }],
  ['8時間ちょうど前', 480, '16:00', undefined, { count: 48, after: 0, ending: 480, wasteTotal: 0 }],
  ['早朝・手持ち以上は消費しない', 25, '08:00', undefined, { count: 2, after: 5, ending: 480, wasteAfter: 485 }],
  ['残量が10未満', 9, '00:00', undefined, { count: 0, before: 9, ending: 480, wasteAfter: 969 }],
  ['午前0時は当日の開始', 480, '00:00', undefined, { count: 48, after: 0, wasteAfter: 960 }],
  ['同じ時刻の指定', 300, '18:00', '18:00', { count: 18, after: 120, wasteTotal: 0 }],
  ['予定時刻までに回復しても届かない', 0, '23:00', '23:30', { count: 0, before: 30, ending: 60, reachesTarget: false }],
];
for (const [name, hp, currentTime, wateringTime, expected] of examples) {
  test(name, () => {
    const result = plan(hp, currentTime, wateringTime);
    for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, key);
  });
}

test('HPwrの空欄・範囲外・小数・非数値を拒否', () => {
  for (const hp of ['', ' ', -1, 481, 0.1, NaN, Infinity, null, undefined, true, {}, [], '1e2', '0x10', '1.5', 'abc']) {
    assert.throws(() => plan(hp, '20:00'), error => error instanceof InputError && error.field === 'hp');
  }
  assert.equal(plan(' 480 ', '20:00').count, 24);
  assert.equal(plan('0', '00:00').before, 0);
});

test('不正な時刻・日をまたぐ予約を拒否', () => {
  for (const value of ['', '24:00', '23:60', '1:00', '12:1', '-1:00', '12:00:00', null, undefined]) {
    assert.throws(() => parseTime(value), InputError);
    assert.throws(() => plan(480, '18:00', value === undefined ? '' : value), error => error.field === 'future');
  }
  assert.throws(() => plan(480, '21:00', '20:59'), error => error.field === 'future');
  assert.throws(() => plan(480, '23:00', '00:00'), error => error.field === 'future');
  assert.throws(() => calculatePlan({ hp: 480, currentTime: '20:00', mode: 'unknown' }), error => error.field === 'mode');
});

test('予定を使わないモードでは古い予定値を無視', () => {
  assert.equal(calculatePlan({ hp: 480, currentTime: '20:00', wateringTime: '不正な値' }).count, 24);
});

test('満タン時刻は24:00と翌日を区別', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(1439), '23:59');
  assert.equal(formatTime(1440), '24:00');
  assert.equal(formatTime(1441), '翌日 00:01');
  assert.equal(formatTime(1919), '翌日 07:59');
  assert.equal(formatTime(plan(420, '23:00').fullAfterWater), '24:00');
  assert.throws(() => formatTime(-1), RangeError);
});

// Independent minute-by-minute game simulation, then enumerate every
// affordable watering count. This does not duplicate the production formula.
function recover(hp, minutes) {
  let waste = 0;
  for (let minute = 0; minute < minutes; minute++) {
    if (hp < 480) hp++;
    else waste++;
  }
  return { hp, waste };
}

test('指定時刻の計算を分ごとのシミュレーションと比較', () => {
  const starts = [0, 479, 720, 959, 960, 1080, 1200, 1380, 1439];
  for (const start of starts) {
    const actions = [...new Set([start, Math.floor((start + 1439) / 2), 1439])];
    for (const action of actions) {
      for (const hp of [0, 1, 9, 10, 25, 179, 300, 419, 470, 479, 480]) {
        const result = plan(hp, formatTime(start), formatTime(action));
        const before = recover(hp, action - start);
        let best = 0;
        for (let count = 0; count * 10 <= before.hp; count++) {
          if (recover(before.hp - count * 10, 1440 - action).hp === 480) best = count;
        }
        const after = before.hp - best * 10;
        const end = recover(after, 1440 - action);
        assert.equal(result.count, best, `${hp}, ${start}, ${action}`);
        assert.equal(result.before, before.hp);
        assert.equal(result.after, after);
        assert.equal(result.ending, end.hp);
        assert.equal(result.wasteBefore, before.waste);
        assert.equal(result.wasteAfter, end.waste);
      }
    }
  }
});

test('全HPwr×全時刻（692,640通り）で残量・目標・回数の最適性を検証', () => {
  for (let minute = 0; minute < 1440; minute++) {
    const time = formatTime(minute);
    for (let hp = 0; hp <= 480; hp++) {
      const result = plan(hp, time);
      assert.ok(result.after >= 0 && result.after <= 480);
      assert.ok(Number.isInteger(result.count) && result.count >= 0);
      assert.equal(result.ending, Math.min(480, hp - 10 * result.count + 1440 - minute));
      assert.equal(result.ending, Math.min(480, hp + 1440 - minute));
      // One more watering must be unaffordable or miss the midnight target.
      assert.ok(result.after < 10 || result.after - 10 + 1440 - minute < 480);
      // HPwr is conserved, with capped regeneration accounted for as waste.
      assert.equal(hp + 1440 - minute - result.used - result.wasteTotal, result.ending);
    }
  }
});
