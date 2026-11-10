'use strict';
(() => {
  const { calculatePlan, formatTime, InputError } = window.HpwrCalculator;
  const $ = id => document.getElementById(id);
  const form = $('planner');
  let hpTouched = false;
  let referenceDate = new Date().toDateString();

  function calculate() {
    const mode = form.elements.mode.value;
    const scheduled = mode === 'scheduled';
    $('future-box').hidden = !scheduled;
    $('future').disabled = !scheduled;
    for (const field of ['hp', 'current', 'future']) {
      $(field).removeAttribute('aria-invalid');
      $(`${field}-error`).textContent = '';
    }
    let plan;
    try {
      plan = calculatePlan({ hp: $('hp').value, currentTime: $('current').value, mode, wateringTime: $('future').value });
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      $('result').hidden = true;
      $('empty-state').hidden = false;
      $('empty-state').textContent = $('hp').value === ''
        ? '↳ HPwrを入力すると、ここに結果が表示されます。'
        : '入力内容を確認すると、計算結果が表示されます。';
      if (error.field !== 'hp' || hpTouched) {
        $(error.field).setAttribute('aria-invalid', 'true');
        $(`${error.field}-error`).textContent = error.message;
      }
      return;
    }
    $('result').hidden = false;
    $('empty-state').hidden = true;
    $('when').textContent = scheduled ? `${formatTime(plan.action)} にまとめて水やり` : `${formatTime(plan.action)}（今すぐ）に水やり`;
    $('water').textContent = plan.count;
    $('before').textContent = plan.before;
    $('after').textContent = plan.after;
    $('end').textContent = plan.ending;
    $('used').textContent = `${plan.used} HPwr 消費`;
    $('goal-badge').textContent = plan.reachesTarget ? '24時に480になるプラン' : `24時まであと ${480 - plan.ending} HPwr 不足`;
    $('goal-badge').classList.toggle('unreachable', !plan.reachesTarget);
    $('waste-before').textContent = `${plan.wasteBefore} HPwr`;
    $('waste-after').textContent = `${plan.wasteAfter} HPwr`;
    $('waste-total').textContent = plan.wasteTotal;
    $('full').textContent = formatTime(plan.fullWithoutWater);
    $('full-after').textContent = formatTime(plan.fullAfterWater);
    const messages = [];
    if (!plan.reachesTarget) {
      messages.push(`水やりをしなくても、24時は${plan.ending} HPwrです。今回は水やりを控えるプランです。`);
    } else if (plan.count === 0 && plan.before < 10) {
      messages.push('この時刻は水やりに必要な10 HPwrがないため0回。水やりせずに待つと24時には480になります。');
    } else if (plan.count === 0) {
      messages.push('今の条件では水やりは0回。1回でも水やりすると24時に480へ戻せません。');
    } else {
      messages.push(`${plan.count}回まで水やりしても、24時には480に戻ります。`);
    }
    if (plan.wasteBefore > 0) messages.push(`水やり前に${plan.wasteBefore} HPwr分の回復が余ります。予定時刻を早めると減らせる場合があります。`);
    if (plan.wasteAfter >= 10) {
      messages.push('この時刻の残量だけでは回復を使い切れません。水やり後に回復したら、残量を確認して再計算してください。');
    } else if (plan.wasteAfter > 0) {
      messages.push(`10単位の消費なので、水やり後の回復が${plan.wasteAfter} HPwr分余ります。`);
    } else if (plan.reachesTarget) {
      messages.push('水やり後の回復は、24時まで無駄なく使えます。');
    }
    $('notice').textContent = messages.join(' ');
    $('notice').classList.toggle('warning', !plan.reachesTarget || plan.wasteTotal > 0);
  }
  function setNow() {
    const date = new Date();
    referenceDate = date.toDateString();
    $('day-warning').hidden = true;
    $('current').value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    calculate();
  }
  function checkDate() {
    $('day-warning').hidden = referenceDate === new Date().toDateString();
  }
  form.addEventListener('submit', event => { event.preventDefault(); hpTouched = true; calculate(); });
  form.addEventListener('input', event => { if (event.target.id === 'hp') hpTouched = true; calculate(); });
  form.addEventListener('change', calculate);
  $('now').addEventListener('click', setNow);
  document.addEventListener('visibilitychange', checkDate);
  window.addEventListener('focus', checkDate);
  setInterval(checkDate, 30000);
  setNow();

  let installPrompt;
  let offlineReady = false;
  let registration;
  let reloadingForUpdate = false;
  function updateOfflineStatus() {
    $('offline-status').textContent = offlineReady
      ? navigator.onLine ? '準備完了。この端末ではオフラインでも計算できます。' : 'オフラインで利用中。計算はそのまま使えます。'
      : 'オフラインの準備中です。初回はインターネット接続が必要です。';
  }
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
  $('install').addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    $('install').hidden = true;
    await prompt.prompt();
  });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; installPrompt = null; });
  const secure = window.isSecureContext && location.protocol !== 'file:';
  if (!('serviceWorker' in navigator) || !secure) {
    $('offline-status').textContent = 'インストールとオフライン利用にはHTTPSでの公開が必要です。PCの動作確認にはlocalhostも使えます。';
    return;
  }
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadingForUpdate) location.reload(); });
  $('update').addEventListener('click', () => {
    if (registration?.waiting) {
      reloadingForUpdate = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    registration = reg;
    function showUpdate() { $('update-box').hidden = !(reg.waiting && navigator.serviceWorker.controller); }
    showUpdate();
    function watchInstalling() { reg.installing?.addEventListener('statechange', showUpdate); }
    watchInstalling();
    reg.addEventListener('updatefound', watchInstalling);
    return navigator.serviceWorker.ready;
  }).then(() => { offlineReady = true; updateOfflineStatus(); }).catch(() => {
    $('offline-status').textContent = 'オフラインの準備ができませんでした。接続やブラウザの設定を確認し、再読み込みしてください。';
  });
})();
