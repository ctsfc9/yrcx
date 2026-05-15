import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    userProfile: JSON.parse(localStorage.getItem('yrcx_user')) || { id: '', nickname: '', phone: '', avatar: '', openid: '' },
    sysConfig: { wx_appid: '', amap_key: '' },
    editPayload: null 
  }),
  actions: {
    saveUser(info) {
      this.userProfile = info
      localStorage.setItem('yrcx_user', JSON.stringify(info))
    },
    setEditPayload(payload) { this.editPayload = payload },
    async loadConfig() {
      try {
        const res = await fetch('/api/config')
        this.sysConfig = await res.json()
      } catch (e) {}
    }
  }
})
