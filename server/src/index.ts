import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@parliament/shared';
import { config } from './config.js';
import { setupSocket } from './socket.js';
import { signToken, verifyToken, type JwtPayload } from './auth.js';
import { db } from './db.js';
import { nanoid } from 'nanoid';
import crypto from 'node:crypto';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ---- 健康检查 ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ---- 注册（v0 极简：用户名+密码，本地存储） ----
app.post('/api/auth/register', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    res.status(400).json({ error: '用户名和密码必填' });
    return;
  }
  const id = nanoid();
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  try {
    db.prepare('INSERT INTO users (id, name, password_hash) VALUES (?, ?, ?)').run(id, name, hash);
    const token = signToken({ userId: id, name });
    res.json({ token, user: { id, name, reputation: 0.5 } });
  } catch {
    res.status(409).json({ error: '用户名已存在' });
  }
});

// ---- 登录 ----
app.post('/api/auth/login', (req, res) => {
  const { name, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const row = db.prepare('SELECT id, name, reputation, password_hash FROM users WHERE name = ?').get(name) as
    | { id: string; name: string; reputation: number; password_hash: string }
    | undefined;
  if (!row || row.password_hash !== hash) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const token = signToken({ userId: row.id, name: row.name });
  res.json({ token, user: { id: row.id, name: row.name, reputation: row.reputation } });
});

// ---- 鉴权中间件 ----
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) {
    res.status(401).json({ error: '令牌无效' });
    return;
  }
  (req as unknown as { user: JwtPayload }).user = payload;
  next();
}

// ---- 获取用户档案 ----
app.get('/api/profile', authMiddleware, (req, res) => {
  const { userId } = (req as unknown as { user: JwtPayload }).user;
  const row = db.prepare('SELECT id, name, reputation, total_promises, fulfilled_promises, capital_total FROM users WHERE id = ?').get(userId) as
    | { id: string; name: string; reputation: number; total_promises: number; fulfilled_promises: number; capital_total: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({
    id: row.id,
    name: row.name,
    reputation: row.reputation,
    totalPromises: row.total_promises,
    fulfilledPromises: row.fulfilled_promises,
    capitalTotal: row.capital_total,
  });
});

// ---- 创建 HTTP 服务器 + Socket.IO ----
const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
});

setupSocket(io);

httpServer.listen(config.port, () => {
  console.log(`\n  《议会博弈》服务层启动`);
  console.log(`  HTTP:   http://localhost:${config.port}`);
  console.log(`  Socket: ws://localhost:${config.port}`);
  console.log(`  数据库: ${config.dbPath}\n`);
});

export { app, httpServer, io };
