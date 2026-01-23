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
 * 解析规则字符串
 * 将存储的字符串（如 "class1 class2 #id"）解析为 ID 和类名数组
 */
export function parseSelectorString(input: string): { id: string | null; classes: string[] } {
  const parts = input.trim().split(/\s+/);
  let id: string | null = null;
  const classes: string[] = [];

  parts.forEach((part) => {
    if (part.startsWith('#')) {
      // 提取 ID (去掉 #)
      id = part.substring(1);
    } else if (part) {
      classes.push(part);
    }
  });

  return { id, classes };
}

/**
 * 格式化展示选择器
 * 将规则格式化为用户友好的展示形式：#id.class1.class2
 */
export function formatDisplaySelector(input: string): string {
  const { id, classes } = parseSelectorString(input);
  
  let result = '';
  
  // ID 放在最前面
  if (id) {
    result += `#${id}`;
  }
  
  // 类名紧接其后，用 . 连接
  if (classes.length > 0) {
    result += '.' + classes.join('.');
  }
  
  return result;
}

/**
 * 生成 CSS 选择器
 * @param selectorString - 规则字符串（可能包含类名和 #id，空格分隔）
 * @returns CSS 选择器
 */
export function generateSelector(selectorString: string): string {
  const { id, classes } = parseSelectorString(selectorString);
  let selector = '';

  // 添加 ID 选择器
  if (id) {
    // 简单的 ID 选择器，如果有特殊字符可能需要转义，这里暂定 ID 是合法的
    // CSS 中 ID 选择器优先级高
    selector += `#${CSS.escape(id)}`;
  }

  // 添加类名选择器
  if (classes.length > 0) {
    // 使用属性选择器 [class~="name"] 进行精确单词匹配，避免部分匹配问题
    // 多个类名是 AND 关系，直接拼接
    const classSelectors = classes.map((cls) => `[class~="${cls}"]`).join('');
    selector += classSelectors;
  }

  // 如果没有 ID 也没有多个类名（即只有一个类名的情况且没有ID），保持原有行为使用 class*
  // 但为了统一逻辑，建议即使是单个类名也用 class~ 或者保持原样。
  // 原有逻辑：单个类名用 [class*=]，多个用 [class~=]
  // 新逻辑：只要有 ID，就用上述组合。
  // 如果没有 ID，且只有一个类名，为了兼容旧行为（可能有人依赖部分匹配），可以保持 class*=
  
  if (!id && classes.length === 1 && !selectorString.includes(' ')) {
     return `[class*="${classes[0]}"]`;
  }

  return selector;
}
