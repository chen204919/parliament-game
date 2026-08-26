import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { RoomState } from '@parliament/shared';
import { connectSocket, getSocket } from '@/socket/client';

// ============================================================
// 用户状态 — 登录/档案
// ============================================================

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const name = ref<string>(localStorage.getItem('userName') ?? '');
  const userId = ref<string>(localStorage.getItem('userId') ?? '');

  const isLoggedIn = computed(() => !!token.value);

  async function login(t: string, n: string, id: string) {
    token.value = t;
    name.value = n;
    userId.value = id;
    localStorage.setItem('token', t);
    localStorage.setItem('userName', n);
    localStorage.setItem('userId', id);
  }

  async function logout() {
    token.value = null;
    name.value = '';
    userId.value = '';
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
  }

  return { token, name, userId, isLoggedIn, login, logout };
});
