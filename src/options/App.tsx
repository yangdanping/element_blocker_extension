import { useEffect, useState, useRef } from 'react';
import { Keyboard, Download, Upload, Moon, Sun, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker-store';
import type { BlockedClass, Theme } from '@/lib/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui';

/**
 * Options 设置页面
 */
export default function App() {
  // Zustand store
  const theme = useBlockerStore((state) => state.theme);
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  const isEnabled = useBlockerStore((state) => state.isEnabled);
  const setBlockedClasses = useBlockerStore((state) => state.setBlockedClasses);
  const setEnabled = useBlockerStore((state) => state.setEnabled);
  const setTheme = useBlockerStore((state) => state.setTheme);
  const loadFromStorage = useBlockerStore((state) => state.loadFromStorage);
  const saveToStorage = useBlockerStore((state) => state.saveToStorage);

  // 本地状态
  const [currentShortcut, setCurrentShortcut] = useState<string>('加载中...');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<{ blockedClasses: BlockedClass[]; isEnabled: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // =========================================
  // 初始化
  // =========================================
  useEffect(() => {
    loadFromStorage();
    loadCurrentShortcut();
  }, [loadFromStorage]);

  /** 加载当前快捷键 */
  const loadCurrentShortcut = async () => {
    try {
      const commands = await chrome.commands.getAll();
      const toggleCommand = commands.find((cmd) => cmd.name === 'toggle-domain-blocking');
      setCurrentShortcut(toggleCommand?.shortcut || '未设置');
    } catch {
      setCurrentShortcut('加载失败');
    }
  };

  // =========================================
  // 事件处理
  // =========================================

  /** 显示消息 */
  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  /** 打开快捷键设置 */
  const handleOpenShortcutSettings = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  /** 切换主题 */
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    saveToStorage();
  };

  /** 导出配置 */
  const handleExport = () => {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      config: {
        blockedClasses,
        isEnabled
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `element-blocker-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage('配置导出成功', 'success');
  };

  /** 选择导入文件 */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /** 处理文件选择 */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      if (!data.config?.blockedClasses) {
        throw new Error('无效的配置文件格式');
      }

      setImportData({
        blockedClasses: data.config.blockedClasses || [],
        isEnabled: data.config.isEnabled !== false
      });
      setImportDialogOpen(true);
    } catch (err) {
      showMessage('文件格式错误', 'error');
    }

    // 清空文件选择器
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /** 执行导入（覆盖） */
  const handleImportReplace = async () => {
    if (!importData) return;

    setBlockedClasses(importData.blockedClasses);
    setEnabled(importData.isEnabled);
    await saveToStorage();

    setImportDialogOpen(false);
    setImportData(null);
    showMessage(`已导入 ${importData.blockedClasses.length} 条规则`, 'success');
  };

  /** 执行导入（合并） */
  const handleImportMerge = async () => {
    if (!importData) return;

    // 合并去重
    const merged = [...blockedClasses];
    importData.blockedClasses.forEach((newItem) => {
      const exists = merged.some((existing) => existing.className === newItem.className && existing.domain === newItem.domain);
      if (!exists) {
        merged.push(newItem);
      }
    });

    setBlockedClasses(merged);
    await saveToStorage();

    setImportDialogOpen(false);
    setImportData(null);
    showMessage(`已合并，共 ${merged.length} 条规则`, 'success');
  };

  // =========================================
  // 渲染
  // =========================================
  return (
    <div className="options-container bg-background text-foreground min-h-screen">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Element Blocker 设置</h1>
          <p className="text-muted-foreground mt-1">管理扩展的快捷键、主题和配置</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">常规</TabsTrigger>
            <TabsTrigger value="shortcuts">快捷键</TabsTrigger>
            <TabsTrigger value="data">数据管理</TabsTrigger>
          </TabsList>

          {/* 常规设置 */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>主题设置</CardTitle>
                <CardDescription>选择你喜欢的界面主题</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => handleThemeChange('light')} className="flex-1">
                    <Sun className="h-4 w-4 mr-2" />
                    浅色
                  </Button>
                  <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => handleThemeChange('dark')} className="flex-1">
                    <Moon className="h-4 w-4 mr-2" />
                    深色
                  </Button>
                  <Button variant={theme === 'system' ? 'default' : 'outline'} onClick={() => handleThemeChange('system')} className="flex-1">
                    <Monitor className="h-4 w-4 mr-2" />
                    跟随系统
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 快捷键设置 */}
          <TabsContent value="shortcuts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  快捷键设置
                </CardTitle>
                <CardDescription>配置切换当前域名屏蔽状态的快捷键</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">切换域名屏蔽</p>
                    <p className="text-sm text-muted-foreground">快速切换当前域名下所有屏蔽项的状态</p>
                  </div>
                  <Badge variant="secondary" className="text-sm font-mono px-3 py-1">
                    {currentShortcut}
                  </Badge>
                </div>
                <Button onClick={handleOpenShortcutSettings} variant="outline" className="w-full">
                  <Keyboard className="h-4 w-4 mr-2" />
                  自定义快捷键
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 数据管理 */}
          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>配置管理</CardTitle>
                <CardDescription>导入或导出你的屏蔽规则配置，当前共 {blockedClasses.length} 条规则</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleExport} variant="outline" className="h-20 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    导出配置
                  </Button>
                  <Button onClick={handleImportClick} variant="outline" className="h-20 flex-col">
                    <Upload className="h-6 w-6 mb-2" />
                    导入配置
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 消息提示 */}
        {message && (
          <div
            className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              message.type === 'success'
                ? 'bg-success text-success-foreground'
                : message.type === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : null}
            {message.text}
          </div>
        )}

        {/* 导入确认对话框 */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导入配置</DialogTitle>
              <DialogDescription>检测到 {importData?.blockedClasses.length || 0} 条屏蔽规则，请选择导入方式</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">当前已有 {blockedClasses.length} 条规则</p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                取消
              </Button>
              <Button variant="secondary" onClick={handleImportMerge}>
                合并配置
              </Button>
              <Button variant="destructive" onClick={handleImportReplace}>
                覆盖配置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
