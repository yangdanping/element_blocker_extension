/**
 * =========================================
 * Element Blocker - Background Service Worker
 * =========================================
 *
 * Chrome Extension 的后台服务脚本，负责：
 * 1. 监听快捷键命令
 * 2. 监听标签页状态变化
 * 3. 动态更新扩展图标
 * 4. 作为消息路由中心
 */

// =========================================
// 快捷键监听
// =========================================

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-domain-blocking') {
    handleToggleDomainBlocking();
  }
});

/**
 * 处理切换域名屏蔽的快捷键
 */
async function handleToggleDomainBlocking() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.id) return;

    // 跳过不支持 content script 的页面
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      console.log('Cannot toggle blocking on non-http pages');
      return;
    }

    const url = new URL(tab.url);
    const domain = url.hostname;

    // 发送消息给 content script，静默处理错误
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleDomainBlocking',
        domain,
      });
    } catch {
      // Content script 可能未加载（例如页面刚打开），忽略此错误
      console.log('Content script not ready on this page');
    }
  } catch (error) {
    console.error('Failed to toggle domain blocking:', error);
  }
}

// =========================================
// 标签页状态监听
// =========================================

// 监听标签页切换
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateIconForTab(activeInfo.tabId);
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateIconForTab(tabId);
  }
});

// =========================================
// Storage 变化监听
// =========================================

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && (changes.blockedClasses || changes.isEnabled)) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await updateIconForTab(tab.id);
      }
    } catch (error) {
      console.error('Failed to update icon after storage change:', error);
    }
  }
});

// =========================================
// 消息监听
// =========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateIcon' && sender.tab?.id) {
    updateIconForTab(sender.tab.id);
    sendResponse({ success: true });
  }
  return true;
});

// =========================================
// 图标更新
// =========================================

/**
 * 根据当前域名的屏蔽状态更新图标
 */
async function updateIconForTab(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) return;

    // 跳过 chrome:// 等特殊页面
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      return;
    }

    const url = new URL(tab.url);
    const domain = url.hostname;

    const hasActiveBlocking = await checkDomainHasActiveBlocking(domain);

    const iconPath = hasActiveBlocking ? 'icons/icon-active.png' : 'icons/icon.png';

    await chrome.action.setIcon({
      path: iconPath,
      tabId,
    });
  } catch (error) {
    console.error('Failed to update icon for tab:', error);
  }
}

/**
 * 检查指定域名是否有激活的屏蔽项
 */
async function checkDomainHasActiveBlocking(domain: string): Promise<boolean> {
  try {
    const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);

    // 全局开关关闭
    if (data.isEnabled === false) {
      return false;
    }

    const blockedClasses = Array.isArray(data.blockedClasses) ? data.blockedClasses : [];

    // 检查是否有针对该域名或全局的激活屏蔽项
    return blockedClasses.some((item) => {
      // 向后兼容处理
      const itemObj = typeof item === 'string' ? { className: item, enabled: true, domain: null } : item.domain === undefined ? { ...item, domain: null } : item;

      return itemObj.enabled && (itemObj.domain === null || itemObj.domain === domain);
    });
  } catch (error) {
    console.error('Failed to check domain blocking:', error);
    return false;
  }
}

// 导出空对象以满足 ES 模块要求
export {};
