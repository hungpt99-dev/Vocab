import pkg from '../package.json' assert { type: 'json' };

export function buildManifest(): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'AI Vocabulary Saver',
    version: pkg.version,
    description:
      'Save words while you browse, highlight them everywhere, and explain them with your own AI key. Local-first.',
    minimum_chrome_version: '110',
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
    background: { service_worker: 'background.js', type: 'module' },
    action: {
      default_popup: 'src/popup/index.html',
      default_title: 'AI Vocabulary Saver',
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
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+E', mac: 'Command+Shift+E' },
      },
    },
    web_accessible_resources: [
      { resources: ['assets/*'], matches: ['<all_urls>'] },
    ],
  };
}
