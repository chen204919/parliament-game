import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/game/:roomId?',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const user = useUserStore();
  if (to.meta.requiresAuth && !user.isLoggedIn) {
    next({ name: 'login' });
  } else {
    next();
  }
});

export default router;
