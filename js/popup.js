class ElementBlockerPopup {
  constructor() {
    this.blockedClasses = []; // 每个元素现在是 {className: string, enabled: boolean, domain: string}
    this.isEnabled = true;
    this.currentDomain = null;
    this.initializeElements();
    this.loadData();
    this.bindEvents();
  }

  initializeElements() {
    // 屏蔽功能相关元素
    this.classInput = document.getElementById('classInput');
    this.addBtn = document.getElementById('addBtn');
    this.blockedList = document.getElementById('blockedList');
    this.toggleBtn = document.getElementById('toggleBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.inspectBtn = document.getElementById('inspectBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
  }

  async loadData() {
    try {
      // 获取当前标签页的域名
      await this.getCurrentDomain();

      const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);
      let blockedClasses = data.blockedClasses || [];

      // 向后兼容：转换旧格式数据
      this.blockedClasses = normalizeBlockedClasses(blockedClasses);

      this.isEnabled = data.isEnabled !== false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  // 获取当前域名
  async getCurrentDomain() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        this.currentDomain = getDomainFromUrl(tab.url);
      }
    } catch (error) {
      console.error('Failed to get current domain:', error);
      this.currentDomain = 'unknown';
    }
  }

  async saveData() {
    try {
      await chrome.storage.local.set({
        blockedClasses: this.blockedClasses,
        isEnabled: this.isEnabled,
      });
      this.notifyContentScript();
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  bindEvents() {
    // 屏蔽功能事件
    this.addBtn.addEventListener('click', () => this.addClass());
    this.classInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addClass();
      }
    });
    this.toggleBtn.addEventListener('click', () => this.toggleEnabled());
    this.clearBtn.addEventListener('click', () => this.clearAll());
    this.inspectBtn.addEventListener('click', () => this.startInspecting());

    // 设置按钮
    this.settingsBtn.addEventListener('click', () => this.openSettings());
  }

  addClass() {
    const inputValue = this.classInput.value.trim();
    if (!inputValue) {
      this.showMessage('请输入类名', 'error');
      return;
    }

    // 移除可能的点号前缀，并清理多余空格
    const cleanInput = inputValue.replace(/^\.+/g, '').replace(/\s+/g, ' ').trim();

    if (!cleanInput) {
      this.showMessage('请输入有效的类名', 'error');
      return;
    }

    // 检查在当前域名下是否已存在相同的类名规则
    const isDuplicate = this.blockedClasses.some((existing) => {
      if (existing.domain !== this.currentDomain) {
        return false;
      }

      if (existing.className === cleanInput) {
        return true;
      }

      // 如果是单个类名，检查是否与已有的包含匹配冲突
      if (!cleanInput.includes(' ') && !existing.className.includes(' ')) {
        return existing.className.includes(cleanInput) || cleanInput.includes(existing.className);
      }

      return false;
    });

    if (isDuplicate) {
      this.showMessage(`该类名规则在 ${this.currentDomain} 下已存在`, 'warning');
      return;
    }

    // 新增的屏蔽项，注意带上当前域名
    this.blockedClasses.push({
      className: cleanInput,
      enabled: true,
      domain: this.currentDomain,
    });
    this.classInput.value = '';
    this.saveData();
    this.updateUI();

    // 添加成功后，显示消息
    const isMultiClass = cleanInput.includes(' ');
    const matchType = isMultiClass ? '组合匹配' : '包含匹配';
    this.showMessage(`在 ${this.currentDomain} 下添加类名成功（${matchType}）`, 'success');
  }

  removeClass(className, domain = null) {
    const index = this.blockedClasses.findIndex((item) => item.className === className && (item.domain || null) === (domain || null));
    if (index > -1) {
      this.blockedClasses.splice(index, 1);
      this.saveData();
      this.updateUI();
      this.showMessage('类名已删除', 'success');
    }
  }

  toggleClassEnabled(className, domain = null) {
    const item = this.blockedClasses.find((item) => item.className === className && (item.domain || null) === (domain || null));
    if (item) {
      item.enabled = !item.enabled;
      this.saveData();
      this.updateUI();
      const messageType = item.enabled ? 'success' : 'disabled';
      this.showMessage(`${className} 已${item.enabled ? '启用' : '禁用'}`, messageType);
    }
  }

  toggleEnabled() {
    this.isEnabled = !this.isEnabled;
    this.saveData();
    this.updateUI();
    const messageType = this.isEnabled ? 'success' : 'disabled';
    this.showMessage(this.isEnabled ? '屏蔽已启用' : '屏蔽已禁用', messageType);
  }

  clearAll() {
    if (this.blockedClasses.length === 0) {
      this.showMessage('没有要清除的类名', 'info');
      return;
    }

    if (confirm('确定要清除所有屏蔽的类名吗？')) {
      this.blockedClasses = [];
      this.saveData();
      this.updateUI();
      this.showMessage('所有类名已清除', 'success');
    }
  }

  async startInspecting() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'startInspecting' });
      window.close(); // 关闭弹窗让用户在页面上操作
    } catch (error) {
      this.showMessage('无法启动元素选择器', 'error');
    }
  }

  async openSettings() {
    try {
      await chrome.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      this.showMessage('无法打开设置页面', 'error');
    }
  }

  updateUI() {
    this.updateBlockedList();
    this.updateToggleButton();
  }

  updateBlockedList() {
    if (this.blockedClasses.length === 0) {
      this.blockedList.innerHTML = '<div class="empty-list">暂无屏蔽的类名</div>';
      return;
    }

    // 按域名分组
    const groups = groupByDomain(this.blockedClasses);
    let html = '';

    // 显示当前域名的标题和屏蔽项
    if (this.currentDomain && groups[this.currentDomain]) {
      html += this.renderDomainGroup(this.currentDomain, groups[this.currentDomain], true);
    }

    // 显示全局屏蔽项（domain为null）
    if (groups[null]) {
      html += this.renderDomainGroup('全局', groups[null], true);
    }

    // 显示其他域名的屏蔽项
    Object.keys(groups).forEach((domain) => {
      if (domain !== this.currentDomain && domain !== 'null' && domain !== null) {
        html += this.renderDomainGroup(domain, groups[domain], false);
      }
    });

    this.blockedList.innerHTML = html;
    this.bindBlockedListEvents();
  }

  renderDomainGroup(domainName, items, isActive) {
    const displayName = domainName === 'null' || domainName === null ? '全局' : domainName;
    const activeClass = isActive ? 'active-domain' : 'inactive-domain';

    let html = `
      <div class="domain-group ${activeClass}">
        <div class="domain-header">
          <span class="domain-name">${displayName}</span>
          <span class="item-count">(${items.length})</span>
        </div>
    `;

    items.forEach((item) => {
      const itemActiveClass = isActive && item.enabled ? 'active' : 'inactive';
      html += `
        <div class="blocked-item ${item.enabled ? 'enabled' : 'disabled'} ${itemActiveClass}" 
             data-class="${item.className}" data-domain="${item.domain || ''}">
          <span class="class-name" title=".${item.className}">.${item.className}</span>
          <div class="item-controls">
            <span class="status-indicator" title="${item.enabled ? '已启用（点击禁用）' : '已禁用（点击启用）'}">${item.enabled ? '●' : '○'}</span>
            <button class="remove-btn" data-class="${item.className}" data-domain="${item.domain || ''}" title="删除">×</button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  bindBlockedListEvents() {
    // 绑定类名项点击事件（切换启用状态）
    this.blockedList.querySelectorAll('.blocked-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        // 如果点击的是删除按钮，不触发切换事件
        if (e.target.classList.contains('remove-btn')) {
          return;
        }
        const className = item.getAttribute('data-class');
        const domain = item.getAttribute('data-domain');
        this.toggleClassEnabled(className, domain);
      });
    });

    // 绑定删除按钮事件
    this.blockedList.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        const className = e.target.getAttribute('data-class');
        const domain = e.target.getAttribute('data-domain');
        this.removeClass(className, domain);
      });
    });
  }

  updateToggleButton() {
    if (this.isEnabled) {
      this.toggleBtn.textContent = '禁用屏蔽';
      this.toggleBtn.className = 'toggle-btn enabled';
    } else {
      this.toggleBtn.textContent = '启用屏蔽';
      this.toggleBtn.className = 'toggle-btn disabled';
    }
  }

  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateBlocking',
        blockedClasses: this.blockedClasses,
        isEnabled: this.isEnabled,
      });
    } catch (error) {
      // 静默处理错误，可能是页面还没有加载内容脚本
    }
  }

  showMessage(text, type = 'info') {
    showTempMessage(text, type);
  }
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
  new ElementBlockerPopup();
});
