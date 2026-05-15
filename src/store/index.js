import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    // 从本地缓存读取用户信息，保持登录状态
    userProfile: JSON.parse(localStorage.getItem('yrcx_user')) || { id: '', nickname: '', phone: '', avatar: '' },
    sysConfig: { notice: '', tags_driver: '', tags_passenger: '', amap_key: '您的真实高德Key' },
    editPayload: null 
  }),
  actions: {
    saveUser(info) {
      this.userProfile = info
      localStorage.setItem('yrcx_user', JSON.stringify(info))
    },
    setEditPayload(payload) {
      this.editPayload = payload
    },
    async loadConfig() {
      try {
        const res = await fetch('/api/config')
        this.sysConfig = await res.json()
      } catch (e) {}
    }
  }
})
