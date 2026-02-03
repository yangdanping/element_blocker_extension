import { useEffect } from 'react';
import { Settings, Moon, Sun, Cuboid } from 'lucide-react';
import { useBlockerStore, useGroupedClasses } from '@/stores/blocker.store';
import { useMessage, useChromeMessage } from '@/hooks';
import { Button, Switch, Badge, Card, CardHeader, CardTitle } from '@/components/ui';
import { BlockedClassList } from './components/BlockedClassList';
import { AddClassForm } from './components/AddClassForm';

/**
 * Popup 主应用组件
 */
export default function App() {
  // =========================================
  // Zustand Store 使用示例
  // =========================================
  //
  // 使用选择器获取状态，只有选中的状态变化时才会重新渲染
  // 这比 const { isEnabled, theme } = useBlockerStore() 更高效
  //
  const isEnabled = useBlockerStore((state) => state.isEnabled);
  const theme = useBlockerStore((state) => state.theme);
  const currentDomain = useBlockerStore((state) => state.currentDomain);

  // 获取 actions（actions 是稳定的引用，不会导致重新渲染）
  const setCurrentDomain = useBlockerStore((state) => state.setCurrentDomain);
  // const toggleEnabled = useBlockerStore((state) => state.toggleEnabled);
  const toggleCurrentDomainEnabled = useBlockerStore((state) => state.toggleCurrentDomainEnabled);
  const setTheme = useBlockerStore((state) => state.setTheme);
  const loadFromStorage = useBlockerStore((state) => state.loadFromStorage);
  const saveToStorage = useBlockerStore((state) => state.saveToStorage);

  // 使用自定义 hook 获取分组数据
  const groupedClasses = useGroupedClasses();

  // 自定义 hooks
  const { message, showMessage } = useMessage();
  const { sendToActiveTab } = useChromeMessage();

  // =========================================
  // 初始化
  // =========================================
  useEffect(() => {
    // 加载存储的数据
    loadFromStorage();
  }, [loadFromStorage]);

  // 获取当前域名
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const url = new URL(tabs[0].url);
        setCurrentDomain(url.hostname);
      }
    });
  }, [setCurrentDomain]);

  // 监听 Chrome Storage 变化，实时同步状态（快捷键触发的变化）
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
      if (namespace === 'local' && (changes.blockedClasses || changes.isEnabled || changes.theme)) {
        // 重新加载存储数据，更新 store 中的状态
        loadFromStorage();
      }
    };

    // 添加监听器
    chrome.storage.onChanged.addListener(handleStorageChange);

    // 清理：移除监听器
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadFromStorage]);

  // 监听状态变化，自动保存
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  useEffect(() => {
    // 跳过初始加载
    if (blockedClasses.length > 0 || !isEnabled) {
      saveToStorage();
      // 通知 content script 更新
      //
      // Popup 和页面脚本(Content Script)是隔离的，这里发送消息告诉页面脚本："配置变了，请实时更新屏蔽效果"
      // 现在使用 useChromeMessage Hook 封装了这个逻辑，使代码更简洁且类型安全,里面的 chrome.tabs.sendMessage是一种消息通信机制
      sendToActiveTab({
        action: 'updateBlocking',
        blockedClasses,
        isEnabled,
      });
    }
  }, [blockedClasses, isEnabled, saveToStorage, sendToActiveTab]);

  // =========================================
  // 辅助函数
  // =========================================

  /** 获取当前域名下所有屏蔽项的启用状态 */
  const getCurrentDomainEnabled = () => {
    if (!currentDomain) return false;
    const currentDomainItems = blockedClasses.filter((item) => item.domain === currentDomain);
    if (currentDomainItems.length === 0) return false;
    return currentDomainItems.some((item) => item.enabled);
  };

  /** 获取当前域名的状态文本 */
  const getCurrentDomainStatus = () => {
    if (!currentDomain) return '无域名';
    const currentDomainItems = blockedClasses.filter((item) => item.domain === currentDomain);
    if (currentDomainItems.length === 0) return '无规则';
    const enabledCount = currentDomainItems.filter((item) => item.enabled).length;
    const totalCount = currentDomainItems.length;
    if (enabledCount === 0) return '已禁用';
    if (enabledCount === totalCount) return '已启用';
    return `${enabledCount}/${totalCount}`;
  };

  // =========================================
  // 事件处理
  // =========================================

  /** 切换主题 */
  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    saveToStorage();
  };

  /** 启动元素选择模式 */
  const handleStartInspecting = async () => {
    const result = await sendToActiveTab({ action: 'startInspecting' });
    if (result.success) {
      window.close();
    } else {
      showMessage('无法启动元素选择器', 'error');
    }
  };

  /** 打开设置页 */
  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  // =========================================
  // 渲染
  // =========================================
  return (
    <div className="popup-container bg-background text-foreground">
      {/* 头部 */}
      <Card className="rounded-none border-x-0 border-t-0 shrink-0">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 font-['MapleMono'] italic">
              <Cuboid className="h-5 w-5" />
              Element Blocker
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* 主题切换 */}
              <Button variant="ghost" size="icon" onClick={handleToggleTheme} title="切换主题">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {/* 设置按钮 */}
              <Button variant="ghost" size="icon" onClick={handleOpenSettings} title="设置">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 当前域名 & 当前域名开关 */}
          {currentDomain !== chrome.runtime.id && (
            <div className="flex items-center justify-between mt-2">
              <Badge variant="outline" className="text-xs font-mono" style={{ borderColor: '#81C995' }}>
                {currentDomain || '未知域名'}
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{getCurrentDomainStatus()}</span>
                <Switch checked={getCurrentDomainEnabled()} onCheckedChange={toggleCurrentDomainEnabled} />
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 添加表单 & 选择按钮 */}
      {currentDomain !== chrome.runtime.id && (
        <div className="p-4 border-b shrink-0">
          <AddClassForm onMessage={showMessage} onInspect={handleStartInspecting} />
        </div>
      )}

      {/* 屏蔽列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <BlockedClassList groupedClasses={groupedClasses} currentDomain={currentDomain} onMessage={showMessage} />
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-sm z-50 ${
            message.type === 'success'
              ? 'bg-success text-success-foreground'
              : message.type === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
