import { useCallback } from 'react';
import type { Message } from '@/lib/types';

/**
 * Chrome 消息发送结果
 */
interface SendMessageResult {
  success: boolean;
  response?: any;
  error?: string;
}

/**
 * Chrome 消息通信 Hook
 *
 * 封装 Chrome 扩展的消息发送逻辑，简化与 content script 的通信
 *
 * @example
 * ```tsx
 * const { sendToActiveTab, sendToTab } = useChromeMessage();
 *
 * // 发送消息到当前激活的标签页
 * const handleUpdate = async () => {
 *   const result = await sendToActiveTab({
 *     action: 'updateBlocking',
 *     blockedClasses: classes,
 *     isEnabled: true
 *   });
 *
 *   if (result.success) {
 *     console.log('消息发送成功');
 *   }
 * };
 *
 * // 发送消息到指定标签页
 * const handleStartInspecting = async () => {
 *   await sendToTab(123, { action: 'startInspecting' });
 * };
 * ```
 */
export function useChromeMessage() {
  /**
   * 发送消息到指定标签页
   *
   * @param tabId - 标签页 ID
   * @param message - 要发送的消息对象
   * @returns 发送结果
   */
  const sendToTab = useCallback(async (tabId: number, message: Message): Promise<SendMessageResult> => {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return {
        success: true,
        response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '消息发送失败',
      };
    }
  }, []);

  /**
   * 发送消息到当前激活的标签页
   *
   * @param message - 要发送的消息对象
   * @param options - 配置选项
   * @returns 发送结果
   */
  const sendToActiveTab = useCallback(
    async (
      message: Message,
      options: {
        /** 是否静默处理错误，默认 true */
        silent?: boolean;
      } = {},
    ): Promise<SendMessageResult> => {
      const { silent = true } = options;

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id) {
          return {
            success: false,
            error: '未找到当前标签页',
          };
        }

        return await sendToTab(tab.id, message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '消息发送失败';

        if (!silent) {
          console.error('发送消息失败:', errorMessage);
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [sendToTab],
  );

  /**
   * 获取当前激活的标签页信息
   *
   * @returns 标签页对象，如果没有则返回 null
   */
  const getActiveTab = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab || null;
    } catch (error) {
      console.error('获取标签页失败:', error);
      return null;
    }
  }, []);

  return {
    sendToTab,
    sendToActiveTab,
    getActiveTab,
  };
}
