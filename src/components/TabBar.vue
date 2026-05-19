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
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    <van-tabbar-item replace to="/publish" icon="add-circle-o">发布行程</van-tabbar-item>
    <van-tabbar-item replace to="/user" icon="manager-o">个人中心</van-tabbar-item>
  </van-tabbar>
</template>

<style scoped>
.van-tabbar { box-shadow: 0 -2px 10px rgba(0,0,0,0.05); }
</style>
