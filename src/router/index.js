import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/post',
    name: 'Post',
    component: () => import('../views/Post.vue'),
  },
  {
    path: '/my',
    name: 'MyRides',
    component: () => import('../views/MyRides.vue'),
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('../views/Detail.vue'),
    meta: { hideTabbar: true }
  }
];

const router = createRouter({
  // 使用 Hash 模式确保在微信和静态托管中跳转精准
  history: createWebHashHistory(),
  routes,
});

export default router;
