<template>
  <van-tabbar route safe-area-inset-bottom active-color="#07c160" :z-index="999" class="custom-tabbar">
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    
    <van-tabbar-item replace to="/publish" class="publish-tab-item">
      <template #icon>
        <div class="publish-btn-circle">
          <van-icon name="plus" size="22" style="font-weight: bold; margin-bottom: 2px;" />
          <span class="btn-text">发布</span>
        </div>
      </template>
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

.publish-tab-item {
    position: relative;
    display: flex;
    justify-content: center;
}

/* 绿色大圆球：放大尺寸，使用 Flex 垂直排列 */
.publish-btn-circle {
    width: 58px;
    height: 58px;
    background: linear-gradient(135deg, #07c160, #06ad56);
    border-radius: 50%;
    display: flex;
    flex-direction: column; /* 上下排列 */
    align-items: center;
    justify-content: center;
    color: white;
    /* 向上凸起 */
    transform: translateY(-16px);
    border: 4px solid #fff;
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
    pointer-events: auto;
}

/* 圆圈内的“发布”文字 */
.btn-text {
    font-size: 13px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 1px;
}
</style>
