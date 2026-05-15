<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const showRole = ref(false);

const goPublish = (type) => {
    showRole.value = false;
    router.push({ path: '/publish', query: { type } });
};
</script>

<template>
  <div class="custom-tabbar">
    <div class="tab-item" :class="{active: route.path === '/'}" @click="router.push('/')">
      <van-icon name="wap-home-o"/>首页
    </div>
    <div class="tab-item publish-wrap" @click="showRole = true">
      <div class="publish-float-btn">
        <van-icon name="plus" size="20" />
        <span style="font-size:13px;font-weight:900;">发布</span>
      </div>
    </div>
    <div class="tab-item" :class="{active: route.path === '/me'}" @click="router.push('/me')">
      <van-icon name="user-o"/>我的
    </div>
  </div>

  <van-popup v-model:show="showRole" position="bottom" style="height:40%;background:#f7f8fa;">
    <div style="padding:30px;display:flex;flex-direction:column;gap:20px;height:100%;justify-content:center;">
      <div class="role-select-card driver" @click="goPublish('driver')">
        <van-icon name="logistics" size="40" /><div><div style="font-size:20px;">我是车主</div></div>
      </div>
      <div class="role-select-card passenger" @click="goPublish('passenger')">
        <van-icon name="friends" size="40" /><div><div style="font-size:20px;">我是乘客</div></div>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.custom-tabbar { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #fff; display: flex; border-top: 1px solid #eee; z-index: 999; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; color: #666; cursor: pointer; }
.tab-item.active { color: #ff6600; font-weight: bold; }
.publish-wrap { position: relative; width: 70px; }
.publish-float-btn { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #ff6034, #ee0a24); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(238, 10, 36, 0.4); border: 3px solid #fff; }
.role-select-card { background: #fff; border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 20px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; }
.role-select-card.driver { color: #07c160; border: 2px solid #07c160; background: #f0f9eb; }
.role-select-card.passenger { color: #ff6600; border: 2px solid #ff6600; background: #fffbe8; }
</style>
