# 快速上手指南

本文档介绍如何启动项目的**开发环境**和**正式环境（Docker）**。

---

## 开发环境

### 前置条件

- Node.js 20+
- pnpm 9+
- SQLite（无需手动安装，Prisma 自动创建）

### 步骤

**1. 安装依赖**

```bash
npm install
```

**2. 配置环境变量**

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

`.env` 默认使用 SQLite 本地数据库，无需额外配置。

**3. 初始化数据库**

```bash
npm run db:migrate
npm run db:seed
```

**4. 启动开发服务器**

```bash
npm run dev
```

服务启动后访问：
- 前端：http://localhost:3000
- API：http://localhost:3001


---

## 正式环境（Docker）

### 前置条件

- Docker 24+
- Docker Compose v2+

### 步骤

**1. 配置环境变量**

环境变量统一在 `docker-compose.yml` 中配置，无需单独创建 `.env` 文件。

参考 `.env.example` 中的必填项，直接编辑 `docker-compose.yml` 中的 `api` 和 `web` 服务环境变量：

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgresql://postgres:654321@db:5432/skills_sec
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-random-secret-here
  web:
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      JWT_SECRET: your-random-secret-here  # 必须与 api 一致
```

> **注意**：`JWT_SECRET` 在 API 和 Web 服务中必须保持一致。

**2. 构建并启动**

```bash
docker-compose up --build
```

首次构建会：
- 构建 API 和 Web 的 Docker 镜像
- 创建 PostgreSQL 数据库
- 启动 Redis

**3. 初始化数据库（仅首次）**

Docker 构建时已自动运行 `prisma db push`，只需手动执行一次 seed（如有）：

```bash
docker-compose exec api npx prisma db seed
```

**4. 访问服务**

- 前端：http://localhost:3000
- API：http://localhost:3001

---

## 常用操作

### 查看日志

```bash
# 所有服务
docker-compose logs -f

# 指定服务
docker-compose logs -f api
docker-compose logs -f web
```

### 停止服务

```bash
docker-compose down
```

### 重启服务

```bash
docker-compose restart
```

### 进入容器

```bash
docker-compose exec api sh
docker-compose exec web sh
```

### 数据库操作

```bash
# 查看 Prisma Studio
docker-compose exec api npx prisma studio

# 运行迁移
docker-compose exec api npx prisma db migrate

# 重新生成 Prisma Client
docker-compose exec api npx prisma generate
```

### 重建（清除所有数据）

```bash
docker-compose down -v     # 删除数据卷
docker-compose up --build # 重新构建
```

---

## 环境差异

| 项目 | 开发环境 | 正式环境 |
|------|----------|----------|
| 数据库 | SQLite (本地文件) | PostgreSQL (Docker) |
| 规则加载 | JSON 文件 | JSON 文件 (挂载到容器) |
| 规则存储 | 数据库 (SQLite) | 数据库 (PostgreSQL) |
| Redis | - | Docker 内置 |
| AI分析 | 可用 | 可用（需配置 API Key） |

---

## 常见问题

**Q: Docker 构建失败？**
- 确保 `docker-compose up --build` 在项目根目录执行
- 检查 `docker-compose.yml` 中的环境变量是否正确

**Q: 数据库连接失败？**
- 确认 PostgreSQL 容器已启动：`docker-compose ps db`
- 检查 `DATABASE_URL` 是否正确

**Q: 规则没有加载？**
- 开发环境：重启 `npm run dev`，seeder 会自动运行
- 正式环境：访问任意 API 路由触发 seeder

