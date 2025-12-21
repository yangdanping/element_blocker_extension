# Element Blocker

一个基于 **Vite 7 + React 19 + Tailwind CSS v4** 的 Chrome 扩展，通过 CSS 类名智能屏蔽网页元素。

## 技术栈

| 类型     | 技术                      | 版本      |
| -------- | ------------------------- | --------- |
| 构建工具 | Vite + @crxjs/vite-plugin | 7.3 / 2.3 |
| 前端框架 | React                     | 19.2      |
| 样式     | Tailwind CSS              | 4.1       |
| 组件库   | shadcn/ui + Radix UI      | -         |
| 状态管理 | Zustand                   | 5.0       |
| 语言     | TypeScript                | 5.9       |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 生产构建
npm run build
```

构建后，在 Chrome 扩展管理页面 (`chrome://extensions/`) 加载 `dist` 目录即可。

---

## 项目结构导览

> 推荐按以下顺序阅读代码，由浅入深理解整个项目。

```
src/
├── lib/                    # 🟢 第1步：基础工具
│   ├── types.ts           # 类型定义（理解数据结构）
│   └── utils.ts           # 工具函数（cn, getDomainFromUrl, generateSelector）
│
├── stores/                 # 🟡 第2步：状态管理
│   └── blocker-store.ts   # Zustand Store（带详细中文注释）
│
├── components/ui/          # 🔵 第3步：UI 组件
│   ├── button.tsx         # 按钮组件
│   ├── input.tsx          # 输入框
│   ├── switch.tsx         # 开关
│   ├── badge.tsx          # 徽章
│   ├── card.tsx           # 卡片
│   ├── dialog.tsx         # 对话框
│   └── tabs.tsx           # 标签页
│
├── popup/                  # 🟠 第4步：Popup 页面
│   ├── App.tsx            # 主组件
│   └── components/
│       ├── AddClassForm.tsx      # 添加表单
│       └── BlockedClassList.tsx  # 列表展示
│
├── options/                # 🟣 第5步：设置页面
│   └── App.tsx            # 主题、快捷键、导入导出
│
├── content/                # 🔴 第6步：内容脚本（核心）
│   ├── index.tsx          # 元素屏蔽 + 选择器
│   └── styles.css         # 高亮样式
│
├── background/             # ⚫ 第7步：后台脚本
│   └── index.ts           # Service Worker
│
├── styles/
│   └── globals.css        # Tailwind 配置 + 暗色主题
│
└── manifest.ts            # Chrome 扩展配置
```

---

## 核心功能实现

### 1. 数据结构设计

**思考链路**：屏蔽功能需要存储什么？→ 类名 + 启用状态 + 作用域（域名）

```typescript
// src/lib/types.ts
interface BlockedClass {
  className: string; // 要屏蔽的类名（支持组合如 "card item"）
  enabled: boolean; // 单项开关
  domain: string | null; // null = 全局生效，否则只在指定域名生效
}
```

### 2. CSS 选择器生成

**思考链路**：如何根据类名屏蔽元素？→ 动态生成 CSS 选择器 → 两种匹配模式

```typescript
// src/lib/utils.ts
function generateSelector(className: string): string {
  if (className.includes(' ')) {
    // 组合匹配：同时包含所有类（AND 逻辑）
    // "card item" → [class~="card"][class~="item"]
    const classes = className.trim().split(/\s+/);
    return classes.map((cls) => `[class~="${cls}"]`).join('');
  } else {
    // 包含匹配：类名片段
    // "ad" → [class*="ad"]（匹配 ad-banner, sidebar-ad 等）
    return `[class*="${className}"]`;
  }
}
```

### 3. 状态管理 (Zustand)

**思考链路**：React 组件如何共享状态？→ Zustand 比 Redux 更轻量 → 带持久化

```typescript
// src/stores/blocker-store.ts（简化版）
import { create } from 'zustand';

const useBlockerStore = create<BlockerState>((set, get) => ({
  // 状态
  blockedClasses: [],
  isEnabled: true,

  // Action：添加屏蔽项
  addClass: (className, domain) => {
    set((state) => ({
      blockedClasses: [...state.blockedClasses, { className, enabled: true, domain }]
    }));
  },

  // 从 Chrome Storage 加载
  loadFromStorage: async () => {
    const data = await chrome.storage.local.get(['blockedClasses', 'isEnabled']);
    set({
      blockedClasses: data.blockedClasses || [],
      isEnabled: data.isEnabled ?? true
    });
  }
}));

// 选择器 Hook（性能优化）
export const useGroupedClasses = () => useBlockerStore((state) => groupByDomain(state.blockedClasses));
```

> 💡 完整代码包含详细的中文注释，适合学习 Zustand 用法

### 4. 元素屏蔽实现

**思考链路**：如何让屏蔽立即生效？→ 动态注入 `<style>` 标签 → 监听存储变化

