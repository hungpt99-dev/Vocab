import pkg from '../package.json' assert { type: 'json' };

export function buildManifest(): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'Vocab',
    version: pkg.version,
    description:
      'Save words while you browse, highlight them everywhere, and explain them with your own AI key. Local-first.',
    minimum_chrome_version: '110',
    permissions: ['storage', 'contextMenus', 'activeTab', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
    background: { service_worker: 'background.js', type: 'module' },
    icons: {
      16: 'assets/icon16.png',
      32: 'assets/icon32.png',
      48: 'assets/icon48.png',
      128: 'assets/icon128.png',
    },
    action: {
      default_popup: 'src/popup/index.html',
      default_title: 'Vocab',
      default_icon: {
        16: 'assets/icon16.png',
        32: 'assets/icon32.png',
        48: 'assets/icon48.png',
        128: 'assets/icon128.png',
      },
    },
    options_page: 'src/options/index.html',
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: false,
      },
    ],
    commands: {
      'save-selection': {
        suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
        description: 'Save the selected word to your vocabulary',
      },
      'toggle-bilingual-reading': {
        suggested_key: { default: 'Alt+Shift+R', mac: 'Alt+Shift+R' },
        description: 'Toggle bilingual reading mode',
      },
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+E', mac: 'Command+Shift+E' },
      },
    },
    web_accessible_resources: [
      { resources: ['assets/*'], matches: ['<all_urls>'] },
    ],
  };
}
