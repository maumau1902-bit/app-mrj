const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let state = { status: 'disabled', currentVersion: __APP_VERSION__, message: 'Abra o aplicativo Windows instalado para usar as atualizações internas.', percent: 0 };
let deferred = false;
let bridge;
let navigate = () => {};
const labels = { disabled: 'Versão de demonstração', idle: 'Verificação automática ativa', checking: 'Verificando atualizações', current: 'Aplicativo atualizado', available: 'Nova versão disponível', downloading: 'Baixando atualização', downloaded: 'Pronto para instalar', installing: 'Instalando atualização', error: 'Não foi possível atualizar' };
function actions(compact = false) {
  const button = (action, text, primary = false) => `<button class="${primary?'primary':'export'}" data-update-action="${action}">${text}</button>`;
  if (state.status === 'available') return button('download','Baixar atualização',true) + (compact ? button('defer','Mais tarde') : '');
  if (state.status === 'downloading') return button('cancel','Interromper download') + (compact ? button('defer','Ocultar') : '');
  if (state.status === 'downloaded') return button('install','Instalar e reiniciar',true) + (compact ? button('defer','Mais tarde') : '');
  if (state.status === 'error') return button('check','Tentar novamente',true) + (compact ? button('defer','Fechar') : '');
  if (['idle','current'].includes(state.status)) return button('check','Verificar agora');
  return '';
}
export function updatesPanel() {
  const percent = Math.max(0,Math.min(100, Number(state.percent)||0));
  return `<section class="panel update-panel"><div class="update-brand"><img src="./brand.svg" alt=""><div><h3>Pulse Analytics</h3><p>Atualizações do aplicativo</p></div><span class="version-tag">v${escape(state.currentVersion)}</span></div><div class="update-status" role="status"><span class="update-indicator ${state.status==='error'?'error':''}"></span><h3>${escape(labels[state.status] || 'Atualizações')}</h3></div><p>${escape(state.message)}</p>${state.availableVersion?`<p>Nova versão: <strong>${escape(state.availableVersion)}</strong></p>`:''}${state.status==='downloading'?`<div class="update-progress" role="progressbar" aria-label="Download da atualização" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><p>${percent}% concluído</p>`:''}<div class="update-actions">${actions()}</div><div class="update-details"><span>Verificação ao iniciar e a cada 30 minutos</span><span>Você escolhe quando baixar e reiniciar</span><span>Download diferencial quando disponível</span></div>${state.lastChecked?`<small>Última verificação: ${escape(new Date(state.lastChecked).toLocaleString('pt-BR'))}</small>`:''}</section>`;
}
function refresh() {
  const panel = document.querySelector('#updates-panel');
  if (panel) panel.innerHTML = updatesPanel();
  const badge = document.querySelector('#updates-nav-badge');
  if (badge) badge.hidden = !['available','downloaded'].includes(state.status);
  const toast = document.querySelector('#update-toast');
  if (!toast) return;
  const visible = !deferred && ['available','downloading','downloaded','error'].includes(state.status);
  toast.hidden = !visible;
  toast.innerHTML = visible ? `<div><strong>${escape(labels[state.status])}</strong><p>${escape(state.status==='downloading'?`${state.percent}% concluído — continue usando o app.`:state.message)}</p></div><div class="update-actions">${actions(true)}</div><button class="toast-details" data-update-action="details" aria-label="Abrir aba de atualizações">Detalhes →</button>` : '';
}
export function refreshUpdates() { refresh(); }
export async function initUpdates(onNavigate) {
  navigate = onNavigate;
  document.body.insertAdjacentHTML('beforeend','<section id="update-toast" class="update-toast" aria-label="Atualização do aplicativo" aria-live="polite" hidden></section>');
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-update-action]');
    if (!button) return;
    const action = button.dataset.updateAction;
    if (action === 'defer') { deferred = true; refresh(); return; }
    if (action === 'details') { navigate(); refresh(); return; }
    if (!bridge || !['check','download','cancel','install'].includes(action)) return;
    button.disabled = true;
    try { await bridge[action](); }
    catch { state = { ...state, status: 'error', message: 'Não foi possível comunicar com o atualizador. Tente novamente.' }; refresh(); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  bridge = window.pulseDesktop?.updates;
  if (!bridge) { refresh(); return; }
  // Subscribe before reading the snapshot so startup notifications are not lost.
  bridge.onState(next => {
    if (next.availableVersion !== state.availableVersion || next.status === 'downloaded' && state.status !== 'downloaded') deferred = false;
    state = next; refresh();
  });
  try { state = await bridge.getState(); refresh(); } catch { state.message = 'Não foi possível consultar o estado do atualizador.'; refresh(); }
}
