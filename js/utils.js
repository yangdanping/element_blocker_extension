/**
 * Element Blocker 共享工具函数
 * 用于减少代码重复，统一数据处理逻辑
 */

/**
 * 转换屏蔽类名数据为标准格式（向后兼容）
 * @param {Array} blockedClasses - 原始数据
 * @returns {Array} 标准化后的数据
 */
export function normalizeBlockedClasses(blockedClasses) {
  if (!Array.isArray(blockedClasses)) return [];

  return blockedClasses.map((item) => {
    if (typeof item === 'string') {
      // 旧格式：字符串 -> 新格式：对象（全局生效）
      return { className: item, enabled: true, domain: null };
    } else if (item && typeof item.domain === 'undefined') {
      // 中间格式：对象但没有域名 -> 添加域名字段
      return { ...item, domain: null };
    }
    return item;
  });
}

/**
 * 从 URL 获取域名
 * @param {string} url - 完整 URL
 * @returns {string} 域名
 */
export function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * 生成 CSS 选择器
 * @param {string} className - 类名（可能包含空格分隔的多个类名）
 * @returns {string} CSS 选择器
 */
export function generateSelector(className) {
  if (className.includes(' ')) {
    // 多个类名：需要同时包含所有指定的类（AND 逻辑）
    const classes = className.trim().split(/\s+/);
    return classes.map((cls) => `[class~="${cls}"]`).join('');
  } else {
    // 单个类名：使用包含匹配
    return `[class*="${className}"]`;
  }
}

/**
 * 过滤出当前域名下激活的屏蔽项
 * @param {Array} blockedClasses - 所有屏蔽项
 * @param {string} currentDomain - 当前域名
 * @returns {Array} 激活的屏蔽项
 */
export function getActiveBlockedClasses(blockedClasses, currentDomain) {
  return blockedClasses.filter((item) => {
    return item.enabled && (item.domain === null || item.domain === currentDomain);
  });
}

/**
 * 按域名分组屏蔽项
 * @param {Array} blockedClasses - 所有屏蔽项
 * @returns {Object} 按域名分组的对象
 */
export function groupByDomain(blockedClasses) {
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

/**
 * 检查类名是否重复
 * @param {Array} blockedClasses - 现有屏蔽项
 * @param {string} className - 新类名
 * @param {string} domain - 域名
 * @returns {boolean} 是否重复
 */
export function isDuplicateClass(blockedClasses, className, domain) {
  return blockedClasses.some((existing) => {
    if (existing.domain !== domain) return false;
    if (existing.className === className) return true;

    // 单个类名时检查包含关系
    if (!className.includes(' ') && !existing.className.includes(' ')) {
      return existing.className.includes(className) || className.includes(existing.className);
    }

    return false;
  });
}

/**
 * 显示临时消息（通用版本，供 popup 和 content 使用）
 * @param {string} text - 消息文本
 * @param {string} type - 消息类型
 * @param {Object} options - 配置选项
 */
export function showTempMessage(text, type = 'info', options = {}) {
  const { duration = 2000, position = 'top' } = options;

  const colors = {
    success: '#66b279',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    disabled: '#6b6b6b'
  };

  const message = document.createElement('div');
  message.textContent = text;
  message.style.cssText = `
    position: fixed;
    ${position === 'top' ? 'top: 10px' : 'bottom: 10px'};
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 4px;
    color: ${type === 'warning' ? '#212529' : 'white'};
    background-color: ${colors[type] || colors.info};
    font-size: 13px;
    z-index: 1000001;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: opacity 0.3s ease;
  `;

  document.body.appendChild(message);

  setTimeout(() => {
    message.style.opacity = '0';
    setTimeout(() => message.remove(), 300);
  }, duration);
}

/**
 * 存储相关的常量
 */
export const STORAGE_KEYS = {
  BLOCKED_CLASSES: 'blockedClasses',
  IS_ENABLED: 'isEnabled'
};
