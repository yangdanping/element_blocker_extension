import { useState, useCallback } from 'react';

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
interface UseMessageOptions {
  /** 消息显示时长（毫秒），默认 2000 */
  duration?: number;
}

/**
 * 消息提示 Hook
 *
 * 用于在 popup 和 options 页面显示临时消息提示
 *
 * @example
 * ```tsx
 * const { message, showMessage } = useMessage({ duration: 3000 });
 *
 * const handleSave = () => {
 *   // 保存成功
 *   showMessage('保存成功', 'success');
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleSave}>保存</button>
 *     {message && (
 *       <div className={`message ${message.type}`}>
 *         {message.text}
 *       </div>
 *     )}
 *   </>
 * );
 * ```
 */
export function useMessage(options: UseMessageOptions = {}) {
  const { duration = 2000 } = options;
  const [message, setMessage] = useState<Message | null>(null);

  /**
   * 显示消息
   * 会在指定时长后自动清除
   */
  const showMessage = useCallback(
    (text: string, type: MessageType = 'info') => {
      setMessage({ text, type });
      setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  /**
   * 手动清除消息
   */
  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  return {
    message,
    showMessage,
    clearMessage,
  };
}
