<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGameStore } from '@/stores/game';
import { useUserStore } from '@/stores/user';
import { createPhaserGame, type ParliamentScene } from '@/scenes/ParliamentScene';
import type Phaser from 'phaser';
import { IDENTITY_LABELS, getReputationColor } from '@parliament/shared';

const route = useRoute();
const gameStore = useGameStore();
const user = useUserStore();

const phaserContainer = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;
let scene: ParliamentScene | null = null;

// 聊天输入
const chatInput = ref('');
const activeTab = ref<'public' | string>('public');
const activeChatTarget = ref<string>('');

// 承诺表单
const promiseForm = ref({
  toPlayerId: '',
  fromAction: '',
  toAction: '',
  isPublic: false,
});

// 投票选择
const voteChoice = ref<'yea' | 'nay' | 'abstain' | ''>('');

// 计算属性
const phase = computed(() => gameStore.phase);
const isLobby = computed(() => phase.value === 'lobby');
const isReveal = computed(() => phase.value === 'reveal');
const isNegotiate = computed(() => phase.value === 'negotiate');
const isVote = computed(() => phase.value === 'vote');
const isSettle = computed(() => phase.value === 'settle');
const isFinished = computed(() => phase.value === 'finished');

const latestResult = computed(() => {
  const results = gameStore.roomState?.results ?? [];
  return results.length > 0 ? results[results.length - 1] : null;
});

const voteStats = computed(() => {
  const votes = latestResult.value?.votes ?? [];
  return {
    yea: votes.filter((v) => v.choice === 'yea').length,
    nay: votes.filter((v) => v.choice === 'nay').length,
    abstain: votes.filter((v) => v.choice === 'abstain').length,
    total: votes.length,
  };
});

const billTypeLabel = computed(() => {
  const type = gameStore.currentBill?.type ?? 'allocation';
  const labels: Record<string, string> = {
    'allocation': '资源分配',
    'prisoners': '囚徒困境',
    'auction': '拍卖竞价',
    'public-goods': '公共基金',
    'voting-paradox': '投票悖论',
    'amendment': '修正案',
  };
  return labels[type] ?? type;
});

const myAllocation = computed(() => {
  const bill = gameStore.currentBill;
  if (!bill) return 0;
  const alloc = bill.allocations.find((a) => a.playerId === gameStore.playerId);
  return alloc?.percentage ?? 0;
});

const otherPlayers = computed(() =>
  gameStore.players.filter((p) => p.id !== gameStore.playerId),
);

const rankings = computed(() =>
  [...gameStore.players].sort((a, b) => b.capital - a.capital),
);

const phaseTimeLeft = computed(() => {
  const rs = gameStore.roomState;
  if (!rs || rs.phaseDuration === 0) return 0;
  const elapsed = Date.now() - rs.phaseStartTime;
  return Math.max(0, Math.ceil((rs.phaseDuration - elapsed) / 1000));
});

const phaseLabel = computed(() => {
  const labels: Record<string, string> = {
    lobby: '房间组建',
    reveal: '议案揭示',
    negotiate: '谈判阶段',
    vote: '投票阶段',
    settle: '结算',
    finished: '终局排名',
  };
  return labels[phase.value] ?? phase.value;
});

onMounted(() => {
  gameStore.connect();

  // 等待连接后加入房间
  setTimeout(() => {
    const roomId = (route.params.roomId as string) || '';
    gameStore.joinRoom(roomId);
  }, 500);

  // 初始化 Phaser（延迟到容器就绪）
  if (phaserContainer.value) {
    game = createPhaserGame(phaserContainer.value);
    game.events.once('ready', () => {
      scene = game?.scene.getScene('ParliamentScene') as ParliamentScene;
    });
  }
});

// 状态变化时同步 Phaser
watch(
  () => gameStore.roomState,
  (state) => {
    if (state && scene && scene.scene.isActive()) {
      scene.syncState(state);
    }
  },
  { deep: true },
);

onUnmounted(() => {
  gameStore.disconnect();
  game?.destroy(true);
});

// —— 动作 ——
function toggleReady() {
  gameStore.setReady(!gameStore.myPlayer?.ready);
}

