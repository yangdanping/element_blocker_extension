/**
 * =========================================
 * Element Blocker - Zustand Store
 * =========================================
 *
 * Zustand 是一个轻量级的状态管理库，相比 Redux 有以下优势：
 * 1. 更简洁的 API，无需 action types、reducers 等样板代码
 * 2. 内置支持 TypeScript，类型推导更好
 * 3. 支持中间件（如 persist、devtools）
 * 4. 可以在 React 组件外部访问和修改状态
 *
 * 核心概念：
 * - create(): 创建 store，返回一个 hook
 * - set(): 更新状态，支持部分更新
 * - get(): 获取当前状态
 * - subscribe(): 订阅状态变化
 */

import { create } from 'zustand';
import type { BlockedClass, Theme } from '@/lib/types';
import type { BlockerState } from './blocker.type';
import Utils from '@/utils';

// =========================================
// 创建 Zustand Store
// =========================================

/**
 * useBlockerStore - 主 Store
 *
 * 使用方式（在 React 组件中）：
 *
 * ```tsx
 * // 方式1：获取整个 state（会在任何状态变化时重新渲染）
 * const { blockedClasses, addClass } = useBlockerStore();
 *
 * // 方式2：使用选择器（推荐，只在选中的状态变化时重新渲染）
 * const blockedClasses = useBlockerStore((state) => state.blockedClasses);
 * const addClass = useBlockerStore((state) => state.addClass);
 *
 * // 方式3：在组件外部访问（如 background.js）
 * useBlockerStore.getState().addClass('ad', 'example.com');
 * ```
 */
export const useBlockerStore = create<BlockerState>((set, get) => ({
  // ---- 初始状态 ----
  blockedClasses: [],
  isEnabled: true,
  currentDomain: null,
  theme: 'system',

  // ---- Actions ----

  setBlockedClasses: (classes) => {
    // set() 会自动合并状态，只需要传入要更新的部分
    set({ blockedClasses: classes });
  },

  addClass: (className, domain, label) => {
    const { blockedClasses } = get();

    // 检查重复
    if (Utils.isDuplicateClass(blockedClasses, className, domain)) {
      return;
    }

    // 使用函数式更新，确保基于最新状态
    // 只有当 label 有实际值时才添加到对象中
    const newItem: { className: string; enabled: boolean; domain: string | null; label?: string } = {
      className,
      enabled: true,
      domain,
    };
    if (label && label.trim()) {
      newItem.label = label.trim();
    }

    set((state) => ({
      blockedClasses: [...state.blockedClasses, newItem],
    }));
  },

  updateClass: (oldClassName, oldDomain, newClassName, newLabel) => {
    set((state) => ({
      blockedClasses: state.blockedClasses.map((item) => {
        if (item.className === oldClassName && item.domain === oldDomain) {
          const updated = { ...item, className: newClassName };
          // 处理 label：空字符串表示清除，undefined 表示不修改
          if (newLabel === '') {
            delete updated.label;
          } else if (newLabel !== undefined) {
            updated.label = newLabel.trim();
          }
          return updated;
        }
        return item;
      }),
    }));
  },

  removeClass: (className, domain) => {
    set((state) => ({
      blockedClasses: state.blockedClasses.filter((item) => !(item.className === className && item.domain === domain)),
    }));
  },

  toggleClass: (className, domain) => {
    set((state) => ({
      blockedClasses: state.blockedClasses.map((item) => (item.className === className && item.domain === domain ? { ...item, enabled: !item.enabled } : item)),
    }));
  },

  toggleCurrentDomainEnabled: () => {
    const { currentDomain, blockedClasses } = get();
    if (!currentDomain) return;

    // 获取当前域名下的屏蔽项
    const currentDomainItems = blockedClasses.filter((item) => item.domain === currentDomain);
    if (currentDomainItems.length === 0) return;

    // 检查当前域名下的屏蔽项是否全部启用
    const allEnabled = currentDomainItems.every((item) => item.enabled);

    // 切换状态：如果全部启用则全部禁用，否则全部启用
    set((state) => ({
      blockedClasses: state.blockedClasses.map((item) => (item.domain === currentDomain ? { ...item, enabled: !allEnabled } : item)),
    }));
  },

  setEnabled: (enabled) => {
    set({ isEnabled: enabled });
  },

  toggleEnabled: () => {
    set((state) => ({ isEnabled: !state.isEnabled }));
  },

  setCurrentDomain: (domain) => {
    set({ currentDomain: domain });
  },

  setTheme: (theme) => {
    set({ theme });
    // 同步更新 DOM 的 class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // system: 根据系统偏好
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    }
  },

  clearAll: () => {
    set({ blockedClasses: [] });
  },

  /**
   * 从 Chrome Storage 加载数据
   * 这是异步操作，Zustand 原生支持在 action 中使用 async/await
   */
  loadFromStorage: async () => {
    try {
      const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled', 'theme']);

      // 向后兼容处理
      const blockedClasses = Utils.normalizeBlockedClasses((data.blockedClasses as BlockedClass[]) || []);
      const isEnabled = data.isEnabled !== false;
      const theme = (data.theme as Theme) || 'system';

      // 批量更新状态
      set({ blockedClasses, isEnabled, theme });

      // 应用主题
      get().setTheme(theme);
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  },

  /**
   * 保存到 Chrome Storage
   */
  saveToStorage: async () => {
    try {
      const { blockedClasses, isEnabled, theme } = get();
      await chrome.storage.local.set({ blockedClasses, isEnabled, theme });
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  },
}));

// =========================================
// 便捷 Hooks（可选，进一步简化使用）
// =========================================

/**
 * 获取当前域名下的屏蔽项
 * 这是一个派生状态的例子，类似 Redux 的 selector
 */
export function useCurrentDomainClasses() {
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  const currentDomain = useBlockerStore((state) => state.currentDomain);

  return blockedClasses.filter((item) => item.domain === currentDomain || item.domain === null);
}

/**
 * 获取分组后的屏蔽项
 */
export function useGroupedClasses() {
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  return Utils.groupByDomain(blockedClasses);
}
