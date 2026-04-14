const SAVE_KEY = 'ace-manager-save';
const PACKAGE_STATE_KEY = 'ace-manager-package-state';
const CUSTOM_PACKAGES_KEY = 'ace-manager-custom-packages';
const ADMIN_OVERRIDE_KEY = 'ace-manager-admin-overrides';
const ADMIN_SESSION_KEY = 'ace-manager-admin-session';
const VIEW_KEY = 'ace-manager-last-view';

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn('Falha ao parsear armazenamento local.', error);
    return fallback;
  }
};

export const saveGameState = (state) => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
};

export const loadGameState = () => safeParse(localStorage.getItem(SAVE_KEY), null);

export const clearGameState = () => localStorage.removeItem(SAVE_KEY);

export const loadPackageState = () => safeParse(localStorage.getItem(PACKAGE_STATE_KEY), {});

export const savePackageState = (packageState) => {
  localStorage.setItem(PACKAGE_STATE_KEY, JSON.stringify(packageState));
};

export const loadCustomPackages = () => safeParse(localStorage.getItem(CUSTOM_PACKAGES_KEY), []);

export const saveCustomPackages = (packages) => {
  localStorage.setItem(CUSTOM_PACKAGES_KEY, JSON.stringify(packages));
};

export const loadAdminOverrides = () => safeParse(localStorage.getItem(ADMIN_OVERRIDE_KEY), {});

export const saveAdminOverrides = (overrides) => {
  localStorage.setItem(ADMIN_OVERRIDE_KEY, JSON.stringify(overrides));
};

export const clearAdminOverrides = () => localStorage.removeItem(ADMIN_OVERRIDE_KEY);

export const saveAdminSession = (payload) => {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload));
};

export const loadAdminSession = () => safeParse(localStorage.getItem(ADMIN_SESSION_KEY), null);

export const clearAdminSession = () => localStorage.removeItem(ADMIN_SESSION_KEY);

export const saveLastView = (view) => localStorage.setItem(VIEW_KEY, view);

export const loadLastView = () => localStorage.getItem(VIEW_KEY) || 'dashboard';

export const exportSnapshot = () => ({
  save: loadGameState(),
  packageState: loadPackageState(),
  customPackages: loadCustomPackages(),
  adminOverrides: loadAdminOverrides(),
  exportedAt: new Date().toISOString(),
});
