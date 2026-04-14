import { loadContentBundle } from './core/content-loader.js';
import {
  clearAdminOverrides,
  clearAdminSession,
  clearGameState,
  exportSnapshot,
  loadAdminOverrides,
  loadAdminSession,
  loadCustomPackages,
  loadPackageState,
  saveAdminOverrides,
  saveAdminSession,
  saveCustomPackages,
  savePackageState,
} from './core/storage.js';
import { formatCurrency } from './core/utils.js';

let contentBundle;
let buildInfo;
let adminCredentials;

const root = document.querySelector('#admin-app');
const loginPane = document.querySelector('#admin-login');
const dashboardPane = document.querySelector('#admin-dashboard');
const notice = document.querySelector('#admin-notice');

const showNotice = (message, tone = 'accent') => {
  notice.className = `admin-notice ${tone}`;
  notice.textContent = message;
};

const downloadJson = (name, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const renderDashboard = () => {
  const packageState = loadPackageState();
  const customPackages = loadCustomPackages();
  const overrides = loadAdminOverrides();
  const packageList = document.querySelector('#package-list');
  const summary = document.querySelector('#admin-summary');
  const configForm = document.querySelector('#admin-config-form');
  const customList = document.querySelector('#custom-package-list');

  summary.innerHTML = `
    <article class="glass-card admin-summary-card">
      <span>Build</span>
      <strong>v${buildInfo.version}</strong>
      <small>${buildInfo.build}</small>
    </article>
    <article class="glass-card admin-summary-card">
      <span>Pacotes ativos</span>
      <strong>${contentBundle.packages.filter((pkg) => (packageState[pkg.id] ?? pkg.enabled)).length}</strong>
      <small>Total ${contentBundle.packages.length + customPackages.length}</small>
    </article>
    <article class="glass-card admin-summary-card">
      <span>Overrides</span>
      <strong>${Object.keys(overrides).length}</strong>
      <small>copy / branding / config</small>
    </article>
  `;

  packageList.innerHTML = [
    ...contentBundle.packages,
    ...customPackages.map((pkg) => ({ ...pkg, source: 'local' })),
  ]
    .map((pkg) => {
      const enabled = packageState[pkg.id] ?? pkg.enabled ?? true;
      return `
        <article class="glass-card package-row">
          <div>
            <h4>${pkg.name}</h4>
            <p>${pkg.id} · v${pkg.version}</p>
            <small>${pkg.description || pkg.type || 'Pacote de conteúdo'}</small>
          </div>
          <label class="switch-row">
            <span>${enabled ? 'Ativo' : 'Inativo'}</span>
            <input type="checkbox" data-package-toggle="${pkg.id}" ${enabled ? 'checked' : ''} />
          </label>
        </article>
      `;
    })
    .join('');

  customList.innerHTML = customPackages.length
    ? customPackages
        .map(
          (pkg) => `
            <article class="glass-card package-row compact">
              <div>
                <h4>${pkg.name}</h4>
                <p>${pkg.id}</p>
              </div>
              <button class="button-secondary" data-remove-package="${pkg.id}">Remover</button>
            </article>
          `,
        )
        .join('')
    : '<p class="muted">Nenhum pacote custom instalado via localStorage.</p>';

  const config = {
    title: overrides.branding?.title || contentBundle.branding.title,
    heroTitle: overrides.copy?.heroTitle || contentBundle.copy.heroTitle,
    heroSubtitle: overrides.copy?.heroSubtitle || contentBundle.copy.heroSubtitle,
    academyName: overrides.config?.defaults?.academyName || contentBundle.config.defaults.academyName,
    startingBalance: overrides.config?.defaults?.startingBalance || contentBundle.config.defaults.startingBalance,
    sponsorBaseWeekly: overrides.config?.economy?.sponsorBaseWeekly || contentBundle.config.economy.sponsorBaseWeekly,
    trainingGainBase: overrides.config?.progression?.trainingGainBase || contentBundle.config.progression.trainingGainBase,
  };

  configForm.innerHTML = `
    <label>
      Título do jogo
      <input name="title" value="${config.title}" />
    </label>
    <label>
      Hero title
      <input name="heroTitle" value="${config.heroTitle}" />
    </label>
    <label>
      Hero subtitle
      <textarea name="heroSubtitle">${config.heroSubtitle}</textarea>
    </label>
    <label>
      Nome padrão da academia
      <input name="academyName" value="${config.academyName}" />
    </label>
    <label>
      Caixa inicial
      <input name="startingBalance" type="number" value="${config.startingBalance}" />
    </label>
    <label>
      Sponsor base semanal
      <input name="sponsorBaseWeekly" type="number" value="${config.sponsorBaseWeekly}" />
    </label>
    <label>
      Ganho base de treino
      <input name="trainingGainBase" type="number" step="0.1" value="${config.trainingGainBase}" />
    </label>
    <label>
      Upload de imagem hero (salva em localStorage)
      <input id="hero-image-upload" type="file" accept="image/*" />
    </label>
    <div class="hero-actions-row">
      <button type="submit" class="button-primary">Salvar overrides</button>
      <button type="button" class="button-secondary" id="export-snapshot">Exportar snapshot</button>
      <button type="button" class="button-tertiary" id="reset-overrides">Limpar overrides</button>
    </div>
  `;

  document.querySelector('#hero-image-upload')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const current = loadAdminOverrides();
      current.branding = current.branding || {};
      current.branding.heroImage = reader.result;
      saveAdminOverrides(current);
      showNotice('Imagem hero salva no modo local. Reabra a página principal para ver a mudança.', 'success');
    };
    reader.readAsDataURL(file);
  });

  document.querySelector('#export-snapshot')?.addEventListener('click', () => {
    downloadJson(`ace-manager-admin-snapshot-${buildInfo.build}.json`, exportSnapshot());
  });

  document.querySelector('#reset-overrides')?.addEventListener('click', () => {
    clearAdminOverrides();
    renderDashboard();
    showNotice('Overrides limpos com sucesso.', 'success');
  });
};

