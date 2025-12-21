import type { ManifestV3Export } from '@crxjs/vite-plugin';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'Element Blocker',
  version: '2.0.0',
  description: '支持包含匹配的网页元素屏蔽器，根据类名片段屏蔽相关元素',

  permissions: ['storage', 'activeTab', 'tabs'],

  commands: {
    'toggle-domain-blocking': {
      suggested_key: {
        default: 'Ctrl+E',
        mac: 'Command+E'
      },
      description: '切换当前域名的屏蔽状态'
    }
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },

  action: {
    default_icon: 'icons/icon.png',
    default_popup: 'src/popup/index.html',
    default_title: 'Element Blocker'
  },

  options_page: 'src/options/index.html',

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],

      run_at: 'document_idle'
    }
  ],

  icons: {
    '16': 'icons/icon.png',
    '48': 'icons/icon.png',
    '128': 'icons/icon.png'
  }
};

export default manifest;
