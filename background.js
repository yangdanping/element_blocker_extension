class ElementBlockerBackground {
  constructor() {
    this.setupCommandListener();
    this.setupTabListener();
    this.setupStorageListener();
    this.setupMessageListener();
  }

  setupCommandListener() {
    // 监听快捷键命令
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'toggle-domain-blocking') {
        this.handleToggleDomainBlocking();
      }
    });
  }

  async handleToggleDomainBlocking() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      // 获取域名
      const url = new URL(tab.url);
      const domain = url.hostname;

      // 发送消息到内容脚本
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleDomainBlocking',
        domain: domain
      });
    } catch (error) {
      console.error('Failed to handle toggle domain blocking:', error);
    }
  }

  setupTabListener() {
    // 监听标签页切换和更新
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.updateIconForTab(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        await this.updateIconForTab(tabId);
      }
    });
  }

  setupStorageListener() {
    // 监听存储变化
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace === 'local' && (changes.blockedClasses || changes.isEnabled)) {
        // 更新当前活动标签页的图标
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await this.updateIconForTab(tab.id);
          }
        } catch (error) {
          console.error('Failed to update icon after storage change:', error);
        }
      }
    });
  }

  setupMessageListener() {
    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateIcon' && sender.tab) {
        this.updateIconForTab(sender.tab.id);
        sendResponse({ success: true });
      }
    });
  }

  async updateIconForTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !tab.url) return;

      const url = new URL(tab.url);
      const domain = url.hostname;

      const hasActiveBlocking = await this.checkDomainHasActiveBlocking(domain);

      const iconPath = hasActiveBlocking ? 'icons/icon-active.png' : 'icons/icon.png';

      await chrome.action.setIcon({
        path: iconPath,
        tabId: tabId
      });
    } catch (error) {
      console.error('Failed to update icon for tab:', error);
    }
  }

  async checkDomainHasActiveBlocking(domain) {
    try {
      const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);

      // 如果总开关关闭，返回false
      if (data.isEnabled === false) {
        return false;
      }

      const blockedClasses = data.blockedClasses || [];

      // 检查是否有针对该域名或全局的激活屏蔽项
      const hasActiveItems = blockedClasses.some((item) => {
        // 向后兼容处理
        const itemObj = typeof item === 'string' ? { className: item, enabled: true, domain: null } : item.domain === undefined ? { ...item, domain: null } : item;

        // 检查是否为激活状态且匹配当前域名
        return itemObj.enabled && (itemObj.domain === null || itemObj.domain === domain);
      });

      return hasActiveItems;
    } catch (error) {
      console.error('Failed to check domain blocking status:', error);
      return false;
    }
  }
}

// 初始化背景脚本
new ElementBlockerBackground();
