# Anke Sports 正式品牌资源

采用用户选定的第一版前倾 K：斜向笔画、中间切口，表达起跑和向前。SVG 按批准概念稿轮廓整理，统一为纯色，去除生成图片纹理。

- `mark.svg`：透明背景的 SVG 母版，用于产品内品牌入口。
- `mark-1024.png`：透明背景 PNG。
- `icon.svg`、`icon-{size}.png`：石墨底色的方形图标，16–1024px。
- `approved-concept.png`：批准的原始概念稿，仅作为设计来源留档。
- `src/app/icon.svg`、`apple-icon.png`、`favicon.ico`：由同一母版生成，供 Next.js 自动输出浏览器与主屏幕图标标签。

颜色：酸橙 `#D7F35C`，石墨 `#101215`。保持正方形画布和内置留白，不拉伸、旋转或改变切口，不加阴影和渐变。产品内建议 32px 及以上；浏览器图标使用提供的 16/32/48px 文件。

修改母版后，在项目根目录运行 `node scripts/build-brand-assets.mjs` 重新生成所有派生资源。扩展已退出当前产品范围，历史扩展文件未纳入此次替换。
