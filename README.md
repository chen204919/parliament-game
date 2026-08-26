# 《议会博弈》

博弈论策略 · 多人在线谈判 · 2D 暗黑权谋风

4-6 名玩家进入虚拟议会，每局 5-7 轮，通过谈判结盟、投票、背叛最大化政治资本。每个机制背后映射经典博弈论模型，把"重复博弈 + 声誉"的张力从单局扩展到跨局长线生涯。

## v0 范围

- 4 人房间（3 玩家 + 1 AI NPC 填位）
- 3 轮固定议案
- 私聊 + 公开声明 + 盲投
- 简单声誉系统（历史兑现率跨局延续）
- 程序化美术（几何头像 + 身份色）

## 技术架构：三层分离

渲染层（Phaser 3 Canvas）与 UI 层（Vue DOM）解耦，都只订阅数据层（Socket.IO + Pinia），互不直接通信。

| 层 | 技术 | 职责 |
|----|------|------|
| 渲染层 | Phaser 3 | 议会桌场景、议员棋子、状态动效 |
| UI 层 | Vue 3 + Element Plus | 谈判面板、承诺契约、大厅导航 |
| 数据层 | Socket.IO + Pinia | 单一状态源、实时双向同步 |
| 服务层 | Node + Express + SQLite | 房间管理、声誉持久化、AI NPC |

## 目录结构

```
博弈/
├── shared/          # 共享类型与常量（渲染层/UI层/服务层共用）
├── server/          # 服务层（Express + Socket.IO + SQLite）
└── client/          # 渲染层 + UI 层（Vue 3 + Vite + Phaser 3）
```

## 开发

```bash
# 安装依赖
npm install

# 同时启动 shared/server/client 开发服务
npm run dev

# 或单独启动
npm run dev:server
npm run dev:client
```

## 视觉规范

墨色为底 `#0E0E10` · 暗金为锋 `#C9A961` · 衬线立威 · 一色一义绝不滥用。
