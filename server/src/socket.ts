import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ClientToServerEvents, ServerToClientEvents } from '@parliament/shared';
import { roomManager } from './game/roomManager.js';
import { GAME_CONFIG } from '@parliament/shared';
import { createAIPlayer, aiDecideVote, aiNegotiate } from './ai/npc.js';
import type { GameStateMachine } from './game/stateMachine.js';

// ============================================================
// Socket.IO 事件处理 — 数据层双向同步
// ============================================================

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

function broadcastState(io: IoServer, machine: GameStateMachine): void {
  io.to(machine.state.id).emit('room:state', machine.state);
}

export function setupSocket(io: IoServer): void {

  io.on('connection', (socket) => {
    console.log(`[Socket] 连接: ${socket.id}`);

    // ---- 房间加入 ----
    socket.on('room:join', ({ roomId, playerName }) => {
      const result = roomManager.joinRoom(roomId, socket.id, playerName);
      if ('error' in result) {
        socket.emit('room:error', { message: result.error });
        return;
      }
      const { machine, player } = result;
      socket.join(machine.state.id);
      socket.emit('room:joined', { playerId: player.id, roomId: machine.state.id });
      broadcastState(io, machine);
    });

    // ---- 准备 ----
    socket.on('room:ready', (ready) => {
      const machine = roomManager.getPlayerRoom(socket.id);
      if (!machine) return;
      const player = machine.state.players.find((p) => p.id === socket.id);
      if (player) player.ready = ready;
      broadcastState(io, machine);

      // 全员准备自动开始（v0）
      if (machine.canStart() && machine.state.phase === 'lobby') {
        // 填入 AI 凑齐 4 人
        const need = GAME_CONFIG.V0_ROOM_SIZE - machine.state.players.length;
        for (let i = 0; i < need; i++) {
          const ai = createAIPlayer(i);
          machine.addPlayer(ai);
        }
        machine.state.players.forEach((p) => (p.ready = true));
        machine.transitionTo('reveal');
        broadcastState(io, machine);
        io.to(machine.state.id).emit('phase:change', { phase: 'reveal', roundIndex: 0 });
      }
    });

    // ---- 离开 ----
    socket.on('room:leave', () => {
      const machine = roomManager.leaveRoom(socket.id);
      if (machine) broadcastState(io, machine);
    });

    // ---- 聊天 ----
    socket.on('chat:send', ({ channelId, toPlayerId, type, content }) => {
      const machine = roomManager.getPlayerRoom(socket.id);
      if (!machine) return;
      const msg = machine.addMessage({
        roomId: machine.state.id,
        channelId,
        fromPlayerId: socket.id,
        toPlayerId,
        type,
        content,
      });
      if (type === 'public') {
        io.to(machine.state.id).emit('chat:message', msg);
      } else {
        // 私聊：发给发送者和接收者
        socket.emit('chat:message', msg);
        if (toPlayerId) {
          io.to(toPlayerId).emit('chat:message', msg);
          // AI 填位的私聊回应
          const target = machine.state.players.find((p) => p.id === toPlayerId);
          if (target?.isAI) {
            handleAIResponse(io, machine, toPlayerId, socket.id);
          }
        }
      }
    });

    // ---- 创建承诺 ----
    socket.on('promise:create', ({ toPlayerId, fromAction, toAction, isPublic }) => {
      const machine = roomManager.getPlayerRoom(socket.id);
      if (!machine) return;
      const promise = machine.createPromise(socket.id, toPlayerId, fromAction, toAction, isPublic);
      io.to(machine.state.id).emit('promise:update', promise);
    });

    // ---- 投票 ----
    socket.on('vote:cast', ({ choice }) => {
      const machine = roomManager.getPlayerRoom(socket.id);
      if (!machine || machine.state.phase !== 'vote') return;
      machine.castVote(socket.id, choice);
      broadcastState(io, machine);

      // 所有玩家投票后进入结算
      if (machine.allVoted() || hasHumanPlayersVoted(machine)) {
        aiVoteAndSettle(io, machine);
      }
    });

    // ---- 断开 ----
    socket.on('disconnect', () => {
      console.log(`[Socket] 断开: ${socket.id}`);
      const machine = roomManager.leaveRoom(socket.id);
      if (machine) broadcastState(io, machine);
    });
  });

  // ---- 阶段定时器驱动 ----
  setInterval(() => {
    for (const machine of roomManager.listRooms()) {
      const m = roomManager.getRoom(machine.id);
      if (!m || m.state.phase === 'lobby' || m.state.phase === 'finished') continue;

      const elapsed = Date.now() - m.state.phaseStartTime;
      if (elapsed >= m.state.phaseDuration) {
        handlePhaseTimeout(io, m);
      }
    }
  }, 1000);
}

