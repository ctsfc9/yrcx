import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/Home.vue'), meta: { title: '首页' } },
  { path: '/publish', name: 'Publish', component: () => import('../views/Publish.vue'), meta: { title: '发布行程' } },
  { path: '/me', name: 'Me', component: () => import('../views/Me.vue'), meta: { title: '个人中心' } },
  { path: '/ride/:id', name: 'Detail', component: () => import('../views/Detail.vue'), meta: { title: '行程详情' } }
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
