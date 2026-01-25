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
	cd dist && zip -r ../element_blocker.zip . && cd ..
	
	# 检查 Release 是否存在
	if gh release view {{TAG}} &>/dev/null; then
		echo "🔄 Release {{TAG}} 已存在，更新中..."
		# Release 存在，删除旧的 assets 并上传新的
		gh release upload {{TAG}} element_blocker.zip --clobber
		echo "✅ Release {{TAG}} 更新成功！"
	else
		echo "🚀 创建新的 GitHub Release..."
		# 如果没有提供 NOTES，使用默认值
		if [ -z "{{NOTES}}" ]; then
			gh release create {{TAG}} element_blocker.zip --title "{{TAG}}"
		else
			gh release create {{TAG}} element_blocker.zip --title "{{TAG}}" --notes "{{NOTES}}"
		fi
		echo "✅ Release {{TAG}} 创建成功！"
	fi
	
	rm -f element_blocker.zip
	rm -rf dist
	echo "🧹 清理临时文件完成"

# 将 dev 分支合并到 main 并推送
merge-dev-to-main:
	git switch main
	git merge origin/dev
	git push
	git switch dev

# 替换现有标签 (仅限 main 分支)
# 使用方式: just retag v2.0.0
retag tag_name:
	#!/usr/bin/env bash
	set -e
	# 1. 检查分支
	current_branch=$(git branch --show-current)
	if [ "$current_branch" != "main" ]; then
		echo "错误: 当前不在 main 分支。请先切换到 main 分支 (git checkout main)。"
		exit 1
	fi

	# 2. 检查 Tag 是否存在
	# 检查本地
	tag_exists_local=$(git tag -l "{{tag_name}}")
	# 检查远程
	tag_exists_remote=$(git ls-remote --tags origin refs/tags/{{tag_name}} 2>/dev/null)

	if [ -z "$tag_exists_local" ] && [ -z "$tag_exists_remote" ]; then
		echo "提示: 标签 '{{tag_name}}' 在本地和远程均不存在。"
		echo "如需新增并推送该标签，请手动执行以下命令："
		echo "  git tag {{tag_name}}"
		echo "  git push origin {{tag_name}}"
		exit 1
	fi

	# 3. 替换逻辑
	echo "检测到标签 '{{tag_name}}'，正在执行替换操作..."
	
	# 删除本地 (如果存在)
	if [ -n "$tag_exists_local" ]; then
		git tag -d "{{tag_name}}" > /dev/null
		echo "已删除本地旧标签"
	fi
	
	# 删除远程 (如果存在)
	if [ -n "$tag_exists_remote" ]; then
		git push origin :refs/tags/{{tag_name}} > /dev/null 2>&1
		echo "已删除远程旧标签"
	fi

	# 基于当前 main 创建 new tag 并推送
	git tag {{tag_name}}
	git push origin {{tag_name}}
	
	echo "成功: 标签 '{{tag_name}}' 已更新为当前 main 分支的最新状态并推送到远程。"
