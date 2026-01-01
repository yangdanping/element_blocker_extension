import { useState, useEffect } from 'react';
import { getDomainFromUrl } from '@/lib/utils';
import type { TabInfo } from './types';
/**
 * 当前标签页信息 Hook
 *
 * 自动获取当前激活标签页的信息，包括 URL 和域名
 *
 * @example
 * ```tsx
 * const { tabInfo, loading, error } = useCurrentTab();
 *
 * if (loading) return <div>加载中...</div>;
 * if (error) return <div>错误: {error}</div>;
 *
 * return (
 *   <div>
 *     <p>当前域名: {tabInfo.domain}</p>
 *     <p>页面标题: {tabInfo.title}</p>
 *   </div>
 * );
 * ```
 */
export function useCurrentTab() {
  const [tabInfo, setTabInfo] = useState<TabInfo>({
    domain: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTabInfo = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          setError('未找到当前标签页');
          setLoading(false);
          return;
        }

        setTabInfo({
          id: tab.id,
          url: tab.url,
          domain: tab.url ? getDomainFromUrl(tab.url) : null,
          title: tab.title,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取标签页信息失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTabInfo();

    // 监听标签页更新
    const handleTabUpdate = (tabId: number, changeInfo: any, tab: chrome.tabs.Tab) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
        if (activeTab?.id === tabId && changeInfo.url) {
          setTabInfo({
            id: tab.id,
            url: tab.url,
            domain: tab.url ? getDomainFromUrl(tab.url) : null,
            title: tab.title,
          });
        }
      });
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, []);

  return {
    tabInfo,
    loading,
    error,
  };
}
