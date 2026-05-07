# 宜人出行 (yrcx)

宜人出行是一个基于 Vue 3 + Vite + Vant 开发的移动端拼车/出行服务平台。

## 🚀 技术栈

- **前端框架**: [Vue 3](https://vuejs.org/) (Composition API)
- **构建工具**: [Vite](https://vitejs.dev/)
- **UI 组件库**: [Vant 4](https://vant-ui.github.io/vant/)
- **路由管理**: [Vue Router 4](https://router.vuejs.org/)
- **后端服务**: Cloudflare Workers / Functions (Serverless)
- **数据库**: Cloudflare D1 (SQLite)
- **地图服务**: 高德地图 API

## ✨ 主要功能

- **行程发布**: 司机和乘客均可发布拼车行程，支持路线选择、时间预约、座位设置等。
- **行程搜索**: 支持按类型（车找人/人找车）筛选行程。
- **地图集成**: 集成高德地图，支持地点搜索、自动定位及路线展示。
- **个人中心**: 管理个人发布的行程，绑定手机号。
- **管理后台**: 简易的后台管理系统，支持系统配置（公告、轮播图、API Key）及行程管理。

## 🛠️ 开发与部署

### 本地开发

1. 克隆仓库:
   ```bash
   git clone https://github.com/ctsfc9/yrcx.git
   cd yrcx
   ```

2. 安装依赖:
   ```bash
   pnpm install
   ```

3. 启动开发服务器:
   ```bash
   pnpm dev
   ```

### 部署

项目支持部署到 Cloudflare Pages。

1. 在 Cloudflare 控制台创建 Pages 项目。
2. 连接 GitHub 仓库。
3. 构建设置:
   - 构建命令: `pnpm build`
   - 输出目录: `dist`
4. 配置 D1 数据库并绑定到 Functions。

## 📂 项目结构

```text
src/
├── api/          # API 请求封装
├── components/   # 公共组件
├── composables/  # 组合式函数 (状态管理)
├── router/       # 路由配置
├── views/        # 页面视图
├── App.vue       # 根组件
└── main.js       # 入口文件
functions/        # 后端 Serverless 函数
```

## 📄 许可证

[MIT License](LICENSE)
