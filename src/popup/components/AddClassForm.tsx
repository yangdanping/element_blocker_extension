import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useBlockerStore } from '@/stores/blocker-store';
import { Button, Input } from '@/components/ui';

interface AddClassFormProps {
  onMessage: (text: string, type: string) => void;
}

/**
 * 添加屏蔽类名的表单组件
 */
export function AddClassForm({ onMessage }: AddClassFormProps) {
  const [inputValue, setInputValue] = useState('');

  // 从 store 获取需要的状态和方法
  const currentDomain = useBlockerStore((state) => state.currentDomain);
  const blockedClasses = useBlockerStore((state) => state.blockedClasses);
  const addClass = useBlockerStore((state) => state.addClass);

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const cleanInput = inputValue
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

    // 添加到 store
    addClass(cleanInput, currentDomain);
    setInputValue('');

    const matchType = cleanInput.includes(' ') ? '组合匹配' : '包含匹配';
    onMessage(`添加成功（${matchType}）`, 'success');
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
      <Input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="输入类名，如 ad-banner" className="flex-1 h-9 text-sm" />
      <Button type="submit" size="sm" className="h-9">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
