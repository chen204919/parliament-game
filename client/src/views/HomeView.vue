<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();

const profile = ref({
  reputation: 0.5,
  totalPromises: 0,
  fulfilledPromises: 0,
  capitalTotal: 0,
});

const repPercent = computed(() => Math.round(profile.value.reputation * 100));

onMounted(async () => {
  if (!user.isLoggedIn) return;
  try {
    const resp = await fetch('/api/profile', {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (resp.ok) profile.value = await resp.json();
  } catch {
    // 静默失败
  }
});

function enterGame() {
  router.push('/game');
}
</script>

<template>
  <div class="home-root">
    <!-- 氛围背景 -->
    <div class="bg-atmosphere" />

    <div class="home-content">
      <!-- 标语 -->
      <div class="tagline">
        <h1 class="serif tagline-title">议会博弈</h1>
        <p class="tagline-sub text-muted">在权力的圆桌旁 · 每一票都是一次博弈</p>
      </div>

      <!-- 议员档案卡 -->
      <div v-if="user.isLoggedIn" class="profile-card card-gold">
        <div class="profile-header">
          <h2 class="serif">{{ user.name }}</h2>
          <span class="tag-gold">议员</span>
        </div>
        <p class="text-muted profile-sub">入会档案 · 历史声誉记录</p>

        <div class="profile-stats">
          <div class="stat">
            <div class="stat-value mono">{{ repPercent }}%</div>
            <div class="stat-label">历史兑现率</div>
          </div>
          <div class="stat">
            <div class="stat-value mono text-gold">{{ profile.capitalTotal }}</div>
            <div class="stat-label">累计资本</div>
          </div>
          <div class="stat">
            <div class="stat-value mono">{{ profile.totalPromises }}</div>
            <div class="stat-label">承诺总数</div>
          </div>
        </div>

        <div class="rep-bar">
          <div class="rep-bar-label">
            <span>兑现率</span>
            <span class="text-gold">{{ repPercent }}%</span>
          </div>
          <div class="rep-bar-track">
            <div class="rep-bar-fill" :style="{ width: `${repPercent}%` }" />
          </div>
        </div>
      </div>

      <!-- 行动入口 -->
      <div v-if="user.isLoggedIn" class="actions">
        <div class="action-card card main-action" @click="enterGame">
          <h3 class="serif">每日快速局</h3>
          <p class="text-muted">约 10 分钟 · 3 轮议案 · 单局博弈</p>
          <span class="text-gold action-go">进入议会 →</span>
        </div>
        <div class="action-card card disabled">
          <h3 class="serif">赛季对局</h3>
          <p class="text-muted">v1.1 即将开放</p>
          <span class="text-muted action-go">敬请期待</span>
        </div>
      </div>

      <!-- 未登录提示 -->
      <div v-else class="login-prompt card-gold">
        <h3 class="serif">加入议会</h3>
        <p class="text-muted">登录后参与博弈 · 记录跨局声誉</p>
        <el-button type="primary" @click="router.push('/login')" class="prompt-btn">
          入会登录
        </el-button>
      </div>

      <!-- 规则说明 -->
      <div class="rules-section">
        <h3 class="serif rules-title">博弈流程</h3>
        <div class="rules-flow">
          <div class="rule-step">
            <div class="rule-num mono">01</div>
            <div class="rule-name serif">议案揭示</div>
            <p class="text-muted rule-desc">系统生成议案，各议员查看自己的资源分配方案</p>
          </div>
          <div class="rule-connector" />
          <div class="rule-step">
            <div class="rule-num mono">02</div>
            <div class="rule-name serif">谈判阶段</div>
            <p class="text-muted rule-desc">公聊私聊、发起承诺契约、结盟或背叛</p>
          </div>
          <div class="rule-connector" />
          <div class="rule-step">
            <div class="rule-num mono">03</div>
            <div class="rule-name serif">盲投表决</div>
            <p class="text-muted rule-desc">同时投票 · 过半数通过 · 选择不公开</p>
          </div>
          <div class="rule-connector" />
          <div class="rule-step">
            <div class="rule-num mono">04</div>
            <div class="rule-name serif">结算清算</div>
            <p class="text-muted rule-desc">资本分配 · 承诺兑现或违约 · 声誉变动</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-root {
  flex: 1;
  position: relative;
  overflow-y: auto;
}
.bg-atmosphere {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 600px 400px at 30% 20%, rgba(201, 169, 97, 0.06), transparent),
    radial-gradient(ellipse 500px 300px at 70% 80%, rgba(178, 58, 58, 0.04), transparent),
    var(--ink);
  pointer-events: none;
}
.home-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl) var(--space-xl) var(--space-2xl, 64px);
  max-width: 680px;
  margin: 0 auto;
}

/* 标语 */
.tagline {
  text-align: center;
  margin-bottom: var(--space-sm);
}
.tagline-title {
  font-size: var(--text-2xl);
  letter-spacing: 0.06em;
}
.tagline-sub {
  font-size: var(--text-sm);
  margin-top: var(--space-xs);
}

/* 档案卡 */
.profile-card {
  width: 100%;
}
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.profile-sub {
  font-size: var(--text-xs);
  margin-top: var(--space-xs);
}
.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin: var(--space-lg) 0;
}
.stat-value {
  font-size: var(--text-xl);
  color: var(--parchment);
  font-weight: 600;
}
.stat-label {
  font-size: var(--text-xs);
  color: var(--ash);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 2px;
}
.rep-bar {
  margin-top: var(--space-md);
}
.rep-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--ash);
  margin-bottom: var(--space-xs);
}
.rep-bar-track {
  height: 6px;
  background: var(--slate-2);
  border-radius: 999px;
  overflow: hidden;
}
.rep-bar-fill {
  height: 100%;
  background: var(--gold);
  border-radius: 999px;
  transition: width 0.6s ease;
}

/* 行动入口 */
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  width: 100%;
}
.action-card {
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.action-card:hover {
  transform: translateY(-2px);
}
.action-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.main-action {
  border: 1px solid var(--gold);
  background: var(--gold-soft);
}
.action-go {
  font-size: var(--text-sm);
  font-weight: 600;
  display: block;
  margin-top: var(--space-sm);
}

/* 未登录提示 */
.login-prompt {
  width: 100%;
  text-align: center;
}
.prompt-btn {
  width: 100%;
  margin-top: var(--space-md);
  font-family: var(--serif);
}

/* 规则说明 */
.rules-section {
  width: 100%;
  margin-top: var(--space-md);
}
.rules-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-md);
  text-align: center;
}
.rules-flow {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.rule-step {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: var(--space-md);
  align-items: start;
  padding: var(--space-md);
  background: var(--slate);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
}
.rule-num {
  font-size: var(--text-lg);
  color: var(--gold-dim);
  font-weight: 700;
}
.rule-name {
  font-size: var(--text-base);
  color: var(--gold);
}
.rule-desc {
  font-size: var(--text-sm);
  margin-top: 4px;
}
.rule-connector {
  width: 2px;
  height: 12px;
  background: var(--gold-dim);
  margin: 0 auto;
  opacity: 0.4;
}
</style>
