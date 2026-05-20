<template>
  <div style="margin: 20px;">
    <van-button v-if="localUser.id" block type="danger" @click="logout">退出登录</van-button>
  </div>
</template>

<script setup>
// ...原有引用...
const logout = () => {
  localStorage.removeItem('user_token');
  window.location.reload(); // 清除本地缓存后强制刷新
};
</script>
