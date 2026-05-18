<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './store'

const store = useAppStore()

onMounted(async () => {
  await store.loadConfig() 
  
  if (window.location.pathname.startsWith('/admin')) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  // 👉 核心修复：只处理带 code 回来的情况，【绝不再强制重定向踢人】，实现网页秒开！
  if (code && !store.userProfile.openid) {
    try {
      const res = await fetch(`/api/get_openid?code=${code}`);
      const data = await res.json();
      
      if (data.openid) {
        store.saveUser({ 
            ...store.userProfile, 
            id: data.id,
            openid: data.openid,
            nickname: data.nickname,
            avatar: data.avatar
        });
        window.history.replaceState({}, '', window.location.origin + window.location.pathname);
      }
    } catch (e) {
      console.error('获取微信信息失败', e);
    }
  }
})
</script>

<template>
  <router-view />
</template>
