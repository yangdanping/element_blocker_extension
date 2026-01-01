/**
 * 标签页信息
 */
export interface TabInfo {
  /** 标签页 ID */
  id?: number;
  /** 完整 URL */
  url?: string;
  /** 提取的域名 */
  domain: string | null;
  /** 标签页标题 */
  title?: string;
}

/**
 * Chrome 消息发送结果
 */
export interface SendMessageResult {
  success: boolean;
  response?: any;
  error?: string;
}

/**
 * 消息类型
 */
export type MessageType = 'success' | 'error' | 'info' | 'warning';

/**
 * 消息对象
 */
export interface Message {
  text: string;
  type: MessageType;
}

/**
 * useMessage Hook 配置
 */
export interface UseMessageOptions {
  /** 消息显示时长（毫秒），默认 2000 */
  duration?: number;
}
