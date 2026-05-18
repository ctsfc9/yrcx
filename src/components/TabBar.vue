<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const active = ref(route.path);

watch(() => route.path, (newPath) => {
  active.value = newPath;
});
</script>

<template>
  <van-tabbar v-model="active" route placeholder safe-area-inset-bottom :z-index="999" active-color="#ff6600">
    <van-tabbar-item replace to="/" icon="wap-home-o" name="/">首页大厅</van-tabbar-item>
    <van-tabbar-item replace to="/publish" icon="add-circle-o" name="/publish">发布行程</van-tabbar-item>
    <van-tabbar-item replace to="/user" icon="manager-o" name="/user">个人中心</van-tabbar-item>
  </van-tabbar>
</template>

<style scoped>
/* 增加顶部阴影，视觉上更清晰凸出 */
.van-tabbar {
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}
</style>