```typescript
// src/content/index.tsx（简化版）
let styleElement: HTMLStyleElement | null = null;

// 创建样式容器
function createStyleElement() {
  styleElement = document.createElement('style');
  styleElement.id = 'element-blocker-styles';
  document.head.appendChild(styleElement);
}

// 更新屏蔽样式
function updateBlockingStyles() {
  if (!styleElement) return;

  // 过滤出当前域名下激活的规则
  const activeClasses = blockedClasses.filter((item) => item.enabled && (item.domain === null || item.domain === currentDomain));

  if (activeClasses.length > 0) {
    // 生成 CSS：.ad-wrapper, [class*="banner"] { display: none !important; }
    const selectors = activeClasses.map((item) => generateSelector(item.className)).join(', ');
    styleElement.textContent = `${selectors} { display: none !important; }`;
  } else {
    styleElement.textContent = '';
  }
}
```

### 5. 可视化元素选择器

**思考链路**：如何让用户点选元素？→ 高亮覆盖层 + 事件拦截 + 类名提取

```typescript
// src/content/index.tsx（简化版）
let highlightOverlay: HTMLDivElement | null = null;

// 鼠标移动时高亮元素
function handleMouseMove(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.className || target === highlightOverlay) return;

  // 创建覆盖层显示边界
  const rect = target.getBoundingClientRect();
  highlightOverlay!.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background: rgba(59, 130, 246, 0.2);
    border: 2px solid #3b82f6;
    pointer-events: none;
    z-index: 999999;
  `;
}

// 点击时提取类名
function handleClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  const target = e.target as HTMLElement;
  const classes = Array.from(target.classList);

  // 弹出对话框让用户选择要屏蔽的类名
  showClassSelectionDialog(classes);
}
```

### 6. 扩展各部分通信

**思考链路**：Popup、Content Script、Background 如何协作？→ Chrome Message API

```
┌─────────────────────────────────────────────────────────┐
│                      用户操作流程                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────┐  添加规则  ┌─────────────┐  发送消息      │
│   │ Popup   │ ────────→ │ Zustand     │ ────────→      │
│   │ 界面    │           │ Store       │                │
│   └─────────┘           └─────────────┘                │
│                               │                        │
│                               │ chrome.tabs.sendMessage│
│                               ▼                        │
│   ┌─────────────────────────────────────────────────┐  │
│   │              Content Script                      │  │
│   │  • 接收消息                                       │  │
│   │  • 更新 blockedClasses                           │  │
│   │  • 重新生成 CSS                                   │  │
│   │  • 注入 <style> 标签                             │  │
│   └─────────────────────────────────────────────────┘  │
│                               │                        │
│                               │ 页面元素被隐藏          │
│                               ▼                        │
│   ┌─────────────────────────────────────────────────┐  │
│   │              Background (Service Worker)         │  │
│   │  • 监听标签页切换                                 │  │
│   │  • 更新图标状态（激活/未激活）                     │  │
│   │  • 处理快捷键命令                                 │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 暗色主题实现

使用 Tailwind CSS v4 的 CSS-first 配置：

```css
/* src/styles/globals.css */
@import 'tailwindcss';

@theme inline {
  /* 亮色主题变量 */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  /* ... */
}

/* 暗色主题覆盖 */
@custom-variant dark (&:where(.dark, .dark *));

.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.922 0 0);
  /* ... */
}
```

组件中直接使用：

```tsx
<div className="bg-background text-foreground">
  <Button variant="default">自动适配主题</Button>
</div>
```

---

## 关键文件说明

| 文件                                                       | 职责     | 核心概念                    |
| ---------------------------------------------------------- | -------- | --------------------------- |
| [src/lib/types.ts](src/lib/types.ts)                       | 类型定义 | TypeScript 接口             |
| [src/lib/utils.ts](src/lib/utils.ts)                       | 工具函数 | CSS 选择器生成、类名合并    |
| [src/stores/blocker-store.ts](src/stores/blocker-store.ts) | 状态管理 | Zustand create/set/get      |
| [src/content/index.tsx](src/content/index.tsx)             | 核心逻辑 | 动态 CSS、元素选择器        |
| [src/popup/App.tsx](src/popup/App.tsx)                     | 弹窗界面 | React Hooks、Zustand 选择器 |
| [src/manifest.ts](src/manifest.ts)                         | 扩展配置 | Manifest V3、CRXJS          |

---

## 开发建议

1. **修改 UI**：从 `src/popup/` 或 `src/options/` 开始
2. **添加新规则类型**：修改 `src/lib/types.ts` 和 `src/stores/blocker-store.ts`
3. **调整屏蔽逻辑**：修改 `src/content/index.tsx` 的 `generateSelector` 和 `updateBlockingStyles`
4. **添加新的 UI 组件**：在 `src/components/ui/` 中添加，参考 shadcn/ui 规范

## License

MIT
