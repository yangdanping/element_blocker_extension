/**
 * =========================================
 * Element Blocker - Content Script
 * =========================================
 *
 * 注入到网页中的脚本，负责：
 * 1. 元素屏蔽（通过动态 CSS）
 * 2. 元素选择器（可视化选择要屏蔽的元素）
 * 3. localStorage 备份（保留原有功能）
 * 4. 与 popup/background 通信
 */

import { generateSelector, getDomainFromUrl, getDomainDisplayName } from '@/lib/utils';
import type { BlockedClass, Message } from '@/lib/types';
import './styles.css';

// =========================================
// 全局状态
// =========================================

let blockedClasses: BlockedClass[] = [];
let isEnabled = true;
let isInspecting = false;
const currentDomain = getDomainFromUrl(window.location.href);

// DOM 元素引用
let styleElement: HTMLStyleElement | null = null;
let highlightOverlay: HTMLDivElement | null = null;
let currentHoveredElement: HTMLElement | null = null;

// =========================================
// 核心功能：元素屏蔽
// =========================================

/**
 * 创建屏蔽样式元素
 */
function createStyleElement() {
  styleElement = document.createElement('style');
  styleElement.id = 'element-blocker-styles';
  document.head.appendChild(styleElement);
}

/**
 * 更新屏蔽样式
 * 根据当前的屏蔽规则生成 CSS 并应用
 */
function updateBlockingStyles() {
  if (!styleElement) return;

  let css = '';

  if (isEnabled && blockedClasses.length > 0) {
    // 过滤出当前域名下激活的屏蔽项
    const activeClasses = blockedClasses.filter((item) => item.enabled && (item.domain === null || item.domain === currentDomain));

    if (activeClasses.length > 0) {
      const selectors = activeClasses.map((item) => generateSelector(item.className)).join(', ');
      css = `${selectors} { display: none !important; }`;
    }
  }

  styleElement.textContent = css;
}

// =========================================
// localStorage 备份机制
// =========================================

/**
 * 获取 localStorage key
 */
function getLocalStorageKey(): string {
  return `element-blocker-${currentDomain}`;
}

/**
 * 保存到 localStorage
 */
function saveToLocalStorage(classes: BlockedClass[]) {
  try {
    const domainClasses = classes.filter((item) => item.domain === currentDomain || item.domain === null);

    const data = {
      domain: currentDomain,
      blockedClasses: domainClasses,
      timestamp: Date.now(),
    };

    localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
  } catch {
    // 静默失败
  }
}

/**
 * 从 localStorage 恢复数据
 */
async function restoreFromLocalStorage() {
  try {
    const stored = localStorage.getItem(getLocalStorageKey());
    if (!stored) return;

    const data = JSON.parse(stored);
    if (!data.blockedClasses || !Array.isArray(data.blockedClasses)) return;

    // 获取 Chrome Storage 中的数据
    const chromeData = await chrome.storage.local.get(['blockedClasses']);
    let existingClasses: BlockedClass[] = (chromeData.blockedClasses as BlockedClass[]) || [];

    // 向后兼容
    existingClasses = normalizeBlockedClasses(existingClasses);

    // 合并数据
    let hasNewData = false;
    data.blockedClasses.forEach((localItem: BlockedClass) => {
      const exists = existingClasses.some((existing) => existing.className === localItem.className && existing.domain === localItem.domain);
      if (!exists) {
        existingClasses.push(localItem);
        hasNewData = true;
      }
    });

    if (hasNewData) {
      await chrome.storage.local.set({ blockedClasses: existingClasses });
    }
  } catch {
    // 静默失败
  }
}

/**
 * 向后兼容：转换旧格式数据
 */
function normalizeBlockedClasses(data: unknown[]): BlockedClass[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item === 'string') {
      return { className: item, enabled: true, domain: null };
    }
    if (item && typeof item === 'object' && !('domain' in item)) {
      return { ...(item as BlockedClass), domain: null };
    }
    return item as BlockedClass;
  });
}

// =========================================
// 元素检查模式
// =========================================

/**
 * 启动元素检查模式
 */
function startInspectingMode() {
  if (isInspecting) return;

  isInspecting = true;
  document.body.style.cursor = 'crosshair';

  createHighlightOverlay();
  showInspectMessage();

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleInspectClick, true);
  document.addEventListener('keydown', handleEscapeKey, true);
}

