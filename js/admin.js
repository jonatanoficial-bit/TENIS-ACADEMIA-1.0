import { loadContent } from './contentLoader.js';
import { exportState, importState } from './state.js';

const $ = (s) => document.querySelector(s);
let content;

init();

async function init() {
  content = await loadContent();
  $('#loginBtn').addEventListener('click', login);
  $('#installDlcBtn').addEventListener('click', installDlc);
  $('#exportSaveBtn').addEventListener('click', exportSaveFile);
  $('#importSaveBtn').addEventListener('click', importSaveFile);
  $('#saveAcademyNameBtn').addEventListener('click', saveAcademyName);
}

function login() {
  const ok = $('#adminUser').value === 'admin' && $('#adminPass').value === 'ace2026';
  $('#loginMessage').textContent = ok ? 'Login autorizado.' : 'Credenciais inválidas.';
  if (!ok) return;
  $('#loginCard').classList.add('hidden');
  $('#adminPanel').classList.remove('hidden');
  renderDlcList();
}

function renderDlcList() {
  const list = $('#dlcAdminList');
  const localDlcs = JSON.parse(localStorage.getItem('ace_local_dlcs') || '[]');
  const builtins = content.manifest.packs.map(pack => `<div class="list-item"><span>${pack.id}</span><span>${pack.active ? 'ativo' : 'desativado'}</span></div>`).join('');
  const locals = localDlcs.map(pack => `<div class="list-item"><span>${pack.meta?.id || 'local-pack'}</span><span>local</span></div>`).join('');
  list.innerHTML = builtins + locals || '<div class="list-item"><span>Nenhuma DLC encontrada</span></div>';
}

function installDlc() {
  const file = $('#dlcFileInput').files[0];
  if (!file) return log('Selecione um JSON de DLC.');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const localDlcs = JSON.parse(localStorage.getItem('ace_local_dlcs') || '[]');
      localDlcs.push({ ...data, active: true });
      localStorage.setItem('ace_local_dlcs', JSON.stringify(localDlcs));
      log(`DLC instalada: ${data.meta?.name || 'Sem nome'}`);
      renderDlcList();
    } catch {
      log('JSON inválido para DLC.');
    }
  };
  reader.readAsText(file);
}

function exportSaveFile() {
  const data = exportState();
  if (!data) return log('Nenhum save encontrado.');
  downloadJson(data, `ace-academy-save_${Date.now()}.json`);
  log('Save exportado.');
}

function importSaveFile() {
  const file = $('#saveFileInput').files[0];
  if (!file) return log('Selecione um save JSON.');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importState(JSON.parse(reader.result));
      log('Save importado com sucesso.');
    } catch {
      log('Save inválido.');
    }
  };
  reader.readAsText(file);
}

function saveAcademyName() {
  const name = $('#academyNameInput').value.trim();
  if (!name) return log('Digite um nome válido.');
  const override = JSON.parse(localStorage.getItem('ace_admin_overrides') || '{}');
  override.academyName = name;
  localStorage.setItem('ace_admin_overrides', JSON.stringify(override));
  log(`Nome da academia salvo: ${name}`);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function log(text) {
  $('#adminLog').textContent = text + '\n' + $('#adminLog').textContent;
}
