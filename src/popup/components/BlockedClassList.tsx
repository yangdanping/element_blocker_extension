import { X, Globe, Monitor } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker.store';
import { Button, Badge, Switch, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
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
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);

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
   * 处理删除
   */
  const handleRemove = (item: BlockedClass) => {
    removeClass(item.className, item.domain);
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
                className={`flex items-center justify-between p-2 rounded-md border ${item.enabled ? 'bg-background border-border' : 'bg-muted/50 border-muted'}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Switch checked={item.enabled} onCheckedChange={() => handleToggle(item)} className="scale-75" />
                  <span className={`font-mono text-xs truncate ${item.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`} title={`.${item.className}`}>
                    .{item.className}
                  </span>
                  {item.className.includes(' ') && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      组合
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(item)}>
                  <X className="h-3 w-3" />
                </Button>
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
    <div>
      {sortedDomains.map((domain) => {
        const isActive = domain === currentDomain || domain === 'global';
        return renderDomainGroup(domain, groupedClasses[domain], isActive);
      })}
    </div>
  );
}
