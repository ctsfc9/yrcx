import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/publish', component: () => import('../views/Publish.vue') },
  { path: '/me', component: () => import('../views/Me.vue') },
  { path: '/admin', component: () => import('../views/Admin.vue') } // 管理后台路由
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
