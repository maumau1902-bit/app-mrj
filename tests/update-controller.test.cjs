const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { UpdateController } = require('../electron/update-controller.cjs');
function fixture(enabled = true, intervalMs = 30 * 60 * 1000) {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => updater.emit('update-available', { version: '0.2.0' });
  updater.downloadUpdate = async () => updater.emit('update-downloaded', { version: '0.2.0' });
  updater.quitAndInstall = (...args) => { updater.installed = args; };
  const controller = new UpdateController(updater, { enabled, disabledReason: 'test package', version: '0.1.0', intervalMs,
    tokenFactory: () => ({ cancelled: false, cancel() { this.cancelled = true; } }) });
  return { updater, controller };
}
test('a check only notifies: no download and no installation until user actions', async () => {
  const { updater, controller } = fixture();
  assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false); assert.equal(updater.disableDifferentialDownload, false);
  assert.equal(controller.install(), false);
  await controller.check(); assert.equal(controller.snapshot().status, 'available');
  assert.equal(controller.snapshot().availableVersion, '0.2.0'); assert.ok(controller.snapshot().lastChecked);
  assert.equal(updater.installed, undefined); assert.equal(controller.install(), false);
  await controller.download(); assert.equal(controller.snapshot().status, 'downloaded');
  await controller.check(); assert.equal(controller.snapshot().status, 'downloaded');
  assert.equal(controller.install(), true); await new Promise(setImmediate);
  assert.deepEqual(updater.installed, [true, true]); assert.equal(controller.install(), false);
});
test('disabled development packages cannot check, download or install', async () => {
  const { updater, controller } = fixture(false);
  updater.checkForUpdates = () => { throw new Error('must not call'); };
  await controller.check(); await controller.download(); controller.start();
  assert.equal(controller.snapshot().status, 'disabled'); assert.equal(controller.timer, undefined);
  assert.equal(controller.install(), false);
});
test('offline check can be retried and is not reported as up to date', async () => {
  const { updater, controller } = fixture();
  updater.checkForUpdates = async () => { throw new Error('network failure / sensitive URL'); };
  await controller.check(); assert.equal(controller.snapshot().status, 'error');
  assert.doesNotMatch(controller.snapshot().message, /sensitive/);
  updater.checkForUpdates = async () => updater.emit('update-not-available');
  await controller.check(); assert.equal(controller.snapshot().status, 'current');
});
test('failed integrity/signature download never enables installation', async () => {
  const { updater, controller } = fixture(); await controller.check();
  updater.downloadUpdate = async () => { updater.emit('error', new Error('checksum mismatch')); throw new Error('checksum mismatch'); };
  await controller.download(); assert.equal(controller.snapshot().status, 'error'); assert.equal(controller.install(), false);
  updater.downloadUpdate = async () => updater.emit('update-downloaded', {version:'0.2.0'});
  await controller.download(); assert.equal(controller.snapshot().status, 'downloaded');
});
test('cancel a download then retry; progress is bounded; duplicate downloads are ignored', async () => {
  const { updater, controller } = fixture(); await controller.check(); let rejectDownload; let count = 0;
  updater.downloadUpdate = () => { count++; return new Promise((_r, reject) => { rejectDownload = reject; }); };
  const pending = controller.download(); await controller.download(); assert.equal(count, 1);
  updater.emit('download-progress', { percent: 145 }); assert.equal(controller.snapshot().percent, 100);
  controller.cancel(); rejectDownload(new Error('cancelled')); await pending;
  assert.equal(controller.snapshot().status, 'available'); assert.equal(controller.install(), false);
  updater.downloadUpdate = async () => updater.emit('update-downloaded', { version:'0.2.0' });
  await controller.download(); assert.equal(controller.snapshot().status, 'downloaded');
});
test('checks do not overlap and scheduler stops cleanly', async () => {
  const { updater, controller } = fixture(true, 5); let calls = 0; let finish;
  updater.checkForUpdates = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  controller.start(); controller.start(); await controller.check();
  assert.equal(calls, 1); controller.stop(); finish(); await new Promise(setImmediate);
  assert.equal(controller.timer, null);
});
test('snapshot cannot mutate internal state', () => {
  const {controller} = fixture(); const state = controller.snapshot(); state.status = 'downloaded';
  assert.equal(controller.install(), false);
});
