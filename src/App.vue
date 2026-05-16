<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './store'

const store = useAppStore()

onMounted(async () => {
  await store.loadConfig() // 拉取系统配置
  
  // 👉 核心修复：如果当前访问的是后台管理地址，直接跳出，绝不拉起微信授权！
  if (window.location.pathname.startsWith('/admin')) {
    return;
  }

  // 以下是普通用户的微信静默授权逻辑
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!store.userProfile.openid && store.sysConfig.wx_appid) {
    if (!code) {
      // 没 openid 也没 code，去微信要
      const redirectUri = encodeURIComponent(window.location.href);
      window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${store.sysConfig.wx_appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect`;
    } else {
      // 从微信跳回来了，用 code 换 openid
      try {
        const res = await fetch(`/api/get_openid?code=${code}`);
        const data = await res.json();
        if (data.openid) {
          store.saveUser({ ...store.userProfile, openid: data.openid });
          window.history.replaceState({}, '', window.location.origin + window.location.pathname);
        }
      } catch (e) {}
    }
  }
})
</script>

<template>
  <router-view />
</template>
