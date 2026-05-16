<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './store'

const store = useAppStore()

onMounted(async () => {
  await store.loadConfig() 
  
  // 如果是后台管理，绝对不进行微信授权拦截
  if (window.location.pathname.startsWith('/admin')) {
    return;
  }

  // 接收微信重定向回来时附带的 code
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  // 如果 URL 里有 code，且本地没有 openid，说明刚从微信授权页回来
  if (code && !store.userProfile.openid) {
    try {
      const res = await fetch(`/api/get_openid?code=${code}`);
      const data = await res.json();
      
      if (data.openid) {
        // 将微信返回的真实头像、昵称、ID 保存到本地
        store.saveUser({ 
            ...store.userProfile, 
            id: data.id,
            openid: data.openid,
            nickname: data.nickname,
            avatar: data.avatar
        });
        
        // 清理地址栏里的 code，让页面看起来干净
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
