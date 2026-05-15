import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  { 
    path: '/', 
    component: Home 
  },
  { 
    path: '/publish', 
    component: () => import('../views/Publish.vue') 
  },
  { 
    path: '/me', 
    component: () => import('../views/Me.vue') 
  },
  { 
    // 👉 修复：补回详情页路由！这样首页点击就能跳过去了
    path: '/detail', 
    component: () => import('../views/Detail.vue') 
  },
  { 
    // 👉 确保 admin 路由注册正确
    path: '/admin', 
    component: () => import('../views/Admin.vue') 
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
