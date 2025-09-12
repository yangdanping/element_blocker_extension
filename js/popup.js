class ElementBlockerPopup {
  constructor() {
    this.blockedClasses = []; // 每个元素现在是 {className: string, enabled: boolean, domain: string}
    this.customStyles = []; // CSS修改项: {className: string, cssRules: string, enabled: boolean, domain: string}
    this.isEnabled = true;
    this.isStyleEnabled = true;
    this.currentDomain = null;
    this.currentTab = 'block'; // 'block' 或 'style'
    this.currentEditingStyle = null; // 当前正在编辑的样式项
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

    // Tab切换相关元素
    this.blockTab = document.getElementById('blockTab');
    this.styleTab = document.getElementById('styleTab');
    this.blockContent = document.getElementById('blockContent');
    this.styleContent = document.getElementById('styleContent');

    // CSS修改功能相关元素
    this.styleClassInput = document.getElementById('styleClassInput');
    this.addStyleBtn = document.getElementById('addStyleBtn');
    this.styleList = document.getElementById('styleList');
    this.toggleStyleBtn = document.getElementById('toggleStyleBtn');
    this.clearStyleBtn = document.getElementById('clearStyleBtn');

    // CSS编辑模态框相关元素
    this.cssModal = document.getElementById('cssModal');
    this.cssModalTitle = document.getElementById('cssModalTitle');
    this.cssModalClose = document.getElementById('cssModalClose');
    this.cssInput = document.getElementById('cssInput');
    this.cssModalCancel = document.getElementById('cssModalCancel');
    this.cssModalSave = document.getElementById('cssModalSave');
  }

  async loadData() {
    try {
      // 获取当前标签页的域名
      await this.getCurrentDomain();

      const data = await chrome.storage.local.get(['blockedClasses', 'customStyles', 'isEnabled', 'isStyleEnabled']);
      let blockedClasses = data.blockedClasses || [];
      let customStyles = data.customStyles || [];

      // 向后兼容：转换旧格式数据
      this.blockedClasses = blockedClasses.map((item) => {
        if (typeof item === 'string') {
          return { className: item, enabled: true, domain: null };
        } else if (item && typeof item.domain === 'undefined') {
          return { ...item, domain: null };
        }
        return item;
      });

      // 处理自定义样式数据
      this.customStyles = customStyles.map((item) => {
        if (item && typeof item.domain === 'undefined') {
          return { ...item, domain: null };
        }
        return item;
      });

      this.isEnabled = data.isEnabled !== false;
      this.isStyleEnabled = data.isStyleEnabled !== false;
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
        const url = new URL(tab.url);
        this.currentDomain = url.hostname;
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
        customStyles: this.customStyles,
        isEnabled: this.isEnabled,
        isStyleEnabled: this.isStyleEnabled
      });
      this.notifyContentScript();
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  bindEvents() {
    // Tab切换事件
    this.blockTab.addEventListener('click', () => this.switchTab('block'));
    this.styleTab.addEventListener('click', () => this.switchTab('style'));

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

    // CSS修改功能事件
    this.addStyleBtn.addEventListener('click', () => this.addStyle());
    this.styleClassInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addStyle();
      }
    });
    this.toggleStyleBtn.addEventListener('click', () => this.toggleStyleEnabled());
    this.clearStyleBtn.addEventListener('click', () => this.clearAllStyles());

    // CSS编辑模态框事件
    this.cssModalClose.addEventListener('click', () => this.closeCssModal());
    this.cssModalCancel.addEventListener('click', () => this.closeCssModal());
    this.cssModalSave.addEventListener('click', () => this.saveCssRules());

    // 模态框背景点击关闭
    this.cssModal.addEventListener('click', (e) => {
      if (e.target === this.cssModal) {
        this.closeCssModal();
      }
    });

    // CSS示例按钮事件
    document.querySelectorAll('.example-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const css = btn.getAttribute('data-css');
        this.cssInput.value = css;
      });
    });

    // 设置按钮
    this.settingsBtn.addEventListener('click', () => this.openSettings());
  }

  // Tab切换方法
  switchTab(tab) {
    this.currentTab = tab;

    // 更新Tab按钮状态
    this.blockTab.classList.toggle('active', tab === 'block');
    this.styleTab.classList.toggle('active', tab === 'style');

    // 更新内容显示
    this.blockContent.classList.toggle('active', tab === 'block');
    this.styleContent.classList.toggle('active', tab === 'style');
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
      domain: this.currentDomain
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
      console.error('Failed to start inspecting:', error);
      this.showMessage('无法启动元素选择器', 'error');
    }
  }

  async openSettings() {
    try {
      await chrome.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      console.error('Failed to open settings:', error);
      this.showMessage('无法打开设置页面', 'error');
    }
  }

  // CSS修改功能方法
  addStyle() {
    const inputValue = this.styleClassInput.value.trim();
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
    const isDuplicate = this.customStyles.some((existing) => {
      if (existing.domain !== this.currentDomain) {
        return false;
      }
      return existing.className === cleanInput;
    });

    if (isDuplicate) {
      this.showMessage(`该类名规则在 ${this.currentDomain} 下已存在`, 'warning');
      return;
    }

    // 新增的样式修改项
    const newStyle = {
      className: cleanInput,
      cssRules: '',
      enabled: true,
      domain: this.currentDomain
    };

    this.customStyles.push(newStyle);
    this.styleClassInput.value = '';
    this.saveData();
    this.updateUI();

    // 添加成功后，立即打开编辑模态框
    this.openCssModal(newStyle);

    const isMultiClass = cleanInput.includes(' ');
    const matchType = isMultiClass ? '组合匹配' : '包含匹配';
    this.showMessage(`在 ${this.currentDomain} 下添加样式修改成功（${matchType}）`, 'success');
  }

  removeStyle(className, domain = null) {
    const index = this.customStyles.findIndex((item) => item.className === className && (item.domain || null) === (domain || null));
    if (index > -1) {
      this.customStyles.splice(index, 1);
      this.saveData();
      this.updateUI();
      this.showMessage('样式修改项已删除', 'success');
    }
  }

  toggleStyleItemEnabled(className, domain = null) {
    const item = this.customStyles.find((item) => item.className === className && (item.domain || null) === (domain || null));
    if (item) {
      item.enabled = !item.enabled;
      this.saveData();
      this.updateUI();
      const messageType = item.enabled ? 'success' : 'disabled';
      this.showMessage(`${className} 样式修改已${item.enabled ? '启用' : '禁用'}`, messageType);
    }
  }

  toggleStyleEnabled() {
    this.isStyleEnabled = !this.isStyleEnabled;
    this.saveData();
    this.updateUI();
    const messageType = this.isStyleEnabled ? 'success' : 'disabled';
    this.showMessage(this.isStyleEnabled ? '样式修改已启用' : '样式修改已禁用', messageType);
  }

  clearAllStyles() {
    if (this.customStyles.length === 0) {
      this.showMessage('没有要清除的样式修改项', 'info');
      return;
    }

    if (confirm('确定要清除所有样式修改项吗？')) {
      this.customStyles = [];
      this.saveData();
      this.updateUI();
      this.showMessage('所有样式修改项已清除', 'success');
    }
  }

  // CSS编辑模态框方法
  openCssModal(styleItem) {
    this.currentEditingStyle = styleItem;
    this.cssModalTitle.textContent = `编辑 .${styleItem.className} 的CSS规则`;
    this.cssInput.value = styleItem.cssRules || '';
    this.cssModal.classList.add('show');
  }

  closeCssModal() {
    this.cssModal.classList.remove('show');
    this.currentEditingStyle = null;
  }

  saveCssRules() {
    if (!this.currentEditingStyle) return;

    const cssRules = this.cssInput.value.trim();
    this.currentEditingStyle.cssRules = cssRules;

    this.saveData();
    this.updateUI();
    this.closeCssModal();

    if (cssRules) {
      this.showMessage('CSS规则已保存', 'success');
    } else {
      this.showMessage('CSS规则已清空', 'info');
    }
  }

  updateUI() {
    this.updateBlockedList();
    this.updateStyleList();
    this.updateToggleButton();
    this.updateStyleToggleButton();
  }

  updateBlockedList() {
    if (this.blockedClasses.length === 0) {
      this.blockedList.innerHTML = '<div class="empty-list">暂无屏蔽的类名</div>';
      return;
    }

    // 按域名分组
    const groups = this.groupByDomain(this.blockedClasses);
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

  groupByDomain(blockedClasses) {
    const groups = {};
    blockedClasses.forEach((item) => {
      const domain = item.domain || null;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(item);
    });
    return groups;
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

  updateStyleList() {
    if (this.customStyles.length === 0) {
      this.styleList.innerHTML = '<div class="empty-list">暂无样式修改的类名</div>';
      return;
    }

    // 按域名分组
    const groups = this.groupStylesByDomain(this.customStyles);
    let html = '';

    // 显示当前域名的标题和样式修改项
    if (this.currentDomain && groups[this.currentDomain]) {
      html += this.renderStyleDomainGroup(this.currentDomain, groups[this.currentDomain], true);
    }

    // 显示全局样式修改项（domain为null）
    if (groups[null]) {
      html += this.renderStyleDomainGroup('全局', groups[null], true);
    }

    // 显示其他域名的样式修改项
    Object.keys(groups).forEach((domain) => {
      if (domain !== this.currentDomain && domain !== 'null' && domain !== null) {
        html += this.renderStyleDomainGroup(domain, groups[domain], false);
      }
    });

    this.styleList.innerHTML = html;
    this.bindStyleListEvents();
  }

  groupStylesByDomain(customStyles) {
    const groups = {};
    customStyles.forEach((item) => {
      const domain = item.domain || null;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(item);
    });
    return groups;
  }

  renderStyleDomainGroup(domainName, items, isActive) {
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
      const hasRules = item.cssRules && item.cssRules.trim();
      const rulesPreview = hasRules ? item.cssRules.substring(0, 30) + (item.cssRules.length > 30 ? '...' : '') : '未设置CSS规则';

      html += `
        <div class="blocked-item ${item.enabled ? 'enabled' : 'disabled'} ${itemActiveClass}" 
             data-class="${item.className}" data-domain="${item.domain || ''}">
          <div class="style-item-content">
            <span class="class-name" title=".${item.className}">.${item.className}</span>
            <span class="css-preview" title="${item.cssRules || '未设置CSS规则'}">${rulesPreview}</span>
          </div>
          <div class="item-controls">
            <span class="status-indicator" title="${item.enabled ? '已启用（点击禁用）' : '已禁用（点击启用）'}">${item.enabled ? '●' : '○'}</span>
            <button class="edit-btn" data-class="${item.className}" data-domain="${item.domain || ''}" title="编辑CSS规则">✎</button>
            <button class="remove-btn" data-class="${item.className}" data-domain="${item.domain || ''}" title="删除">×</button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  bindStyleListEvents() {
    // 绑定样式项点击事件（切换启用状态）
    this.styleList.querySelectorAll('.blocked-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        // 如果点击的是编辑或删除按钮，不触发切换事件
        if (e.target.classList.contains('edit-btn') || e.target.classList.contains('remove-btn')) {
          return;
        }
        const className = item.getAttribute('data-class');
        const domain = item.getAttribute('data-domain');
        this.toggleStyleItemEnabled(className, domain);
      });
    });

    // 绑定编辑按钮事件
    this.styleList.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const className = e.target.getAttribute('data-class');
        const domain = e.target.getAttribute('data-domain');
        const styleItem = this.customStyles.find((item) => item.className === className && (item.domain || '') === domain);
        if (styleItem) {
          this.openCssModal(styleItem);
        }
      });
    });

    // 绑定删除按钮事件
    this.styleList.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const className = e.target.getAttribute('data-class');
        const domain = e.target.getAttribute('data-domain');
        this.removeStyle(className, domain);
      });
    });
  }

  updateStyleToggleButton() {
    if (this.isStyleEnabled) {
      this.toggleStyleBtn.textContent = '禁用样式修改';
      this.toggleStyleBtn.className = 'toggle-btn enabled';
    } else {
      this.toggleStyleBtn.textContent = '启用样式修改';
      this.toggleStyleBtn.className = 'toggle-btn disabled';
    }
  }

  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateBlocking',
        blockedClasses: this.blockedClasses,
        customStyles: this.customStyles,
        isEnabled: this.isEnabled,
        isStyleEnabled: this.isStyleEnabled
      });
    } catch (error) {
      // 静默处理错误，可能是页面还没有加载内容脚本
      console.log('Content script not ready:', error);
    }
  }

  showMessage(text, type = 'info') {
    // 创建临时消息提示
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      z-index: 10000;
      ${type === 'success' ? 'background-color: #66b279;' : ''}
      ${type === 'error' ? 'background-color: #dc3545;' : ''}
      ${type === 'warning' ? 'background-color: #ffc107; color: #212529;' : ''}
      ${type === 'info' ? 'background-color: #17a2b8;' : ''}
      ${type === 'disabled' ? 'background-color: #6b6b6b;' : ''}
    `;

    document.body.appendChild(message);
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 2000);
  }
}

// 初始化插件
document.addEventListener('DOMContentLoaded', () => {
  new ElementBlockerPopup();
});
