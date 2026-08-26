import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { RoomState, ChatMessage, Promise, GamePhase } from '@parliament/shared';
import { connectSocket, getSocket, disconnectSocket } from '@/socket/client';
import { useUserStore } from './user';

// ============================================================
// 游戏状态 — 单一状态源（订阅数据层 Socket.IO）
// 渲染层与 UI 层都只订阅此 store，互不直接通信
// ============================================================

export const useGameStore = defineStore('game', () => {
  const roomState = ref<RoomState | null>(null);
  const playerId = ref<string>('');
  const connected = ref(false);
  const errorMsg = ref<string>('');

  const socket = computed(() => getSocket());

  // —— 计算属性 ——
  const phase = computed<GamePhase>(() => roomState.value?.phase ?? 'lobby');
  const players = computed(() => roomState.value?.players ?? []);
  const currentBill = computed(() => roomState.value?.currentBill ?? null);
  const currentRound = computed(() => roomState.value?.currentRound ?? 0);
  const totalRounds = computed(() => roomState.value?.totalRounds ?? 3);
  const myPlayer = computed(() => players.value.find((p) => p.id === playerId.value));
  const publicMessages = computed(() =>
    (roomState.value?.messages ?? []).filter((m) => m.type === 'public'),
  );
  const myPromises = computed(() =>
    (roomState.value?.promises ?? []).filter(
      (p) => p.fromPlayerId === playerId.value || p.toPlayerId === playerId.value,
    ),
  );

  // —— 连接与事件绑定 ——
  function connect() {
    const s = connectSocket();
    const user = useUserStore();
    if (user.name) {
      s.auth = { name: user.name, token: user.token };
    }

    s.on('connect', () => {
      connected.value = true;
      errorMsg.value = '';
    });

    s.on('disconnect', () => {
      connected.value = false;
    });

    s.on('room:joined', ({ playerId: pid, roomId }) => {
      playerId.value = pid;
      console.log(`[Game] 已加入房间 ${roomId}`);
    });

    s.on('room:state', (state) => {
      roomState.value = state;
    });

    s.on('room:error', ({ message }) => {
      errorMsg.value = message;
    });

    s.on('chat:message', (msg: ChatMessage) => {
      const rs = roomState.value;
      if (rs) rs.messages.push(msg);
    });

    s.on('promise:update', (p: Promise) => {
      const rs = roomState.value;
      if (!rs) return;
      const idx = rs.promises.findIndex((x) => x.id === p.id);
      if (idx >= 0) rs.promises[idx] = p;
      else rs.promises.push(p);
    });

    s.on('phase:change', ({ phase: ph, roundIndex }) => {
      const rs = roomState.value;
      if (rs) {
        rs.phase = ph as GamePhase;
        rs.currentRound = roundIndex;
      }
    });

    s.on('game:finished', ({ rankings }) => {
      const rs = roomState.value;
      if (rs) rs.phase = 'finished';
      console.log('[Game] 终局排名', rankings);
    });
  }

  // —— 动作 ——
  function joinRoom(roomId: string) {
    const user = useUserStore();
    socket.value.emit('room:join', { roomId, playerName: user.name || '议员' });
  }

  function setReady(ready: boolean) {
    socket.value.emit('room:ready', ready);
  }

  function startGame() {
    socket.value.emit('game:start');
  }

  function sendMessage(content: string, toPlayerId?: string, type: 'private' | 'public' = 'public') {
    const channelId = toPlayerId
      ? `private-${[playerId.value, toPlayerId].sort().join('-')}`
      : 'public';
    socket.value.emit('chat:send', { channelId, toPlayerId, type, content });
  }

  function createPromise(toPlayerId: string, fromAction: string, toAction: string, isPublic: boolean) {
    socket.value.emit('promise:create', { toPlayerId, fromAction, toAction, isPublic });
  }

  function castVote(choice: 'yea' | 'nay' | 'abstain') {
    socket.value.emit('vote:cast', { choice });
  }

  function leaveRoom() {
    socket.value.emit('room:leave');
    roomState.value = null;
  }

  function disconnect() {
    disconnectSocket();
    connected.value = false;
    roomState.value = null;
  }

  return {
    roomState,
    playerId,
    connected,
    errorMsg,
    phase,
    players,
    currentBill,
    currentRound,
    totalRounds,
    myPlayer,
    publicMessages,
    myPromises,
    connect,
    joinRoom,
    setReady,
    startGame,
    sendMessage,
    createPromise,
    castVote,
    leaveRoom,
    disconnect,
  };
});
