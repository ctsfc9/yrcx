<script setup>
</script>

<template>
  <van-tabbar route safe-area-inset-bottom active-color="#ff6600" :z-index="999">
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    <van-tabbar-item replace to="/publish" icon="add-circle-o">发布行程</van-tabbar-item>
    <van-tabbar-item replace to="/user" icon="manager-o">个人中心</van-tabbar-item>
  </van-tabbar>
</template>

<style scoped>
.van-tabbar {
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}
</style>