function hasHumanPlayersVoted(machine: GameStateMachine): boolean {
  return machine.state.players.filter((p) => !p.isAI).every((p) => p.hasVoted);
}

async function aiVoteAndSettle(io: IoServer, machine: GameStateMachine) {
  // AI 玩家投票
  for (const player of machine.state.players) {
    if (player.isAI && !player.hasVoted) {
      const choice = await aiDecideVote(player, machine.state);
      machine.castVote(player.id, choice);
    }
  }
  io.to(machine.state.id).emit('room:state', machine.state);

  // 进入结算（阶段定时器会自动推进到下一轮/终局）
  machine.transitionTo('settle');
  broadcastState(io, machine);
  io.to(machine.state.id).emit('phase:change', { phase: 'settle', roundIndex: machine.state.currentRound });
}

async function handlePhaseTimeout(io: IoServer, machine: GameStateMachine) {
  const phase = machine.state.phase;
  switch (phase) {
    case 'reveal':
      machine.transitionTo('negotiate');
      io.to(machine.state.id).emit('phase:change', { phase: 'negotiate', roundIndex: machine.state.currentRound });
      broadcastState(io, machine);
      // AI 在谈判阶段发言
      for (const p of machine.state.players) {
        if (p.isAI) {
          const speech = await aiNegotiate(p, machine.state);
          if (speech) {
            machine.addMessage({
              roomId: machine.state.id,
              channelId: 'public',
              fromPlayerId: p.id,
              type: 'public',
              content: speech,
            });
            broadcastState(io, machine);
          }
        }
      }
      break;
    case 'negotiate':
      machine.transitionTo('vote');
      io.to(machine.state.id).emit('phase:change', { phase: 'vote', roundIndex: machine.state.currentRound });
      broadcastState(io, machine);
      break;
    case 'vote':
      // 超时自动触发 AI 投票并结算（未投票人类视为弃权）
      await aiVoteAndSettle(io, machine);
      break;
    case 'settle':
      machine.nextRound();
      io.to(machine.state.id).emit('phase:change', {
        phase: machine.state.phase,
        roundIndex: machine.state.currentRound,
      });
      broadcastState(io, machine);
      if (machine.state.phase === 'finished') {
        io.to(machine.state.id).emit('game:finished', { rankings: machine.getRankings() });
      }
      break;
  }
}

async function handleAIResponse(io: IoServer, machine: GameStateMachine, aiId: string, humanId: string) {
  const aiPlayer = machine.state.players.find((p) => p.id === aiId);
  if (!aiPlayer) return;
  const speech = await aiNegotiate(aiPlayer, machine.state);
  if (speech) {
    const msg = machine.addMessage({
      roomId: machine.state.id,
      channelId: `private-${aiId}-${humanId}`,
      fromPlayerId: aiId,
      toPlayerId: humanId,
      type: 'private',
      content: speech,
    });
    io.to(aiId).emit('chat:message', msg);
    io.to(humanId).emit('chat:message', msg);
  }
}
