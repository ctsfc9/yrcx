<script setup>
import { ref, onMounted } from 'vue';
import { useAppStore } from '../store';
const store = useAppStore();
</script>

<template>
  <div class="user-page">
    <div class="header">个人中心</div>
    <div v-if="store.userProfile?.id" class="info">
        欢迎, {{ store.userProfile.nickname }}
    </div>
    <div v-else class="login-tip" @click="window.location.reload()">未登录，点击刷新</div>
  </div>
</template>

<style scoped>
.user-page { padding: 20px; }
.header { font-size: 20px; font-weight: bold; }
.info { margin-top: 20px; color: #333; }
.login-tip { margin-top: 20px; color: #999; }
</style>
