/**
 * =========================================
 * 屏蔽项类型定义
 * =========================================
 */

/**
 * 单个屏蔽项的数据结构
 */
export interface BlockedClass {
  /** 要屏蔽的类名（支持空格分隔的组合类名） */
  className: string;
  /** 是否启用该屏蔽项 */
  enabled: boolean;
  /** 所属域名，null 表示全局生效 */
  domain: string | null;
  /** 可选的标签名称，用于标识屏蔽项的用途 */
  label?: string;
}

/**
 * Chrome Storage 中存储的数据结构
 */
export interface StorageData {
  blockedClasses: BlockedClass[];
  isEnabled: boolean;
}

/**
 * 按域名分组后的数据结构
 */
export interface GroupedClasses {
  [domain: string]: BlockedClass[];
}

/**
 * 消息类型 - 用于 Chrome 扩展各部分之间的通信
 */
export type MessageAction = 'updateBlocking' | 'startInspecting' | 'toggleDomainBlocking' | 'updateIcon' | 'addClass';

export interface Message {
  action: MessageAction;
  blockedClasses?: BlockedClass[];
  isEnabled?: boolean;
  domain?: string;
  className?: string;
}

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark' | 'system';
