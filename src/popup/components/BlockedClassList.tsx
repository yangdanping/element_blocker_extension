import { useState } from 'react';
import { X, Globe, Monitor, Pencil } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker.store';
import {
  Button,
  Badge,
  Switch,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';
import type { GroupedClasses, BlockedClass } from '@/lib/types';
import type { MessageType } from '@/hooks';

interface BlockedClassListProps {
  groupedClasses: GroupedClasses;
  currentDomain: string | null;
  onMessage: (text: string, type?: MessageType) => void;
}

/**
 * 屏蔽类名列表组件
 * 按域名分组显示所有屏蔽项
 */
export function BlockedClassList({ groupedClasses, currentDomain, onMessage }: BlockedClassListProps) {
  const removeClass = useBlockerStore((state) => state.removeClass);
  const toggleClass = useBlockerStore((state) => state.toggleClass);
  const updateClass = useBlockerStore((state) => state.updateClass);
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);

  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BlockedClass | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editClassName, setEditClassName] = useState('');

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<BlockedClass | null>(null);

  // 如果没有任何屏蔽项
  if (blockedClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Monitor className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">暂无屏蔽的类名</p>
        <p className="text-xs mt-1">点击输入框添加，或使用选择器</p>
      </div>
    );
  }

  /**
   * 打开删除确认对话框
   */
  const handleRemove = (item: BlockedClass) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  /**
   * 确认删除
   */
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    removeClass(deletingItem.className, deletingItem.domain);
    setDeleteDialogOpen(false);
    setDeletingItem(null);
    onMessage('已删除', 'success');
  };

  /**
   * 处理切换启用状态
   */
  const handleToggle = (item: BlockedClass) => {
    toggleClass(item.className, item.domain);
    onMessage(item.enabled ? '已禁用' : '已启用', 'success');
  };

  /**
   * 打开编辑对话框
   */
  const handleOpenEdit = (item: BlockedClass, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditLabel(item.label || '');
    setEditClassName(item.className);
    setEditDialogOpen(true);
  };

  /**
   * 保存编辑
   */
  const handleSaveEdit = () => {
    if (!editingItem) return;

    const cleanClassName = editClassName.trim().replace(/^\.+/g, '').replace(/\s+/g, ' ').trim();

    if (!cleanClassName) {
      onMessage('类名不能为空', 'error');
      return;
    }

    // 检查新类名是否与其他项重复（排除当前编辑项）
    const isDuplicate = blockedClasses.some(
      (existing) =>
        existing.className === cleanClassName &&
        existing.domain === editingItem.domain &&
        !(existing.className === editingItem.className && existing.domain === editingItem.domain),
    );

    if (isDuplicate) {
      onMessage('该类名已存在', 'error');
      return;
    }

    updateClass(editingItem.className, editingItem.domain, cleanClassName, editLabel);
    setEditDialogOpen(false);
    setEditingItem(null);
    onMessage('已保存', 'success');
  };

  /**
   * 渲染单个域名分组
   */
  const renderDomainGroup = (domain: string, items: BlockedClass[], isActive: boolean) => {
    const displayName = domain === 'global' ? '全局规则' : domain;
    const isGlobal = domain === 'global';

    return (
      <Card key={domain} className={`mb-3 ${isActive ? '' : 'opacity-60'}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {isGlobal ? <Globe className="h-3.5 w-3.5 text-muted-foreground" /> : <Monitor className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="font-mono text-xs">{displayName}</span>
            </CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
              {items.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={`${item.className}-${item.domain}`}
                className={`flex flex-col p-2 rounded-md border ${item.enabled ? 'bg-background border-border' : 'bg-muted/50 border-muted'}`}
              >
                {/* 标签行（作为 header） */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${item.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label || '未命名'}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={(e) => handleOpenEdit(item, e)} title="编辑">
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>

                {/* 类名和控制行 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch checked={item.enabled} onCheckedChange={() => handleToggle(item)} className="scale-75" />
                    <span className={`font-mono text-xs truncate ${item.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`} title={`.${item.className}`}>
                      .{item.className}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {item.className.includes(' ') && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 whitespace-nowrap">
                        组合
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(item)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // 按优先级排序显示：当前域名 > 全局 > 其他域名
  const sortedDomains = Object.keys(groupedClasses).sort((a, b) => {
    if (a === currentDomain) return -1;
    if (b === currentDomain) return 1;
    if (a === 'global') return -1;
    if (b === 'global') return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      <div>
        {sortedDomains.map((domain) => {
          const isActive = domain === currentDomain || domain === 'global';
          return renderDomainGroup(domain, groupedClasses[domain], isActive);
        })}
      </div>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[350px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑屏蔽规则</DialogTitle>
            <DialogDescription>修改标签名称或类名</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签</label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="如：评论区、广告横幅" onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">类名</label>
              <Input
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                placeholder="如：ad-banner"
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[350px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除这个屏蔽规则吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          {deletingItem && (
            <div className="py-4">
              <div className="p-3 rounded-md bg-muted">
                <div className="text-sm font-medium mb-1">{deletingItem.label || '未命名'}</div>
                <div className="font-mono text-xs text-muted-foreground">.{deletingItem.className}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
