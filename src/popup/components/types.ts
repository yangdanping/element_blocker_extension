import type { MessageType } from '@/hooks';
import type { GroupedClasses } from '@/lib/types';

/**
 * AddClassForm 组件的 props 接口
 */
export interface AddClassFormProps {
  onMessage: (text: string, type?: MessageType) => void;
  onInspect?: () => void;
}

/**
 * BlockedClassList 组件的 props 接口
 */
export interface BlockedClassListProps {
  groupedClasses: GroupedClasses;
  currentDomain: string | null;
  onMessage: (text: string, type?: MessageType) => void;
}