/**
 * 停止元素检查模式
 */
function stopInspectingMode() {
  if (!isInspecting) return;

  isInspecting = false;
  document.body.style.cursor = '';

  removeHighlightOverlay();
  removeInspectMessage();

  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleInspectClick, true);
  document.removeEventListener('keydown', handleEscapeKey, true);
}

/**
 * 创建高亮覆盖层
 */
function createHighlightOverlay() {
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'element-blocker-highlight';
  document.body.appendChild(highlightOverlay);
}

/**
 * 移除高亮覆盖层
 */
function removeHighlightOverlay() {
  if (highlightOverlay?.parentNode) {
    highlightOverlay.parentNode.removeChild(highlightOverlay);
    highlightOverlay = null;
  }
}

/**
 * 高亮指定元素
 */
function highlightElement(element: HTMLElement) {
  if (!highlightOverlay) return;

  const rect = element.getBoundingClientRect();
  const scrollX = window.pageXOffset;
  const scrollY = window.pageYOffset;

  highlightOverlay.style.display = 'block';
  highlightOverlay.style.left = `${rect.left + scrollX}px`;
  highlightOverlay.style.top = `${rect.top + scrollY}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
}

/**
 * 移除高亮
 */
function removeHighlight() {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
}

// =========================================
// 事件处理器
// =========================================

function handleMouseOver(event: MouseEvent) {
  if (!isInspecting) return;

  // 检查是否点击的是弹窗内的元素
  const target = event.target as HTMLElement;
  if (target.closest('[data-element-blocker-modal]')) {
    return;
  }

  event.stopPropagation();
  currentHoveredElement = target;
  highlightElement(currentHoveredElement);
}

function handleMouseOut(event: MouseEvent) {
  if (!isInspecting) return;

  // 检查是否点击的是弹窗内的元素
  const target = event.target as HTMLElement;
  if (target.closest('[data-element-blocker-modal]')) {
    return;
  }

  removeHighlight();
}

function handleInspectClick(event: MouseEvent) {
  if (!isInspecting) return;

  // 检查是否点击的是弹窗内的元素
  const element = event.target as HTMLElement;
  if (element.closest('[data-element-blocker-modal]')) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const classes = Array.from(element.classList);

  if (classes.length === 0) {
    showTempMessage('该元素没有类名', 'warning');
    return;
  }

  showClassSelector(classes);
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && isInspecting) {
    stopInspectingMode();
  }
}

// =========================================
// 类名选择器对话框
// =========================================

/**
 * 显示类名选择对话框
 */
function showClassSelector(classes: string[]) {
  // 用于存储标签输入框的值
  let labelInputValue = '';

  // 创建模态背景
  const modal = document.createElement('div');
  modal.setAttribute('data-element-blocker-modal', 'true');
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
    font-family: system-ui, -apple-system, sans-serif;
    cursor: default;
  `;

  // 创建对话框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 12px;
    max-width: 450px;
    width: 90%;
    max-height: 80%;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    cursor: default;
  `;

  // 标题
  const title = document.createElement('h3');
  title.textContent = '选择要屏蔽的类名';
  title.style.cssText = 'margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;';

  // 标签输入区域
  const labelSection = document.createElement('div');
  labelSection.style.cssText = `
    margin-bottom: 16px;
    padding: 12px;
    background-color: #fef3c7;
    border-radius: 8px;
    border: 1px solid #fcd34d;
  `;

  const labelTitle = document.createElement('div');
  labelTitle.textContent = '🏷️ 添加标签（可选）';
  labelTitle.style.cssText = 'font-size: 13px; font-weight: 500; color: #92400e; margin-bottom: 8px;';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = '如：评论区、广告横幅、侧边栏';
  labelInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  `;
  labelInput.onfocus = () => (labelInput.style.borderColor = '#3b82f6');
  labelInput.onblur = () => (labelInput.style.borderColor = '#d1d5db');
  labelInput.oninput = () => {
    labelInputValue = labelInput.value;
  };

  const labelHint = document.createElement('div');
  labelHint.textContent = '标签可以帮助你记住这个屏蔽规则的用途';
  labelHint.style.cssText = 'font-size: 11px; color: #92400e; margin-top: 6px;';

  labelSection.appendChild(labelTitle);
  labelSection.appendChild(labelInput);
  labelSection.appendChild(labelHint);

  // 组合屏蔽区域
  const combineSection = document.createElement('div');
  combineSection.style.cssText = `
    margin-bottom: 16px;
    padding: 16px;
    background-color: #f3f4f6;
    border-radius: 8px;
  `;

  const combineBtn = document.createElement('button');
  combineBtn.textContent = '屏蔽组合类名';
  combineBtn.style.cssText = `
    width: 100%;
    background-color: #81C995;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    transition: background-color 0.2s;
  `;
  combineBtn.onmouseover = () => (combineBtn.style.backgroundColor = '#6bb582');
  combineBtn.onmouseout = () => (combineBtn.style.backgroundColor = '#81C995');

  combineBtn.onclick = () => {
    const combinedClasses = classes.join(' ');
    addBlockedClass(combinedClasses, labelInputValue);
    document.body.removeChild(modal);
    stopInspectingMode();
  };

  const combineHint = document.createElement('div');
  combineHint.textContent = `将屏蔽同时包含以下所有类的元素：.${classes.join(' .')}`;
  combineHint.style.cssText = 'font-size: 12px; color: #6b7280; text-align: center; font-family: monospace; word-break: break-all;';

  combineSection.appendChild(combineBtn);
  combineSection.appendChild(combineHint);

  // 单个类名区域
  const singleTitle = document.createElement('h4');
  singleTitle.textContent = '或者屏蔽单个类名：';
  singleTitle.style.cssText = 'margin: 16px 0 12px 0; color: #4b5563; font-size: 14px; font-weight: 500;';

  const classList = document.createElement('div');
  classList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  classes.forEach((className) => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.2s;
    `;
    item.onmouseover = () => (item.style.borderColor = '#3b82f6');
    item.onmouseout = () => (item.style.borderColor = '#e5e7eb');

    const classSpan = document.createElement('span');
    classSpan.textContent = `.${className}`;
    classSpan.style.cssText = 'font-family: monospace; font-size: 13px; color: #1f2937;';

    const addBtn = document.createElement('button');
    addBtn.textContent = '屏蔽';
    addBtn.style.cssText = `
      background-color: #ef4444;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.2s;
    `;
    addBtn.onmouseover = () => (addBtn.style.backgroundColor = '#dc2626');
    addBtn.onmouseout = () => (addBtn.style.backgroundColor = '#ef4444');

    addBtn.onclick = () => {
      addBlockedClass(className, labelInputValue);
      document.body.removeChild(modal);
      stopInspectingMode();
    };

    item.appendChild(classSpan);
    item.appendChild(addBtn);
    classList.appendChild(item);
  });

  // 取消按钮
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    background-color: #6b7280;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 16px;
    width: 100%;
    font-size: 14px;
    transition: background-color 0.2s;
  `;
  cancelBtn.onmouseover = () => (cancelBtn.style.backgroundColor = '#4b5563');
  cancelBtn.onmouseout = () => (cancelBtn.style.backgroundColor = '#6b7280');

  cancelBtn.onclick = () => {
    document.body.removeChild(modal);
    stopInspectingMode();
  };

  // 组装
  dialog.appendChild(title);
  dialog.appendChild(labelSection);
  dialog.appendChild(combineSection);
  dialog.appendChild(singleTitle);
  dialog.appendChild(classList);
  dialog.appendChild(cancelBtn);
  modal.appendChild(dialog);
  document.body.appendChild(modal);

  // 自动聚焦到标签输入框
  setTimeout(() => labelInput.focus(), 100);
}

/**
 * 添加屏蔽类名（带可选标签）
 */
async function addBlockedClass(className: string, label?: string) {
  try {
    const data = await chrome.storage.local.get(['blockedClasses']);
    let classes: BlockedClass[] = normalizeBlockedClasses((data.blockedClasses as BlockedClass[]) || []);

    // 检查重复
    const isDuplicate = classes.some((item) => item.className === className && item.domain === currentDomain);

    if (!isDuplicate) {
      const newItem: BlockedClass = {
        className,
        enabled: true,
        domain: currentDomain,
      };
      // 只有当 label 有实际值时才添加
      if (label && label.trim()) {
        newItem.label = label.trim();
      }
      classes.push(newItem);

      await chrome.storage.local.set({ blockedClasses: classes });

      // 备份到 localStorage
      saveToLocalStorage(classes);

      // 通知 background 更新图标
      notifyBackgroundUpdateIcon();

      showTempMessage(`已在 ${getDomainDisplayName(currentDomain)} 下屏蔽类名: .${className}`, 'success');
    } else {
      showTempMessage(`该类名已被屏蔽`, 'warning');
    }
  } catch {
    showTempMessage('添加失败', 'error');
  }
}

// =========================================
// UI 辅助函数
// =========================================

/**
 * 显示检查模式提示消息
 */
function showInspectMessage() {
  const message = document.createElement('div');
  message.id = 'element-blocker-inspect-message';
  message.textContent = '悬停元素查看高亮，点击选择要屏蔽的类名。按 Esc 退出。';
  document.body.appendChild(message);
}

/**
 * 移除检查模式提示消息
 */
function removeInspectMessage() {
  const message = document.getElementById('element-blocker-inspect-message');
  if (message?.parentNode) {
    message.parentNode.removeChild(message);
  }
}

/**
 * 显示临时消息
 */
function showTempMessage(text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const toast = document.createElement('div');
  toast.className = `element-blocker-toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 2000);
}

/**
 * 通知 background 更新图标
 */
function notifyBackgroundUpdateIcon() {
  try {
    chrome.runtime.sendMessage({ action: 'updateIcon' });
  } catch {
    // 静默处理
  }
}

// =========================================
// 域名屏蔽切换
// =========================================

/**
 * 切换当前域名下所有屏蔽项的状态
 */
async function toggleDomainBlocking(domain: string) {
  if (domain !== currentDomain) return;

  try {
    const data = await chrome.storage.local.get(['blockedClasses']);
    let classes: BlockedClass[] = (data.blockedClasses as BlockedClass[]) || [];

    const domainClasses = classes.filter((item) => item.domain === currentDomain || item.domain === null);

    if (domainClasses.length === 0) {
      showTempMessage(`${getDomainDisplayName(currentDomain)} 下没有可切换的屏蔽项`, 'info');
      return;
    }

    // 如果有启用的就全部禁用，否则全部启用
    const enabledCount = domainClasses.filter((item) => item.enabled).length;
    const newState = enabledCount === 0;

    classes.forEach((item) => {
      if (item.domain === currentDomain || item.domain === null) {
        item.enabled = newState;
      }
    });

    await chrome.storage.local.set({ blockedClasses: classes });
    saveToLocalStorage(classes);
    notifyBackgroundUpdateIcon();

    const statusText = newState ? '已启用' : '已禁用';
    showTempMessage(`${getDomainDisplayName(currentDomain)} 下的所有屏蔽项${statusText}`, newState ? 'success' : 'info');
  } catch {
    showTempMessage('切换失败', 'error');
  }
}

// =========================================
// 消息监听
// =========================================

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    switch (message.action) {
      case 'updateBlocking':
        blockedClasses = message.blockedClasses || [];
        isEnabled = message.isEnabled ?? true;
        updateBlockingStyles();
        sendResponse({ success: true });
        break;

      case 'startInspecting':
        startInspectingMode();
        sendResponse({ success: true });
        break;

      case 'toggleDomainBlocking':
        if (message.domain) {
          toggleDomainBlocking(message.domain);
        }
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  });
}

/**
 * 监听 storage 变化
 */
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.blockedClasses) {
        blockedClasses = (changes.blockedClasses.newValue as BlockedClass[]) || [];
        updateBlockingStyles();
        notifyBackgroundUpdateIcon();
      }
      if (changes.isEnabled) {
        isEnabled = changes.isEnabled.newValue as boolean;
        updateBlockingStyles();
        notifyBackgroundUpdateIcon();
      }
    }
  });
}

// =========================================
// 初始化
// =========================================

async function initialize() {
  // 从 localStorage 恢复
  await restoreFromLocalStorage();

  // 加载设置
  try {
    const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);
    blockedClasses = normalizeBlockedClasses((data.blockedClasses as BlockedClass[]) || []);
    isEnabled = data.isEnabled !== false;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  // 创建样式元素
  createStyleElement();

  // 应用屏蔽样式
  updateBlockingStyles();

  // 设置监听器
  setupMessageListener();
  setupStorageListener();

  // 通知 background 更新图标
  notifyBackgroundUpdateIcon();
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