const toggleSessionUi = () => {
  const session = loadAdminSession();
  loginPane.hidden = !!session;
  dashboardPane.hidden = !session;
  if (session) renderDashboard();
};

const init = async () => {
  buildInfo = await fetch('build/build-info.json', { cache: 'no-store' }).then((res) => res.json());
  contentBundle = await loadContentBundle();
  adminCredentials = contentBundle.config.admin;
  document.querySelector('#admin-build-pill').textContent = `v${buildInfo.version} · ${buildInfo.build}`;
  toggleSessionUi();

  document.querySelector('#admin-login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();
    if (username === adminCredentials.username && password === adminCredentials.password) {
      saveAdminSession({ username, at: new Date().toISOString() });
      toggleSessionUi();
      showNotice('Login concluído. Painel liberado.', 'success');
    } else {
      showNotice('Credenciais inválidas para o modo local.', 'danger');
    }
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-package-toggle], [data-remove-package], #logout-admin, #reset-save]');
    if (!toggle) return;

    if (toggle.matches('#logout-admin')) {
      clearAdminSession();
      toggleSessionUi();
      showNotice('Sessão finalizada.', 'accent');
      return;
    }

    if (toggle.matches('#reset-save')) {
      clearGameState();
      showNotice('Save principal removido do navegador.', 'success');
      return;
    }

    if (toggle.dataset.removePackage) {
      const packages = loadCustomPackages().filter((pkg) => pkg.id !== toggle.dataset.removePackage && pkg.manifest?.id !== toggle.dataset.removePackage);
      saveCustomPackages(packages);
      renderDashboard();
      showNotice('Pacote local removido.', 'success');
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const pkgToggle = event.target.closest('[data-package-toggle]');
    if (pkgToggle) {
      const next = loadPackageState();
      next[pkgToggle.dataset.packageToggle] = pkgToggle.checked;
      savePackageState(next);
      showNotice(`Pacote ${pkgToggle.checked ? 'ativado' : 'desativado'}.`, 'success');
      return;
    }

    const importInput = event.target.closest('#package-import');
    if (importInput?.files?.[0]) {
      const file = importInput.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const normalized = {
            id: parsed.id || parsed.manifest?.id,
            name: parsed.name || parsed.manifest?.name || file.name.replace('.json', ''),
            version: parsed.version || parsed.manifest?.version || '0.0.1',
            enabled: parsed.enabled ?? true,
            payload: parsed.payload || parsed.data || parsed.packageData,
          };
          if (!normalized.id || !normalized.payload) throw new Error('Pacote precisa ter id e payload/data.');
          const current = loadCustomPackages().filter((pkg) => pkg.id !== normalized.id);
          current.push(normalized);
          saveCustomPackages(current);
          renderDashboard();
          showNotice(`Pacote ${normalized.name} instalado no modo local.`, 'success');
        } catch (error) {
          showNotice(`Falha ao importar pacote: ${error.message}`, 'danger');
        }
      };
      reader.readAsText(file);
    }
  });

  document.querySelector('#admin-config-form-host').addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const current = loadAdminOverrides();
    current.branding = current.branding || {};
    current.copy = current.copy || {};
    current.config = current.config || { defaults: {}, economy: {}, progression: {} };
    current.config.defaults = current.config.defaults || {};
    current.config.economy = current.config.economy || {};
    current.config.progression = current.config.progression || {};

    current.branding.title = String(formData.get('title') || '').trim();
    current.copy.heroTitle = String(formData.get('heroTitle') || '').trim();
    current.copy.heroSubtitle = String(formData.get('heroSubtitle') || '').trim();
    current.config.defaults.academyName = String(formData.get('academyName') || '').trim();
    current.config.defaults.startingBalance = Number(formData.get('startingBalance') || 0);
    current.config.economy.sponsorBaseWeekly = Number(formData.get('sponsorBaseWeekly') || 0);
    current.config.progression.trainingGainBase = Number(formData.get('trainingGainBase') || 0);

    saveAdminOverrides(current);
    showNotice(`Overrides salvos. Caixa inicial agora ${formatCurrency(current.config.defaults.startingBalance)}.`, 'success');
  });
};

init().catch((error) => {
  root.innerHTML = `<div class="glass-card admin-error"><h1>Erro no Admin</h1><p>${error.message}</p></div>`;
});
