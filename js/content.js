class ElementBlockerContent {
  constructor() {
    this.blockedClasses = []; // 现在包含域名信息: {className: string, enabled: boolean, domain: string}
    this.isEnabled = true;
    this.isInspecting = false;
    this.styleElement = null;
    this.highlightOverlay = null;
    this.currentHoveredElement = null;
    this.currentDomain = this.getCurrentDomain();

    this.initialize();
    this.test();
  }

  test() {
    // chrome.action.setIcon({
    //   path: {
    //     32: '/icons/icon-active.png',
    //   }
    // });
  }

  getCurrentDomain() {
    try {
      return new URL(window.location.href).hostname;
    } catch {
      return window.location.hostname || 'unknown';
    }
  }

  // localStorage相关方法
  getLocalStorageKey() {
    return `element-blocker-${this.currentDomain}`;
  }

  saveToLocalStorage(blockedClasses) {
    try {
      // 只保存当前域名相关的屏蔽项
      const domainClasses = blockedClasses.filter((item) => item.domain === this.currentDomain || item.domain === null);

      const data = {
        domain: this.currentDomain,
        blockedClasses: domainClasses,
        timestamp: Date.now()
      };

      localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  async restoreFromLocalStorage() {
    try {
      const key = this.getLocalStorageKey();
      const stored = localStorage.getItem(key);

      if (!stored) return;

      const data = JSON.parse(stored);
      if (!data.blockedClasses || !Array.isArray(data.blockedClasses)) return;

      // 获取当前chrome.storage.local中的数据
      const chromeData = await chrome.storage.local.get(['blockedClasses']);
      let existingClasses = chromeData.blockedClasses || [];

      // 向后兼容：转换旧格式数据
      existingClasses = existingClasses.map((item) => {
        if (typeof item === 'string') {
          return { className: item, enabled: true, domain: null };
        } else if (item && typeof item.domain === 'undefined') {
          return { ...item, domain: null };
        }
        return item;
      });

      // 合并localStorage中的数据到chrome.storage.local
      let hasNewData = false;
      data.blockedClasses.forEach((localItem) => {
        const exists = existingClasses.some((existingItem) => existingItem.className === localItem.className && existingItem.domain === localItem.domain);

        if (!exists) {
          existingClasses.push(localItem);
          hasNewData = true;
        }
      });

      // 如果有新数据，保存到chrome.storage.local
      if (hasNewData) {
        await chrome.storage.local.set({ blockedClasses: existingClasses });
        console.log(`从localStorage恢复了 ${this.currentDomain} 的屏蔽数据`);
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error);
    }
  }

  async initialize() {
    // 先从localStorage恢复数据
    await this.restoreFromLocalStorage();

    // 加载存储的设置
    await this.loadSettings();

    // 创建样式元素
    this.createStyleElement();

    // 应用屏蔽样式
    this.updateBlockingStyles();

    // 监听消息
    this.setupMessageListener();

    // 监听存储变化
    this.setupStorageListener();

    // 初始化时通知background更新图标
    this.notifyBackgroundUpdateIcon();
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);
      let blockedClasses = data.blockedClasses || [];

      // 向后兼容：转换旧格式数据
      this.blockedClasses = blockedClasses.map((item) => {
        if (typeof item === 'string') {
          // 旧格式：字符串 -> 新格式：对象（不带域名，全局生效）
          return { className: item, enabled: true, domain: null };
        } else if (item && typeof item.domain === 'undefined') {
          // 中间格式：对象但没有域名 -> 添加域名字段
          return { ...item, domain: null };
        }
        return item;
      });

      this.isEnabled = data.isEnabled !== false;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  createStyleElement() {
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'element-blocker-styles';
    document.head.appendChild(this.styleElement);
  }

  updateBlockingStyles() {
    if (!this.styleElement) return;

    let css = '';

    if (this.isEnabled && this.blockedClasses.length > 0) {
      // 只为启用的且匹配当前域名的类名生成CSS规则
      const activeClasses = this.blockedClasses.filter((item) => {
        return item.enabled && (item.domain === null || item.domain === this.currentDomain);
      });

      if (activeClasses.length > 0) {
        const selectors = activeClasses.map((item) => this.generateSelector(item.className)).join(', ');
        css = `${selectors} { display: none !important; }`;
      }
    }

    this.styleElement.textContent = css;
  }

  generateSelector(className) {
    // 检查是否是多个类名（以空格分隔）
    if (className.includes(' ')) {
      // 多个类名：需要同时包含所有指定的类
      const classes = className.trim().split(/\s+/);
      // 生成类似 .class1.class2.class3 的选择器（AND逻辑）
      return classes.map((cls) => `[class~="${cls}"]`).join('');
    } else {
      // 单个类名：使用包含匹配
      return `[class*="${className}"]`;
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'updateBlocking':
          this.blockedClasses = message.blockedClasses || [];
          this.isEnabled = message.isEnabled;
          this.updateBlockingStyles();
          sendResponse({ success: true });
          break;

        case 'startInspecting':
          this.startInspectingMode();
          sendResponse({ success: true });
          break;

        case 'toggleDomainBlocking':
          this.toggleDomainBlocking(message.domain);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.blockedClasses) {
          this.blockedClasses = changes.blockedClasses.newValue || [];
          this.updateBlockingStyles();
          this.notifyBackgroundUpdateIcon();
        }
        if (changes.isEnabled) {
          this.isEnabled = changes.isEnabled.newValue;
          this.updateBlockingStyles();
          this.notifyBackgroundUpdateIcon();
        }
      }
    });
  }

  startInspectingMode() {
    if (this.isInspecting) return;

    this.isInspecting = true;
    document.body.style.cursor = 'crosshair';

    // 创建高亮覆盖层
    this.createHighlightOverlay();

    // 显示提示消息
    this.showInspectMessage();

    // 绑定事件
    document.addEventListener('mouseover', this.handleMouseOver);
    document.addEventListener('mouseout', this.handleMouseOut);
    document.addEventListener('click', this.handleInspectClick);
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  stopInspectingMode() {
    if (!this.isInspecting) return;

    this.isInspecting = false;
    document.body.style.cursor = '';

    // 移除高亮覆盖层
    this.removeHighlightOverlay();

    // 移除提示消息
    this.removeInspectMessage();

    // 解绑事件
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('click', this.handleInspectClick);
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  handleMouseOver = (event) => {
    if (!this.isInspecting) return;

    event.stopPropagation();
    this.currentHoveredElement = event.target;
    this.highlightElement(event.target);
  };

  handleMouseOut = (event) => {
    if (!this.isInspecting) return;

    this.removeHighlight();
  };

  handleInspectClick = (event) => {
    if (!this.isInspecting) return;

    event.preventDefault();
    event.stopPropagation();

    const element = event.target;
    const classes = Array.from(element.classList);

    if (classes.length === 0) {
      this.showTempMessage('该元素没有类名', 'warning');
      return;
    }

    // 显示类名选择对话框
    this.showClassSelector(classes, element);
  };

  handleEscapeKey = (event) => {
    if (event.key === 'Escape' && this.isInspecting) {
      this.stopInspectingMode();
    }
  };

  createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #ff4444;
      background-color: rgba(255, 68, 68, 0.1);
      z-index: 999999;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  removeHighlightOverlay() {
    if (this.highlightOverlay && this.highlightOverlay.parentNode) {
      this.highlightOverlay.parentNode.removeChild(this.highlightOverlay);
      this.highlightOverlay = null;
    }
  }

  highlightElement(element) {
    if (!this.highlightOverlay) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    this.highlightOverlay.style.cssText += `
      display: block;
      left: ${rect.left + scrollX}px;
      top: ${rect.top + scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;
  }

  removeHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
  }

  showClassSelector(classes, element) {
    // 创建模态对话框
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 1000000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 450px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
    `;

    const title = document.createElement('h3');
    title.textContent = '选择要屏蔽的类名';
    title.style.cssText = 'margin: 0 0 16px 0; color: #333;';

    // 添加全选按钮和组合屏蔽选项
    const selectAllContainer = document.createElement('div');
    selectAllContainer.style.cssText = 'margin-bottom: 12px; padding: 12px; background-color: #f8f9fa; border-radius: 6px;';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '屏蔽组合类名';
    selectAllBtn.style.cssText = `
      width: 100%;
      background-color: #66b279;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    `;

    selectAllBtn.addEventListener('click', () => {
      const combinedClasses = classes.join(' ');
      this.addBlockedClass(combinedClasses);
      document.body.removeChild(modal);
      this.stopInspectingMode();
    });

    const selectAllHint = document.createElement('div');
    selectAllHint.textContent = `将屏蔽同时包含以下所有类的元素：.${classes.join(' .')}`;
    selectAllHint.style.cssText = 'font-size: 11px; color: #666; text-align: center; font-family: monospace;';

    selectAllContainer.appendChild(selectAllBtn);
    selectAllContainer.appendChild(selectAllHint);

    // 单个类名选项
    const individualTitle = document.createElement('h4');
    individualTitle.textContent = '或者屏蔽单个类名：';
    individualTitle.style.cssText = 'margin: 16px 0 8px 0; color: #555; font-size: 14px;';

    const classList = document.createElement('div');
    classes.forEach((className) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px;
        margin: 4px 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const classSpan = document.createElement('span');
      classSpan.textContent = `.${className}`;
      classSpan.style.fontFamily = 'monospace';

      const addBtn = document.createElement('button');
      addBtn.textContent = '屏蔽';
      addBtn.style.cssText = `
        background-color: #dc3545;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      `;

      addBtn.addEventListener('click', () => {
        this.addBlockedClass(className);
        document.body.removeChild(modal);
        this.stopInspectingMode();
      });

      item.appendChild(classSpan);
      item.appendChild(addBtn);
      classList.appendChild(item);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      background-color: #6c757d;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 16px;
      width: 100%;
    `;

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      this.stopInspectingMode();
    });

    dialog.appendChild(title);
    dialog.appendChild(selectAllContainer);
    dialog.appendChild(individualTitle);
    dialog.appendChild(classList);
    dialog.appendChild(cancelBtn);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
  }

  async addBlockedClass(className) {
    try {
      // 获取当前设置
      const data = await chrome.storage.local.get(['blockedClasses']);
      let blockedClasses = data.blockedClasses || [];

      // 向后兼容：转换旧格式数据
      blockedClasses = blockedClasses.map((item) => {
        if (typeof item === 'string') {
          return { className: item, enabled: true, domain: null };
        } else if (item && typeof item.domain === 'undefined') {
          return { ...item, domain: null };
        }
        return item;
      });

      // 检查是否已存在（同名同域名）
      const isDuplicate = blockedClasses.some((item) => item.className === className && item.domain === this.currentDomain);

      if (!isDuplicate) {
        // 新增的屏蔽项带上当前域名
        blockedClasses.push({
          className,
          enabled: true,
          domain: this.currentDomain
        });
        await chrome.storage.local.set({ blockedClasses });

        // 同时保存到localStorage作为备份
        this.saveToLocalStorage(blockedClasses);

        // 通知background更新图标
        this.notifyBackgroundUpdateIcon();

        this.showTempMessage(`已在 ${this.currentDomain} 下屏蔽类名: .${className}`, 'success');
      } else {
        this.showTempMessage(`该类名在 ${this.currentDomain} 下已被屏蔽`, 'warning');
      }
    } catch (error) {
      console.error('Failed to add blocked class:', error);
      this.showTempMessage('添加失败', 'error');
    }
  }

  async toggleDomainBlocking(domain) {
    if (domain !== this.currentDomain) {
      return; // 只处理当前域名的切换
    }

    try {
      const data = await chrome.storage.local.get(['blockedClasses']);
      let blockedClasses = data.blockedClasses || [];

      // 获取当前域名下的屏蔽项
      const domainClasses = blockedClasses.filter((item) => item.domain === this.currentDomain || item.domain === null);

      if (domainClasses.length === 0) {
        this.showTempMessage(`${this.currentDomain} 下没有可切换的屏蔽项`, 'info');
        return;
      }

      // 检查当前状态：如果所有项都已启用，则禁用；否则启用所有项
      const enabledCount = domainClasses.filter((item) => item.enabled).length;
      const newEnabledState = enabledCount === 0;

      // 更新状态
      blockedClasses.forEach((item) => {
        if (item.domain === this.currentDomain || item.domain === null) {
          item.enabled = newEnabledState;
        }
      });

      await chrome.storage.local.set({ blockedClasses });

      // 同时保存到localStorage作为备份
      this.saveToLocalStorage(blockedClasses);

      // 通知background更新图标
      this.notifyBackgroundUpdateIcon();

      const statusText = newEnabledState ? '已启用' : '已禁用';
      const messageType = newEnabledState ? 'success' : 'disabled';
      this.showTempMessage(`${this.currentDomain} 下的所有屏蔽项${statusText}`, messageType);
    } catch (error) {
      console.error('Failed to toggle domain blocking:', error);
      this.showTempMessage('切换失败', 'error');
    }
  }

  showInspectMessage() {
    const message = document.createElement('div');
    message.id = 'element-blocker-inspect-message';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #17a2b8;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      z-index: 1000001;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    message.textContent = '悬停元素查看高亮，点击选择要屏蔽的类名。按 Esc 退出。';
    document.body.appendChild(message);
  }

  removeInspectMessage() {
    const message = document.getElementById('element-blocker-inspect-message');
    if (message && message.parentNode) {
      message.parentNode.removeChild(message);
    }
  }

  showTempMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 4px;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      z-index: 1000001;
      ${type === 'success' ? 'background-color: #66b279;' : ''}
      ${type === 'error' ? 'background-color: #dc3545;' : ''}
      ${type === 'warning' ? 'background-color: #ffc107; color: #212529;' : ''}
      ${type === 'info' ? 'background-color: #17a2b8;' : ''}
      ${type === 'disabled' ? 'background-color: #6b6b6b;' : ''}
    `;
    message.textContent = text;
    document.body.appendChild(message);

    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  notifyBackgroundUpdateIcon() {
    try {
      chrome.runtime.sendMessage({ action: 'updateIcon' });
    } catch (error) {
      // 静默处理错误，可能background script还未准备好
      console.log('Failed to notify background to update icon:', error);
    }
  }
}

// 初始化内容脚本
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ElementBlockerContent();
  });
} else {
  new ElementBlockerContent();
}
