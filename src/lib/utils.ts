import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind CSS 类名的工具函数
 * 结合 clsx 和 tailwind-merge 的功能
 * - clsx: 处理条件类名
 * - tailwind-merge: 智能合并冲突的 Tailwind 类名
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-4 覆盖 px-2)
 * cn('text-red-500', condition && 'text-blue-500')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 从 URL 获取域名
 */
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * 生成 CSS 选择器
 * @param className - 类名（可能包含空格分隔的多个类名）
 * @returns CSS 选择器
 */
export function generateSelector(className: string): string {
  if (className.includes(' ')) {
    // 多个类名：需要同时包含所有指定的类（AND 逻辑）
    const classes = className.trim().split(/\s+/);
    return classes.map((cls) => `[class~="${cls}"]`).join('');
  } else {
    // 单个类名：使用包含匹配
    return `[class*="${className}"]`;
  }
}
