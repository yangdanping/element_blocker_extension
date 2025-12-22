import { useEffect, useState } from 'react';
import { Settings, Crosshair, Moon, Sun, Power } from 'lucide-react';
import { useBlockerStore, useGroupedClasses } from '@/stores/blocker-store';
import { getDomainFromUrl } from '@/lib/utils';
import { Button, Switch, Badge, Card, CardHeader, CardTitle } from '@/components/ui';
import { BlockedClassList } from './components/BlockedClassList';
import { AddClassForm } from './components/AddClassForm';

/**)
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
  const toggleEnabled = useBlockerStore((state) => state.toggleEnabled);
  const setTheme = useBlockerStore((state) => state.setTheme);
  const loadFromStorage = useBlockerStore((state) => state.loadFromStorage);
  const saveToStorage = useBlockerStore((state) => state.saveToStorage);

  // 使用自定义 hook 获取分组数据
  const groupedClasses = useGroupedClasses();

  // 本地状态：消息提示
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);

  // =========================================
  // 初始化
  // =========================================
  useEffect(() => {
    // 加载存储的数据
    loadFromStorage();
    // 获取当前域名
    // chrome.tabs.query: 查询浏览器标签页
    // { active: true, currentWindow: true } 表示获取当前窗口中正在激活（用户看着）的那个标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setCurrentDomain(getDomainFromUrl(tabs[0].url));
      }
    });
  }, [loadFromStorage, setCurrentDomain]);

  // 监听状态变化，自动保存
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  useEffect(() => {
    // 跳过初始加载
    if (blockedClasses.length > 0 || !isEnabled) {
      saveToStorage();
      // 通知 content script 更新
      // chrome.tabs.sendMessage: 消息通信机制
      // Popup 和页面脚本(Content Script)是隔离的，这里发送消息告诉页面脚本：“配置变了，请实时更新屏蔽效果”
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              action: 'updateBlocking',
              blockedClasses,
              isEnabled,
            })
            .catch(() => {
              // 静默处理错误
            });
        }
      });
    }
  }, [blockedClasses, isEnabled, saveToStorage]);

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
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'startInspecting' });
        window.close();
      }
    } catch {
      showMessage('无法启动元素选择器', 'error');
    }
  };

  /** 打开设置页 */
  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  /** 显示临时消息 */
  const showMessage = (text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2000);
  };

  // =========================================
  // 渲染
  // =========================================
  return (
    <div className="popup-container bg-background text-foreground">
      {/* 头部 */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Power className="h-4 w-4" />
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

          {/* 当前域名 & 全局开关 */}
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-xs font-mono">
              {currentDomain || '未知域名'}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isEnabled ? '已启用' : '已禁用'}</span>
              <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 添加表单 & 选择按钮 */}
      <div className="p-4 border-b">
        <div className="flex gap-2">
          <AddClassForm onMessage={showMessage} />
          <Button variant="outline" size="icon" onClick={handleStartInspecting} title="选择页面元素">
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
