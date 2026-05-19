<template>
  <van-tabbar route safe-area-inset-bottom active-color="#07c160" :z-index="999" class="custom-tabbar">
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    
    <van-tabbar-item replace to="/publish" class="publish-tab">
      <template #icon>
        <div class="publish-btn-circle">
          <van-icon name="plus" />
        </div>
      </template>
      <span style="font-weight: bold; margin-top: 5px;">发布行程</span>
    </van-tabbar-item>
    
    <van-tabbar-item replace to="/user" icon="manager-o">个人中心</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
</script>

<style scoped>
.custom-tabbar {
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}

.publish-tab {
    position: relative;
}

/* 核心：悬浮大圆球样式 */
.publish-btn-circle {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #07c160, #06ad56);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 28px;
    /* 向上偏移，形成凸起效果 */
    transform: translateY(-16px);
    border: 4px solid #fff;
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
}
</style>
