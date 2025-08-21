class ElementBlockerOptions {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadCurrentShortcut();
    await this.loadCurrentDomain();
    this.bindEvents();
  }

  async loadCurrentShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const toggleCommand = commands.find((cmd) => cmd.name === 'toggle-domain-blocking');

      if (toggleCommand && toggleCommand.shortcut) {
        document.getElementById('currentShortcut').textContent = toggleCommand.shortcut;
      } else {
        document.getElementById('currentShortcut').textContent = '未设置';
      }
    } catch (error) {
      console.error('Failed to load current shortcut:', error);
      document.getElementById('currentShortcut').textContent = '加载失败';
    }
  }

  async loadCurrentDomain() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;

        if (domain && !domain.startsWith('chrome://')) {
          document.getElementById('domainName').textContent = domain;
          document.getElementById('currentDomain').style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Failed to load current domain:', error);
    }
  }

  bindEvents() {
    document.getElementById('customizeBtn').addEventListener('click', () => {
      this.openShortcutSettings();
    });

    // 监听快捷键变化
    if (chrome.commands && chrome.commands.onChanged) {
      chrome.commands.onChanged.addListener(() => {
        this.loadCurrentShortcut();
      });
    }
  }

  async openShortcutSettings() {
    try {
      // Chrome 浏览器的快捷键设置页面
      await chrome.tabs.create({
        url: 'chrome://extensions/shortcuts'
      });
    } catch (error) {
      console.error('Failed to open shortcut settings:', error);

      // 如果无法打开设置页面，显示提示信息
      this.showMessage('请手动访问 chrome://extensions/shortcuts 来设置快捷键', 'info');
    }
  }

  showMessage(text, type = 'info') {
    // 创建临时消息提示
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      ${type === 'success' ? 'background-color: #66b279;' : ''}
      ${type === 'error' ? 'background-color: #dc3545;' : ''}
      ${type === 'warning' ? 'background-color: #ffc107; color: #212529;' : ''}
      ${type === 'info' ? 'background-color: #17a2b8;' : ''}
    `;

    document.body.appendChild(message);
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
}

// 初始化选项页面
document.addEventListener('DOMContentLoaded', () => {
  new ElementBlockerOptions();
});
