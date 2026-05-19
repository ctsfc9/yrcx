<script setup>
import { useRouter } from 'vue-router';
import TabBar from '../components/TabBar.vue';
const router = useRouter();
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="个人中心" />

    <div style="background: linear-gradient(135deg, #ff9000, #ff5c00); padding: 40px 20px; color: #fff; text-align: center;">
        <van-icon name="user-circle-o" size="64" color="#fff" />
        <div style="font-size: 20px; font-weight: bold; margin-top: 10px;">个人中心静态防御版</div>
        <div style="font-size: 14px; margin-top: 5px;">如果您能看到这个页面，说明白屏已修复！</div>
    </div>

    <div style="margin: 20px; text-align: center; color: #666;">
        如果此时正常显示，请告诉我，我再把之前的行程数据加载逻辑给您加回来。
    </div>

    <TabBar />
  </div>
</template>
