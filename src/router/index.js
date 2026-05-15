import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/Home.vue'), meta: { title: '首页' } },
  { path: '/publish', name: 'Publish', component: () => import('../views/Publish.vue'), meta: { title: '发布行程' } },
  { path: '/me', name: 'Me', component: () => import('../views/Me.vue'), meta: { title: '个人中心' } },
  // ★ 真正的直达路由，天然支持分享和单独打开
  { path: '/ride/:id', name: 'Detail', component: () => import('../views/Detail.vue'), meta: { title: '行程详情' } },
  { path: '/admin', name: 'Admin', component: () => import('../views/Admin.vue'), meta: { title: '管理后台' } },
  // 微信授权中转页
  { path: '/auth', name: 'Auth', component: () => import('../views/Auth.vue'), meta: { title: '微信授权登录' } }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.meta.title) document.title = `${to.meta.title} - 宜人出行`;
  next();
});

export default router;
