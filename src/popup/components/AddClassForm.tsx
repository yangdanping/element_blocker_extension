import { useState, type FormEvent } from 'react';
import { Plus, Tag, Hash, Crosshair } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker.store';
import { Button, Input } from '@/components/ui';
import type { AddClassFormProps } from './types';

/**
 * 添加屏蔽类名的表单组件
 */
export function AddClassForm({ onMessage, onInspect }: AddClassFormProps) {
  const [classNameValue, setClassNameValue] = useState('');
  const [idValue, setIdValue] = useState('');
  const [showIdInput, setShowIdInput] = useState(false);
  const [labelValue, setLabelValue] = useState('');

  // 从 store 获取需要的状态和方法
  const currentDomain = useBlockerStore((state) => state.currentDomain);
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  const addClass = useBlockerStore((state) => state.addClass);

  // 是否有内容输入
  const hasContent = classNameValue.trim().length > 0 || idValue.trim().length > 0;
  // 是否显示标签输入框 (只要有输入就显示)
  const showLabel = hasContent;
  // 是否可以提交
  const canSubmit = hasContent;

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const cleanClassName = classNameValue
      .trim()
      .replace(/^\.+/g, '') // 移除开头的点
      .replace(/\s+/g, ' ') // 合并多余空格
      .trim();

    const cleanId = idValue
      .trim()
      .replace(/^#+/g, '') // 移除开头的 #
      .trim();

    if (!cleanClassName && !cleanId) {
      onMessage('请输入类名或 ID', 'error');
      return;
    }

    // 构建规则字符串: "class1 class2 #id"
    let ruleString = cleanClassName;
    if (cleanId) {
      ruleString = ruleString ? `${ruleString} #${cleanId}` : `#${cleanId}`;
    }

    // 检查是否重复
    const isDuplicate = blockedClasses.some((existing) => {
      if (existing.domain !== currentDomain) return false;
      if (existing.className === ruleString) return true;

      // 仅当都是纯类名且不含 ID 时，才进行包含关系检查（保持向后兼容）
      // 如果包含 ID，则要求精确匹配
      const isSimpleClass = !ruleString.includes('#') && !ruleString.includes(' ');
      const isExistingSimple = !existing.className.includes('#') && !existing.className.includes(' ');

      if (isSimpleClass && isExistingSimple) {
        return existing.className.includes(ruleString) || ruleString.includes(existing.className);
      }
      return false;
    });

    if (isDuplicate) {
      onMessage(`该规则在 ${currentDomain} 下已存在`, 'warning');
      return;
    }

    // 添加到 store
    addClass(ruleString, currentDomain, labelValue.trim() || undefined);

    // 重置表单
    setClassNameValue('');
    setIdValue('');
    setLabelValue('');
    setShowIdInput(false);

    const matchType = ruleString.includes('#') ? 'ID匹配' : ruleString.includes(' ') ? '组合匹配' : '包含匹配';
    onMessage(`添加成功（${matchType}）`, 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">
      {/* 类名输入框与 ID 切换按钮 */}
      <div className="flex gap-2">
        <Input type="text" value={classNameValue} onChange={(e) => setClassNameValue(e.target.value)} placeholder="输入类名，如 ad-banner" className="h-9 text-sm flex-1" />
        <Button
          type="button"
          variant={showIdInput ? 'secondary' : 'outline'}
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setShowIdInput(!showIdInput)}
          title="切换 ID 输入框"
        >
          <Hash className="h-4 w-4" />
        </Button>
        {onInspect && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onInspect}
            title="选择页面元素"
            className="h-9 w-9 shrink-0"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ID 输入框 (可选) */}
      {showIdInput && <Input type="text" value={idValue} onChange={(e) => setIdValue(e.target.value)} placeholder="输入 ID (不带 #)" className="h-9 text-sm font-mono" />}

      {/* 标签输入框（有内容时显示） */}
      {showLabel && (
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="text" value={labelValue} onChange={(e) => setLabelValue(e.target.value)} placeholder="标签（可选），如 评论区" className="h-9 text-sm pl-9" />
        </div>
      )}

      {/* 添加按钮 */}
      <Button type="submit" size="sm" className="h-9 w-full" disabled={!canSubmit}>
        <Plus className="h-4 w-4 mr-1" />
        添加屏蔽规则
      </Button>
    </form>
  );
}
