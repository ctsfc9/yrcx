import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/detail', component: () => import('../views/Detail.vue') },
    { path: '/publish', component: () => import('../views/Publish.vue') },
    { path: '/me', component: () => import('../views/Me.vue') },
    { path: '/admin', component: () => import('../views/Admin.vue') }
  ]
})

// 增加全局路由守卫：检测登录态
router.beforeEach((to, from, next) => {
  const isAuth = localStorage.getItem('user_profile');
  // 如果没登录且不在首页，强制跳转微信授权
  if (!isAuth && to.path !== '/' && to.path !== '/admin') {
     const appId = 'wx90223bd25485040a';
     window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(window.location.origin + '/me')}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
  } else {
     next();
  }
});

export default router
