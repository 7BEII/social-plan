# Social Plan

手机个人记录网页：意向人、可编辑经验笔记、意向值进度条、偏好关键词排行。

网站：https://7beii.github.io/social-plan/

使用：打开网站，可添加到手机主屏幕。记录保存在当前浏览器 localStorage，不会自动上传到 GitHub。已实现flomo登录配置、真实拉取/推送和待同步保护，固定读取 #PD/谈恋爱；需在每个浏览器导入Token。浏览器直连存在403/跨域问题，稳定跨设备同步需要部署仓库内的代理并设置flomo-config.js。代理尚未部署，详情见 docs/flomo-sync.md。

新意向人意向值默认待填写，输入0–100整数并确定后保存。共性推荐值为拥有关键词的人数/意向人总数，每人每词去重。

网页样式和字体均随仓库发布，无需运行时外部CDN。公开源码只含模拟数据，不包含个人笔记与凭证。

维护：编辑 index.html 后运行 npx --yes tailwindcss@3.4.17 -i tailwind-input.css -o styles.css -c tailwind.config.cjs --minify，再提交推送 main。GitHub Pages从main根目录发布。

第三方：Tailwind CSS（MIT）；Font Awesome Free 6.4.0（代码MIT、字体SIL OFL 1.1、图标CC BY 4.0），许可说明 https://fontawesome.com/license/free 。



