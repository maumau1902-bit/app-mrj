const { EventEmitter } = require('node:events');

// This controller owns the lifecycle; no update URL or executable path comes from the renderer.
class UpdateController extends EventEmitter {
  constructor(updater, { version, enabled, disabledReason, tokenFactory, intervalMs = 30 * 60 * 1000 }) {
    super();
    this.updater = updater;
    this.tokenFactory = tokenFactory;
    this.intervalMs = intervalMs;
    this.state = { status: enabled ? 'idle' : 'disabled', currentVersion: version,
      availableVersion: null, percent: 0, lastChecked: null,
      message: enabled ? 'Verificamos atualizações ao abrir e a cada 30 minutos.' : disabledReason };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableDifferentialDownload = false;
    updater.on('update-available', info => this.set({ status: 'available', availableVersion: info.version, percent: 0,
      message: 'Nova versão disponível. Atualize agora ou continue trabalhando.' }));
    updater.on('update-not-available', () => this.set({ status: 'current', availableVersion: null, message: 'Você está na versão mais recente.' }));
    updater.on('download-progress', info => {
      if (this.state.status === 'downloading') this.set({ percent: Math.max(0, Math.min(100, Math.round(info.percent))) });
    });
    updater.on('update-downloaded', info => this.set({ status: 'downloaded', availableVersion: info.version, percent: 100,
      message: 'Download verificado. Salve seu trabalho antes de instalar e reiniciar.' }));
    updater.on('error', () => {
      // Downloads can be cancelled; their catch handler restores the available state.
      if (!this.token?.cancelled) this.fail();
    });
  }
  snapshot() { return { ...this.state }; }
  set(patch) { Object.assign(this.state, patch); this.emit('state', this.snapshot()); }
  fail() {
    if (this.state.status === 'disabled') return;
    this.set({ status: 'error', message: 'Não foi possível concluir a atualização. Verifique a conexão e tente novamente.' });
  }
  async check() {
    if (this.token || !['idle', 'current', 'available', 'error'].includes(this.state.status)) return this.snapshot();
    if (this.checkTask) return this.checkTask;
    this.set({ status: 'checking', message: 'Consultando novas versões no GitHub…' });
    this.checkTask = (async () => {
      try {
        await this.updater.checkForUpdates();
        this.set({ lastChecked: new Date().toISOString() });
      } catch { this.fail(); }
      finally { this.checkTask = null; }
      return this.snapshot();
    })();
    return this.checkTask;
  }
  async download() {
    if (!this.state.availableVersion || !['available', 'error'].includes(this.state.status)) return this.snapshot();
    this.token = this.tokenFactory();
    this.set({ status: 'downloading', percent: 0, message: 'Baixando a atualização. Você pode continuar usando o aplicativo.' });
    try { await this.updater.downloadUpdate(this.token); }
    catch {
      if (this.token.cancelled) this.set({ status: 'available', percent: 0, message: 'Download interrompido. Você pode tentar novamente quando quiser.' });
      else this.fail();
    } finally { this.token = null; }
    return this.snapshot();
  }
  cancel() {
    if (this.state.status === 'downloading' && this.token) {
      this.token.cancel();
      this.set({ message: 'Interrompendo download…' });
    }
    return this.snapshot();
  }
  install() {
    if (this.state.status !== 'downloaded') return false;
    this.set({ status: 'installing', message: 'Fechando para instalar. O Pulse Analytics abrirá novamente.' });
    // Silent NSIS installation; force the app to reopen on completion.
    setImmediate(() => this.updater.quitAndInstall(true, true));
    return true;
  }
  start() {
    if (this.timer || this.state.status === 'disabled') return;
    void this.check();
    this.timer = setInterval(() => {
      if (['idle', 'current', 'error'].includes(this.state.status)) void this.check();
    }, this.intervalMs);
    this.timer.unref?.();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
module.exports = { UpdateController };
