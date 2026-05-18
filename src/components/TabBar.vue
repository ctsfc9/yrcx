<script setup>
import { ref } from 'vue';
</script>

<template>
  <van-tabbar route fixed safe-area-inset-bottom style="height: 65px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05);">
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    
    <van-tabbar-item replace to="/publish">
      <template #icon>
        <div style="background: #ff6600; color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(255,102,0,0.3); margin-top: -15px;">
          <van-icon name="plus" size="24" />
        </div>
      </template>
      发布行程
    </van-tabbar-item>
    
    <van-tabbar-item replace to="/me" icon="user-o">个人中心</van-tabbar-item>
  </van-tabbar>
</template>

<style scoped>
/* 深度修改 Vant 组件的默认字号和图标大小 */
:deep(.van-tabbar-item__icon) {
  font-size: 26px; /* 放大图标 */
  margin-bottom: 6px;
}
:deep(.van-tabbar-item__text) {
  font-size: 13px; /* 放大文字 */
}
:deep(.van-tabbar-item--active) {
  color: #ff6600 !important;
  font-weight: bold;
}
</style>