function sendChat() {
  if (!chatInput.value.trim()) return;
  if (activeTab.value === 'public') {
    gameStore.sendMessage(chatInput.value, undefined, 'public');
  } else {
    gameStore.sendMessage(chatInput.value, activeChatTarget.value, 'private');
  }
  chatInput.value = '';
}

function selectChatTarget(playerId: string) {
  activeTab.value = playerId;
  activeChatTarget.value = playerId;
}

function submitPromise() {
  if (!promiseForm.value.toPlayerId || !promiseForm.value.fromAction) return;
  gameStore.createPromise(
    promiseForm.value.toPlayerId,
    promiseForm.value.fromAction,
    promiseForm.value.toAction,
    promiseForm.value.isPublic,
  );
  promiseForm.value = { toPlayerId: '', fromAction: '', toAction: '', isPublic: false };
}

function castVote(choice: 'yea' | 'nay' | 'abstain') {
  voteChoice.value = choice;
  gameStore.castVote(choice);
}

function getRepColor(rep: number) {
  return getReputationColor(rep);
}
</script>

<template>
  <div class="game-root">
    <!-- ===== 大厅阶段 ===== -->
    <div v-if="isLobby" class="lobby-root">
      <div class="card-gold lobby-card">
        <h2 class="serif">议会大厅</h2>
        <p class="text-muted">等待议员入场 · v0 自动 AI 填位</p>

        <div class="lobby-players">
          <div
            v-for="p in gameStore.players"
            :key="p.id"
            class="lobby-seat"
            :class="{ me: p.id === gameStore.playerId }"
          >
            <div class="seat-name serif">{{ p.name }}</div>
            <span v-if="p.isAI" class="tag-gold">AI</span>
            <span v-if="p.isHost" class="tag-gold">议长</span>
            <div class="seat-status">
              <span :class="p.ready ? 'text-green' : 'text-muted'">
                {{ p.ready ? '已就绪' : '等待中' }}
              </span>
            </div>
          </div>
        </div>

        <el-button type="primary" @click="toggleReady" class="ready-btn">
          {{ gameStore.myPlayer?.ready ? '取消就绪' : '准备就绪' }}
        </el-button>

        <p v-if="gameStore.errorMsg" class="text-red">{{ gameStore.errorMsg }}</p>
        <p class="text-muted lobby-hint">全员就绪后自动 AI 填位并开始</p>
      </div>
    </div>

    <!-- ===== 游戏阶段 ===== -->
    <div v-else class="battle-root">
      <!-- 顶部状态栏 -->
      <div class="battle-top">
        <div class="top-left">
          第 <b class="text-gold">{{ gameStore.currentRound + 1 }}</b> 轮 / 共 {{ gameStore.totalRounds }} 轮
        </div>
        <div class="top-center">
          <div class="phase-label serif">{{ phaseLabel }}</div>
          <div v-if="phaseTimeLeft > 0" class="phase-timer mono">{{ phaseTimeLeft }}s</div>
        </div>
        <div class="top-right">
          <span class="text-muted">资本</span>
          <b class="text-gold mono">{{ gameStore.myPlayer?.capital ?? 0 }}</b>
        </div>
      </div>

      <!-- 主区域 -->
      <div class="battle-main">
        <!-- 左侧：Phaser 渲染层 + 议员位 -->
        <div class="battle-left">
          <div ref="phaserContainer" class="phaser-container" />
          <div class="seats-row">
            <div
              v-for="p in gameStore.players"
              :key="p.id"
              class="seat-mini"
              :class="{ me: p.id === gameStore.playerId }"
            >
              <div class="seat-mini-name serif">{{ p.name }}</div>
              <div class="seat-mini-identity text-muted">
                {{ IDENTITY_LABELS[p.identity] }}
              </div>
              <div class="seat-mini-capital mono text-gold">+{{ p.capital }}</div>
              <div class="seat-mini-rep">
                <div
                  class="rep-mini-fill"
                  :style="{
                    width: `${Math.round(p.reputation * 100)}%`,
                    background: getRepColor(p.reputation),
                  }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：UI 层（谈判/投票面板） -->
        <div class="battle-right">
          <!-- 议案卡 -->
          <div v-if="gameStore.currentBill" class="bill-card card">
            <div class="bill-card-header">
              <h4 class="serif text-gold">议案 #{{ gameStore.currentBill.index + 1 }}</h4>
              <span class="bill-type-badge">{{ billTypeLabel }}</span>
            </div>
            <p class="bill-title">{{ gameStore.currentBill.title }}</p>
            <p class="text-muted bill-desc">{{ gameStore.currentBill.description }}</p>
            <div class="bill-allocations">
              <div
                v-for="alloc in gameStore.currentBill.allocations"
                :key="alloc.playerId"
                class="alloc-row"
                :class="{ me: alloc.playerId === gameStore.playerId }"
              >
                <span class="alloc-name">{{ gameStore.players.find((p) => p.id === alloc.playerId)?.name ?? '?' }}</span>
                <div class="alloc-bar-track">
                  <div class="alloc-bar-fill" :style="{ width: `${alloc.percentage * 2}%` }" />
                  <span class="alloc-bar-pct mono">{{ alloc.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 揭示阶段面板 -->
          <div v-if="isReveal" class="reveal-panel card">
            <div class="reveal-scroll">
              <div class="reveal-glow" />
              <h3 class="serif reveal-title">议案揭示</h3>
              <p class="text-muted reveal-hint">阅读议案 · 谈判即将开始</p>
              <div class="reveal-my-share">
                <span class="text-muted">我的分配</span>
                <b class="text-gold mono reveal-share-num">{{ myAllocation }}%</b>
              </div>
            </div>
          </div>

          <!-- 结算阶段面板 -->
          <div v-if="isSettle && latestResult" class="settle-panel card">
            <div class="settle-stamp" :class="{ passed: latestResult.passed, rejected: !latestResult.passed }">
              {{ latestResult.passed ? '议案通过' : '议案否决' }}
            </div>

            <div class="settle-votes">
              <div class="vote-tally yea">
                <span class="tally-num mono">{{ voteStats.yea }}</span>
                <span class="tally-label">赞成</span>
              </div>
              <div class="vote-tally nay">
                <span class="tally-num mono">{{ voteStats.nay }}</span>
                <span class="tally-label">反对</span>
              </div>
              <div class="vote-tally abstain">
                <span class="tally-num mono">{{ voteStats.abstain }}</span>
                <span class="tally-label">弃权</span>
              </div>
            </div>

            <div class="vote-bar-track">
              <div class="vote-bar-yea" :style="{ width: `${(voteStats.yea / voteStats.total) * 100}%` }" />
              <div class="vote-bar-nay" :style="{ width: `${(voteStats.nay / voteStats.total) * 100}%` }" />
              <div class="vote-bar-abstain" :style="{ width: `${(voteStats.abstain / voteStats.total) * 100}%` }" />
            </div>

            <div class="settle-changes">
              <div
                v-for="p in gameStore.players"
                :key="p.id"
                class="change-row"
                :class="{ me: p.id === gameStore.playerId }"
              >
                <span class="change-name serif">{{ p.name }}</span>
                <span class="change-cap mono" :class="(latestResult.capitalChanges[p.id] ?? 0) >= 0 ? 'text-green' : 'text-red'">
                  {{ (latestResult.capitalChanges[p.id] ?? 0) >= 0 ? '+' : '' }}{{ latestResult.capitalChanges[p.id] ?? 0 }}
                </span>
                <span class="change-rep mono text-muted">
                  {{ (latestResult.reputationChanges[p.id] ?? 0) >= 0 ? '+' : '' }}{{ ((latestResult.reputationChanges[p.id] ?? 0) * 100).toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- 谈判阶段：聊天 + 承诺 -->
          <div v-if="isNegotiate" class="negotiate-panel card">
            <div class="chat-tabs">
              <div
                class="chat-tab"
                :class="{ on: activeTab === 'public' }"
                @click="activeTab = 'public'"
              >
                公开厅
              </div>
              <div
                v-for="p in otherPlayers"
                :key="p.id"
                class="chat-tab"
                :class="{ on: activeTab === p.id }"
                @click="selectChatTarget(p.id)"
              >
                私聊·{{ p.name }}
              </div>
            </div>

            <div class="chat-messages">
              <div
                v-for="msg in gameStore.roomState?.messages.filter(
                  (m) =>
                    (activeTab === 'public' && m.type === 'public') ||
                    (activeTab !== 'public' &&
                      m.type === 'private' &&
                      (m.fromPlayerId === activeTab || m.toPlayerId === activeTab)),
                )"
                :key="msg.id"
                class="chat-msg"
                :class="{ me: msg.fromPlayerId === gameStore.playerId }"
              >
                <span class="msg-who" :class="msg.fromPlayerId === gameStore.playerId ? 'text-green' : 'text-gold'">
                  {{ gameStore.players.find((p) => p.id === msg.fromPlayerId)?.name ?? '?' }}:
                </span>
                <span class="msg-text">{{ msg.content }}</span>
              </div>
            </div>

            <div class="chat-input-row">
              <el-input
                v-model="chatInput"
                placeholder="发消息或发起承诺…"
                @keyup.enter="sendChat"
                class="chat-input"
              />
              <el-button type="primary" @click="sendChat">发出</el-button>
            </div>
          </div>

          <!-- 投票阶段 -->
          <div v-if="isVote" class="vote-panel card">
            <h4 class="serif text-gold">盲投表决</h4>
            <p class="text-muted">同时投票 · 过半数通过 · 你的选择不公开</p>
            <div class="vote-buttons">
              <button
                class="vote-btn"
                :class="{ selected: voteChoice === 'yea' }"
                @click="castVote('yea')"
              >
                赞成
              </button>
              <button
                class="vote-btn"
                :class="{ selected: voteChoice === 'nay' }"
                @click="castVote('nay')"
              >
                反对
              </button>
              <button
                class="vote-btn"
                :class="{ selected: voteChoice === 'abstain' }"
                @click="castVote('abstain')"
              >
                弃权
              </button>
            </div>
            <p v-if="voteChoice" class="text-green">已投票，等待其他议员…</p>
          </div>

          <!-- 承诺契约 -->
          <div v-if="isNegotiate" class="promise-panel card">
            <h4 class="serif text-gold">承诺契约</h4>
            <p class="text-muted">结构化承诺 · 可追踪 · 违约声誉暴跌</p>
            <div class="promise-form">
              <select v-model="promiseForm.toPlayerId" class="promise-select">
                <option value="">向谁承诺…</option>
                <option v-for="p in otherPlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <input
                v-model="promiseForm.fromAction"
                placeholder="我承诺（如：投赞成）"
                class="promise-input"
              />
              <input
                v-model="promiseForm.toAction"
                placeholder="你需（如：给我 5 资本）"
                class="promise-input"
              />
              <label class="promise-public">
                <input type="checkbox" v-model="promiseForm.isPublic" />
                <span class="text-muted">公开声明</span>
              </label>
              <el-button type="primary" size="small" @click="submitPromise">发起契约</el-button>
            </div>

            <div class="promise-list">
              <div v-for="p in gameStore.myPromises" :key="p.id" class="promise-item">
                <div class="promise-text">
                  <b class="text-gold">{{ gameStore.players.find((x) => x.id === p.fromPlayerId)?.name }}</b>
                  承诺 {{ p.fromAction }} ↔
                  <b class="text-gold">{{ gameStore.players.find((x) => x.id === p.toPlayerId)?.name }}</b>
                  需 {{ p.toAction }}
                </div>
                <span
                  class="promise-status"
                  :class="{
                    fulfilled: p.status === 'fulfilled',
                    broken: p.status === 'broken',
                    pending: p.status === 'pending',
                  }"
                >
                  {{ p.status === 'fulfilled' ? '已兑现' : p.status === 'broken' ? '已背叛' : '待执行' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 终局 ===== -->
    <div v-if="isFinished" class="finished-root">
      <div class="card-gold finished-card">
        <h2 class="serif">终局排名</h2>
        <div class="rankings">
          <div
            v-for="(p, i) in rankings"
            :key="p.id"
            class="rank-row"
            :class="{ me: p.id === gameStore.playerId }"
          >
            <span class="rank-num mono">#{{ i + 1 }}</span>
            <span class="rank-name serif">{{ p.name }}</span>
            <span class="rank-capital mono text-gold">+{{ p.capital }}</span>
            <span class="rank-rep mono text-muted">{{ Math.round(p.reputation * 100) }}%</span>
          </div>
        </div>
        <el-button type="primary" @click="$router.push('/')">返回大厅</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-root {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* —— 大厅 —— */
.lobby-root {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}
.lobby-card {
  width: 480px;
  text-align: center;
}
.lobby-players {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: var(--space-lg) 0;
}
.lobby-seat {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--slate-2);
  border-radius: var(--radius);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.lobby-seat.me {
  border: 1px solid var(--gold);
  background: var(--gold-soft);
}
.seat-name {
  flex: 1;
  text-align: left;
  color: var(--parchment);
}
.seat-status {
  font-size: var(--text-sm);
}
.ready-btn {
  width: 100%;
  font-family: var(--serif);
  margin-top: var(--space-md);
}
.lobby-hint {
  font-size: var(--text-xs);
  margin-top: var(--space-md);
}

/* —— 对战 —— */
.battle-root {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.battle-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: var(--slate);
  border-bottom: 1px solid var(--line);
}
.top-left .text-gold { font-size: var(--text-lg); }
.top-center {
  text-align: center;
}
.phase-label {
  font-size: var(--text-base);
  color: var(--gold);
}
.phase-timer {
  font-size: var(--text-xl);
  color: var(--gold);
  font-weight: 600;
  line-height: 1;
  margin-top: 2px;
}
.top-right {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.top-right .mono { font-size: var(--text-base); }

.battle-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: var(--space-md);
  padding: var(--space-md);
  overflow: hidden;
}
.battle-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.phaser-container {
  flex: 1;
  background: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  min-height: 400px;
}
.seats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-sm);
}
.seat-mini {
  background: var(--slate);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius);
  padding: var(--space-sm) var(--space-xs);
  text-align: center;
}
.seat-mini.me {
  border: 1px solid var(--gold);
  background: var(--gold-soft);
}
.seat-mini-name { font-size: var(--text-sm); color: var(--parchment); }
.seat-mini-identity { font-size: 9px; }
.seat-mini-capital { font-size: var(--text-base); }
.seat-mini-rep {
  height: 3px;
  background: var(--slate-2);
  border-radius: 999px;
  margin-top: 6px;
  overflow: hidden;
}
.rep-mini-fill {
  height: 100%;
  border-radius: 999px;
}

.battle-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow-y: auto;
}

/* 议案卡 */
.bill-card {
  padding: var(--space-md);
}
.bill-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bill-type-badge {
  font-size: var(--text-xs);
  padding: 2px 10px;
  border-radius: 999px;
  color: var(--gold);
  background: var(--gold-soft);
  border: 1px solid var(--gold-dim);
}
.bill-title { font-size: var(--text-base); color: var(--parchment); margin: var(--space-xs) 0; }
.bill-desc { font-size: var(--text-sm); }
.bill-allocations {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}
.alloc-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--parchment);
}
.alloc-row.me .alloc-name { color: var(--gold); font-weight: 600; }
.alloc-name { min-width: 50px; text-align: right; }
.alloc-bar-track {
  flex: 1;
  height: 20px;
  background: var(--slate-2);
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
}
.alloc-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-dim), var(--gold));
  border-radius: var(--radius);
  transition: width 0.5s ease;
}
.alloc-bar-pct {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-xs);
  color: var(--parchment);
}

