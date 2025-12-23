import type { BlockedClass, Theme } from '@/lib/types';

// =========================================
// Store 状态类型定义
// =========================================

export interface BlockerState {
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
