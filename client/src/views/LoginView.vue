<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();

const form = reactive({ name: '', password: '' });
const isLogin = ref(true);
const loading = ref(false);
const errorMsg = ref('');

async function submit() {
  if (!form.name || !form.password) {
    errorMsg.value = '请填写用户名和密码';
    return;
  }
  loading.value = true;
  errorMsg.value = '';

  try {
    const url = isLogin.value ? '/api/auth/login' : '/api/auth/register';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await resp.json();
    if (!resp.ok) {
      errorMsg.value = data.error ?? '请求失败';
      return;
    }
    await user.login(data.token, data.user.name, data.user.id);
    router.push('/');
  } catch {
    errorMsg.value = '网络错误';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-root">
    <div class="login-card card-gold">
      <h2 class="serif">{{ isLogin ? '入会' : '注册' }}</h2>
      <p class="text-muted login-sub">议员档案 · 跨局声誉起始</p>

      <el-form @submit.prevent="submit" class="login-form">
        <el-input v-model="form.name" placeholder="议员名" class="login-input" />
        <el-input v-model="form.password" type="password" placeholder="密令" show-password class="login-input" />
        <p v-if="errorMsg" class="text-red login-err">{{ errorMsg }}</p>
        <el-button type="primary" :loading="loading" @click="submit" class="login-btn">
          {{ isLogin ? '进入议会' : '提交注册' }}
        </el-button>
      </el-form>

      <p class="login-toggle" @click="isLogin = !isLogin">
        {{ isLogin ? '尚未入会？注册新议员' : '已有档案？去登录' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-root {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ink);
}
.login-card {
  width: 380px;
  text-align: center;
}
.login-sub {
  font-size: var(--text-xs);
  margin-top: var(--space-xs);
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
.login-input :deep(.el-input__wrapper) {
  background: var(--slate-2);
}
.login-btn {
  width: 100%;
  font-family: var(--serif);
}
.login-toggle {
  margin-top: var(--space-md);
  font-size: var(--text-sm);
  color: var(--ash);
  cursor: pointer;
}
.login-toggle:hover {
  color: var(--gold);
}
.login-err {
  font-size: var(--text-sm);
}
</style>
