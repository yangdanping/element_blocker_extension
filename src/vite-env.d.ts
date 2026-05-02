/// <reference types="vite/client" />
/// <reference types="chrome" />

/** Chrome 扩展运行环境里存在全局 `chrome`；@types/chrome 主要把 API 挂在 `Window` 上，这里从 Window 推断出全局对象类型。 */
type GlobalChrome = Window extends { chrome: infer C } ? C : never;

declare const chrome: GlobalChrome;
