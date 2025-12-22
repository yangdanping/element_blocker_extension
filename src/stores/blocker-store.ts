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
import type { BlockedClass, GroupedClasses, Theme } from '@/lib/types';

// =========================================
// Store 状态类型定义
// =========================================

interface BlockerState {
  // ---- 核心数据 ----
  /** 所有屏蔽项列表 */
  blockedClasses: BlockedClass[];
  /** 全局开关状态 */
  isEnabled: boolean;
  /** 当前域名 */
  currentDomain: string | null;
  /** 主题设置 */
  theme: Theme;

  // ---- Actions（修改状态的方法）----
  /**
   * 设置屏蔽项列表
   * 类似 Redux 中的 dispatch(setBlockedClasses(data))
   */
  setBlockedClasses: (classes: BlockedClass[]) => void;

  /**
   * 添加新的屏蔽项
   * @param className - 类名
   * @param domain - 域名，null 表示全局
   */
  addClass: (className: string, domain: string | null) => void;

  /**
   * 删除屏蔽项
   */
  removeClass: (className: string, domain: string | null) => void;

  /**
   * 切换单个屏蔽项的启用状态
   */
  toggleClass: (className: string, domain: string | null) => void;

  /**
   * 设置全局开关
   */
  setEnabled: (enabled: boolean) => void;

  /**
   * 切换全局开关
   */
  toggleEnabled: () => void;

  /**
   * 设置当前域名
   */
  setCurrentDomain: (domain: string | null) => void;

  /**
   * 设置主题
   */
  setTheme: (theme: Theme) => void;

  /**
   * 清空所有屏蔽项
   */
  clearAll: () => void;

  /**
   * 从 Chrome Storage 加载数据
   */
  loadFromStorage: () => Promise<void>;

  /**
   * 保存到 Chrome Storage
   */
  saveToStorage: () => Promise<void>;
}

// =========================================
// 辅助函数
// =========================================

/**
 * 向后兼容：转换旧格式数据为新格式
 * 旧格式：字符串数组 ['ad', 'banner']
 * 新格式：对象数组 [{className: 'ad', enabled: true, domain: null}]
 */
function normalizeBlockedClasses(data: unknown[]): BlockedClass[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    // 字符串格式 -> 对象格式
    if (typeof item === 'string') {
      return { className: item, enabled: true, domain: null };
    }
    // 缺少 domain 字段的旧对象
    if (item && typeof item === 'object' && !('domain' in item)) {
      return { ...(item as BlockedClass), domain: null };
    }
    return item as BlockedClass;
  });
}

/**
 * 按域名分组屏蔽项
 */
export function groupByDomain(blockedClasses: BlockedClass[]): GroupedClasses {
  const groups: GroupedClasses = {};
  blockedClasses.forEach((item) => {
    const domain = item.domain || 'global';
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(item);
  });
  return groups;
}

/**
 * 获取当前域名下激活的屏蔽项
 */
export function getActiveBlockedClasses(blockedClasses: BlockedClass[], currentDomain: string | null): BlockedClass[] {
  return blockedClasses.filter((item) => {
    return item.enabled && (item.domain === null || item.domain === currentDomain);
  });
}

/**
 * 检查类名是否重复
 */
function isDuplicateClass(blockedClasses: BlockedClass[], className: string, domain: string | null): boolean {
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

  addClass: (className, domain) => {
    const { blockedClasses } = get();

    // 检查重复
    if (isDuplicateClass(blockedClasses, className, domain)) {
      return;
    }

    // 使用函数式更新，确保基于最新状态
    set((state) => ({
      blockedClasses: [...state.blockedClasses, { className, enabled: true, domain }],
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
      const blockedClasses = normalizeBlockedClasses((data.blockedClasses as BlockedClass[]) || []);
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
  return groupByDomain(blockedClasses);
}
