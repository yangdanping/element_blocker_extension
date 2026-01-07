# 安装依赖
i:
    pnpm i

# 交互式升级所有包到最新版本
up:
    pnpm up -i --latest

# 启动开发服务器
dev:
    pnpm dev

# 执行代码格式化 (Prettier)
format:
    pnpm prettier

# 类型检查
type-check:
    pnpm exec tsc --noEmit

# 执行生产环境构建
build:
    pnpm build

# 预览构建产物
preview:
    pnpm preview

# 更新 Prettier 配置 (从远程仓库获取)
update-prettier:
    pnpm update:prettier
