import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/detail', component: () => import('../views/Detail.vue') },
  { path: '/publish', component: () => import('../views/Publish.vue') },
  { path: '/me', component: () => import('../views/Me.vue') },
  { path: '/admin', component: () => import('../views/Admin.vue') }
]

export default createRouter({ history: createWebHistory(), routes })
