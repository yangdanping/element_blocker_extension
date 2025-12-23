import type { BlockedClass, GroupedClasses } from '@/lib/types';

class Utils {
  /**
   * 向后兼容：转换旧格式数据为新格式
   * 旧格式：字符串数组 ['ad', 'banner']
   * 新格式：对象数组 [{className: 'ad', enabled: true, domain: null}]
   */
  static normalizeBlockedClasses(data: unknown[]): BlockedClass[] {
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      // 字符串格式 -> 对象格式
      if (typeof item === 'string') {
        return { className: item, enabled: true, domain: null };
      }
      // 缺少 domain 字段的旧对象
      if (item && typeof item === 'object' && !('domain' in item)) {
        return { ...(item as BlockedClass), domain: null };
      }
      return item as BlockedClass;
    });
  }

  /**
   * 按域名分组屏蔽项
   */
  static groupByDomain(blockedClasses: BlockedClass[]): GroupedClasses {
    const groups: GroupedClasses = {};
    blockedClasses.forEach((item) => {
      const domain = item.domain || 'global';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(item);
    });
    return groups;
  }

  /**
   * 获取当前域名下激活的屏蔽项
   */
  static getActiveBlockedClasses(blockedClasses: BlockedClass[], currentDomain: string | null): BlockedClass[] {
    return blockedClasses.filter((item) => {
      return item.enabled && (item.domain === null || item.domain === currentDomain);
    });
  }

  /**
   * 检查类名是否重复
   */
  static isDuplicateClass(blockedClasses: BlockedClass[], className: string, domain: string | null): boolean {
    return blockedClasses.some((existing) => {
      if (existing.domain !== domain) return false;
      if (existing.className === className) return true;

      // 单个类名时检查包含关系
      if (!className.includes(' ') && !existing.className.includes(' ')) {
        return existing.className.includes(className) || className.includes(existing.className);
      }

      return false;
    });
  }
}

export default Utils;
