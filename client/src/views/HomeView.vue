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
    <!-- 议员档案卡 -->
    <div class="profile-card card-gold">
      <div class="profile-header">
        <h2 class="serif">{{ user.name || '未入会议员' }}</h2>
        <span class="tag-gold">资深议员</span>
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
    <div class="actions">
      <div class="action-card card main-action" @click="enterGame">
        <h3 class="serif">每日快速局</h3>
        <p class="text-muted">约 10 分钟 · 3 轮议案 · 单局博弈</p>
        <span class="text-gold action-go">进入议会 →</span>
      </div>
      <div class="action-card card" :class="{ disabled: !user.isLoggedIn }">
        <h3 class="serif">赛季对局</h3>
        <p class="text-muted">v1.1 即将开放</p>
        <span class="text-muted action-go">敬请期待</span>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-row">
      <div class="info-item card">
        <div class="info-label">当前赛季</div>
        <div class="info-value">第 1 赛季</div>
      </div>
      <div class="info-item card">
        <div class="info-label">今日议题</div>
        <div class="info-value">资源分配</div>
      </div>
      <div class="info-item card">
        <div class="info-label">在线议员</div>
        <div class="info-value mono">—</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xl) var(--space-xl);
  max-width: 640px;
  margin: 0 auto;
}
.profile-card {
  width: 100%;
  text-align: center;
}
.profile-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}
.profile-sub {
  font-size: var(--text-xs);
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
.info-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  width: 100%;
}
.info-item {
  padding: var(--space-md);
}
.info-label {
  font-size: var(--text-xs);
  color: var(--ash);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}
.info-value {
  font-size: var(--text-sm);
  color: var(--parchment);
}
</style>
