// ============================================================
// Socket.IO 事件契约 — 数据层实时双向同步
// ============================================================

import type { RoomState, ChatMessage, Promise, VoteChoice } from './types.js';

// ---- 客户端 → 服务端 事件 ----
export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string; playerName: string }) => void;
  'room:leave': () => void;
  'room:ready': (ready: boolean) => void;
  'game:start': () => void;
  'chat:send': (payload: {
    channelId: string;
    toPlayerId?: string;
    type: 'private' | 'public';
    content: string;
  }) => void;
  'promise:create': (payload: {
    toPlayerId: string;
    fromAction: string;
    toAction: string;
    isPublic: boolean;
  }) => void;
  'promise:respond': (payload: { promiseId: string; accept: boolean }) => void;
  'vote:cast': (payload: { choice: VoteChoice }) => void;
}

// ---- 服务端 → 客户端 事件 ----
export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:joined': (payload: { playerId: string; roomId: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'chat:message': (message: ChatMessage) => void;
  'promise:update': (promise: Promise) => void;
  'phase:change': (payload: { phase: string; roundIndex: number }) => void;
  'game:finished': (payload: { rankings: Array<{ playerId: string; capital: number; reputation: number }> }) => void;
}

export * from './types.js';
export * from './constants.js';