/* 揭示阶段面板 */
.reveal-panel {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--gold-dim);
}
.reveal-scroll {
  position: relative;
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  background: radial-gradient(ellipse at center, rgba(201, 169, 97, 0.08) 0%, transparent 70%);
}
.reveal-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, rgba(201, 169, 97, 0.15), transparent 60%);
  animation: reveal-pulse 2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes reveal-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.reveal-title {
  font-size: var(--text-xl);
  position: relative;
}
.reveal-hint {
  font-size: var(--text-xs);
  position: relative;
}
.reveal-my-share {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  position: relative;
}
.reveal-share-num {
  font-size: var(--text-2xl);
}

/* 结算阶段面板 */
.settle-panel {
  padding: var(--space-md);
  text-align: center;
}
.settle-stamp {
  display: inline-block;
  font-family: var(--serif);
  font-size: var(--text-xl);
  font-weight: 700;
  padding: var(--space-xs) var(--space-lg);
  border-radius: var(--radius);
  border: 2px solid;
  letter-spacing: 0.1em;
  transform: rotate(-3deg);
}
.settle-stamp.passed {
  color: var(--emerald);
  border-color: var(--emerald);
  background: rgba(46, 125, 91, 0.1);
}
.settle-stamp.rejected {
  color: var(--crimson);
  border-color: var(--crimson);
  background: rgba(178, 58, 58, 0.1);
}
.settle-votes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  margin: var(--space-md) 0;
}
.vote-tally {
  padding: var(--space-sm);
  border-radius: var(--radius);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.vote-tally.yea { border-color: rgba(46, 125, 91, 0.3); background: rgba(46, 125, 91, 0.08); }
.vote-tally.nay { border-color: rgba(178, 58, 58, 0.3); background: rgba(178, 58, 58, 0.08); }
.vote-tally.abstain { border-color: rgba(255, 255, 255, 0.08); }
.tally-num {
  font-size: var(--text-xl);
  font-weight: 700;
  display: block;
}
.tally-label {
  font-size: var(--text-xs);
  color: var(--ash);
}
.vote-bar-track {
  display: flex;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--slate-2);
  margin-bottom: var(--space-md);
}
.vote-bar-yea { background: var(--emerald); }
.vote-bar-nay { background: var(--crimson); }
.vote-bar-abstain { background: var(--slate-3); }
.settle-changes {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.change-row {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  text-align: left;
}
.change-row.me {
  background: var(--gold-soft);
  border: 1px solid var(--gold-dim);
}
.change-name { color: var(--parchment); }
.change-cap { text-align: right; font-weight: 600; }
.change-rep { text-align: right; font-size: var(--text-xs); }

/* 谈判 */
.negotiate-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  min-height: 240px;
}
.chat-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: var(--space-sm);
}
.chat-tab {
  font-size: var(--text-xs);
  color: var(--ash);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.chat-tab.on {
  color: var(--gold);
  background: var(--gold-soft);
  border: 1px solid var(--gold-dim);
}
.chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 80px;
  overflow-y: auto;
}
.chat-msg {
  font-size: var(--text-xs);
  line-height: 1.5;
}
.msg-who { font-weight: 600; }
.msg-text { color: var(--parchment); }
.chat-input-row {
  display: flex;
  gap: var(--space-xs);
}
.chat-input :deep(.el-input__wrapper) {
  flex: 1;
}

