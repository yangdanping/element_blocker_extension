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
      document.getElementById('currentShortcut').textContent = '加载失败';
    }
  }

  async loadCurrentDomain() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const domain = getDomainFromUrl(tabs[0].url);

        if (domain && !domain.startsWith('chrome://')) {
          document.getElementById('domainName').textContent = domain;
          document.getElementById('currentDomain').style.display = 'block';
        }
      }
    } catch (error) {
      // 静默失败
    }
  }

  bindEvents() {
    document.getElementById('customizeBtn').addEventListener('click', () => {
      this.openShortcutSettings();
    });

    // 配置管理按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportConfig();
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importConfig(e.target.files[0]);
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
        url: 'chrome://extensions/shortcuts',
      });
    } catch (error) {
      // 如果无法打开设置页面，显示提示信息
      this.showMessage('请手动访问 chrome://extensions/shortcuts 来设置快捷键', 'info');
    }
  }

  async exportConfig() {
    try {
      // 从storage读取所有配置
      const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);

      // 创建导出对象
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        config: {
          blockedClasses: data.blockedClasses || [],
          isEnabled: data.isEnabled !== false,
        },
      };

      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 创建Blob对象
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `element-blocker-config-${new Date().toISOString().split('T')[0]}.json`;

      // 触发下载
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 释放URL对象
      URL.revokeObjectURL(url);

      this.showMessage('配置导出成功', 'success');
    } catch (error) {
      this.showMessage('配置导出失败：' + error.message, 'error');
    }
  }

  async importConfig(file) {
    if (!file) {
      return;
    }

    try {
      // 读取文件内容
      const content = await file.text();

      // 解析JSON
      let importData;
      try {
        importData = JSON.parse(content);
      } catch (parseError) {
        this.showMessage('文件格式错误：无效的JSON格式', 'error');
        return;
      }

      // 验证数据结构
      if (!importData.config) {
        this.showMessage('文件格式错误：缺少config字段', 'error');
        return;
      }

      const config = importData.config;

      // 验证必需字段
      if (!Array.isArray(config.blockedClasses)) {
        config.blockedClasses = [];
      }
      if (typeof config.isEnabled !== 'boolean') {
        config.isEnabled = true;
      }

      // 询问用户是覆盖还是合并
      const shouldMerge = await this.showImportDialog(config);

      if (shouldMerge === null) {
        // 用户取消
        return;
      }

      let finalConfig = config;

      if (shouldMerge) {
        // 合并模式：读取现有配置并合并
        const existingData = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);

        finalConfig = {
          blockedClasses: this.mergeArrays(existingData.blockedClasses || [], config.blockedClasses),
          isEnabled: config.isEnabled,
        };
      }

      // 保存配置
      await chrome.storage.local.set(finalConfig);

      // 清空文件选择器
      document.getElementById('importFile').value = '';

      this.showMessage(`配置${shouldMerge ? '合并' : '导入'}成功！共导入 ${finalConfig.blockedClasses.length} 条屏蔽规则`, 'success');

      // 延迟刷新页面以显示更新后的配置
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      this.showMessage('配置导入失败：' + error.message, 'error');
      // 清空文件选择器
      document.getElementById('importFile').value = '';
    }
  }

  mergeArrays(existingArr, newArr) {
    // 合并数组，避免重复项
    const merged = [...existingArr];

    newArr.forEach((newItem) => {
      if (!isDuplicateClass(merged, newItem.className, newItem.domain || null)) {
        merged.push(newItem);
      }
    });

    return merged;
  }

  showImportDialog(config) {
    return new Promise((resolve) => {
      // 创建模态对话框
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      const dialogContent = document.createElement('div');
      dialogContent.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;

      dialogContent.innerHTML = `
        <h2 style="margin-top: 0; color: #333;">导入配置</h2>
        <div style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
            <strong>文件信息：</strong>
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
            <li>屏蔽规则数量：${config.blockedClasses.length}</li>
          </ul>
        </div>
        <p style="margin: 16px 0; font-size: 14px; color: #666;">
          请选择导入方式：
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
          <button id="mergeBtn" style="padding: 8px 16px; border: none; background: #4285f4; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">合并配置</button>
          <button id="replaceBtn" style="padding: 8px 16px; border: none; background: #dc3545; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">覆盖配置</button>
        </div>
      `;

      dialog.appendChild(dialogContent);
      document.body.appendChild(dialog);

      // 绑定按钮事件
      const cancelBtn = dialogContent.querySelector('#cancelBtn');
      const mergeBtn = dialogContent.querySelector('#mergeBtn');
      const replaceBtn = dialogContent.querySelector('#replaceBtn');

      const cleanup = () => {
        document.body.removeChild(dialog);
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      mergeBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      replaceBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      // 点击背景关闭
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          cleanup();
          resolve(null);
        }
      });
    });
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
