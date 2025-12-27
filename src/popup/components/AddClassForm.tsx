import { useState, type FormEvent } from 'react';
import { Plus, Tag } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker.store';
import { Button, Input } from '@/components/ui';
import type { MessageType } from '@/hooks';

interface AddClassFormProps {
  onMessage: (text: string, type?: MessageType) => void;
}

/**
 * 添加屏蔽类名的表单组件
 */
export function AddClassForm({ onMessage }: AddClassFormProps) {
  const [classNameValue, setClassNameValue] = useState('');
  const [labelValue, setLabelValue] = useState('');

  // 从 store 获取需要的状态和方法
  const currentDomain = useBlockerStore((state) => state.currentDomain);
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  const addClass = useBlockerStore((state) => state.addClass);

  // 是否显示标签输入框
  const showLabel = classNameValue.trim().length > 0;
  // 是否可以提交
  const canSubmit = classNameValue.trim().length > 0;

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const cleanInput = classNameValue
      .trim()
      .replace(/^\.+/g, '') // 移除开头的点
      .replace(/\s+/g, ' ') // 合并多余空格
      .trim();

    if (!cleanInput) {
      onMessage('请输入类名', 'error');
      return;
    }

    // 检查是否重复
    const isDuplicate = blockedClasses.some((existing) => {
      if (existing.domain !== currentDomain) return false;
      if (existing.className === cleanInput) return true;

      // 单个类名检查包含关系
      if (!cleanInput.includes(' ') && !existing.className.includes(' ')) {
        return existing.className.includes(cleanInput) || cleanInput.includes(existing.className);
      }
      return false;
    });

    if (isDuplicate) {
      onMessage(`该类名在 ${currentDomain} 下已存在`, 'warning');
      return;
    }

    // 添加到 store（传入标签，空字符串会被处理为不添加 label 属性）
    addClass(cleanInput, currentDomain, labelValue.trim() || undefined);
    setClassNameValue('');
    setLabelValue('');

    const matchType = cleanInput.includes(' ') ? '组合匹配' : '包含匹配';
    onMessage(`添加成功（${matchType}）`, 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-2">
      {/* 类名输入框 */}
      <Input type="text" value={classNameValue} onChange={(e) => setClassNameValue(e.target.value)} placeholder="输入类名，如 ad-banner" className="h-9 text-sm" />

      {/* 标签输入框（类名有内容时显示） */}
      {showLabel && (
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="text" value={labelValue} onChange={(e) => setLabelValue(e.target.value)} placeholder="标签（可选），如 评论区" className="h-9 text-sm pl-9" />
        </div>
      )}

      {/* 添加按钮始终显示，但未输入类名时禁用 */}
      <Button type="submit" size="sm" className="h-9 w-full" disabled={!canSubmit}>
        <Plus className="h-4 w-4 mr-1" />
        添加屏蔽规则
      </Button>
    </form>
  );
}