/* 投票 */
.vote-panel {
  text-align: center;
}
.vote-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  margin: var(--space-md) 0;
}
.vote-btn {
  padding: var(--space-md);
  background: var(--slate-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  color: var(--parchment);
  font-family: var(--serif);
  font-size: var(--text-base);
  cursor: pointer;
  transition: all 0.15s;
}
.vote-btn:hover {
  border-color: var(--gold-dim);
}
.vote-btn.selected {
  background: var(--gold-soft);
  border-color: var(--gold);
  color: var(--gold);
}

/* 承诺 */
.promise-panel {
  padding: var(--space-md);
}
.promise-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: var(--space-sm) 0;
}
.promise-select,
.promise-input {
  background: var(--slate-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  padding: 8px 10px;
  color: var(--parchment);
  font-size: var(--text-sm);
}
.promise-public {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-xs);
}
.promise-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}
.promise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background: var(--slate-2);
  border-radius: var(--radius);
  font-size: var(--text-xs);
}
.promise-text { flex: 1; color: var(--parchment); }
.promise-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
}
.promise-status.fulfilled { color: var(--emerald); background: rgba(46, 125, 91, 0.15); }
.promise-status.broken { color: var(--crimson); background: rgba(178, 58, 58, 0.15); }
.promise-status.pending { color: var(--gold); background: var(--gold-soft); }

/* 终局 */
.finished-root {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.finished-card {
  width: 480px;
  text-align: center;
}
.rankings {
  margin: var(--space-lg) 0;
}
.rank-row {
  display: grid;
  grid-template-columns: 40px 1fr 80px 60px;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.rank-row.me {
  background: var(--gold-soft);
  border-radius: var(--radius);
}
.rank-num { color: var(--gold-dim); }
.rank-name { color: var(--parchment); text-align: left; }
</style>
