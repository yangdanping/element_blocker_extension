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

# 创建或更新 GitHub Release 并上传打包文件
# 用法: just release v2.0.0 [可选: "Release notes"]
# 如果 Release 已存在，会先删除旧的 assets 然后上传新的
release TAG NOTES='':
    #!/usr/bin/env bash
    set -e
    echo "🔨 开始构建发布版本..."
    RELEASE=true pnpm build
    echo "📦 打包扩展..."
    cd dist && zip -r ../element-blocker-extension.zip . && cd ..
    
    # 检查 Release 是否存在
    if gh release view {{TAG}} &>/dev/null; then
        echo "🔄 Release {{TAG}} 已存在，更新中..."
        # Release 存在，删除旧的 assets 并上传新的
        gh release upload {{TAG}} element-blocker-extension.zip --clobber
        echo "✅ Release {{TAG}} 更新成功！"
    else
        echo "🚀 创建新的 GitHub Release..."
        # 如果没有提供 NOTES，使用默认值
        if [ -z "{{NOTES}}" ]; then
            gh release create {{TAG}} element-blocker-extension.zip --title "{{TAG}}"
        else
            gh release create {{TAG}} element-blocker-extension.zip --title "{{TAG}}" --notes "{{NOTES}}"
        fi
        echo "✅ Release {{TAG}} 创建成功！"
    fi
    
    rm -f element-blocker-extension.zip
    echo "🧹 清理临时文件完成"
