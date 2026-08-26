<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const user = useUserStore();

const showHeader = computed(() => route.meta.hideHeader !== true);
</script>

<template>
  <div class="app-root">
    <header v-if="showHeader" class="app-header">
      <div class="header-brand">
        <span class="serif header-title">议会博弈</span>
        <span class="text-muted header-sub">博弈论 · 谈判 · 声誉</span>
      </div>
      <div v-if="user.isLoggedIn" class="header-user">
        <span class="text-muted">{{ user.name }}</span>
        <span class="tag-gold">议员</span>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-xl);
  height: 60px;
  background: var(--slate);
  border-bottom: 1px solid var(--line);
}
.header-brand {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}
.header-title {
  font-size: var(--text-xl);
  letter-spacing: 0.04em;
}
.header-sub {
  font-size: var(--text-xs);
}
.header-user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
