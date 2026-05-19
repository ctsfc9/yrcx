<template>
  <van-tabbar route safe-area-inset-bottom active-color="#07c160" :z-index="999" class="custom-tabbar">
    <van-tabbar-item replace to="/" icon="wap-home-o">首页大厅</van-tabbar-item>
    
    <van-tabbar-item replace to="/publish" class="publish-tab-item">
      <template #icon>
        <div class="publish-container">
          <span class="flank-text left">发</span>
          <div class="publish-btn-circle">
            <van-icon name="plus" />
          </div>
          <span class="flank-text right">布</span>
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
    /* 核心：确保文字可以排在加号下方两旁 */
    display: flex;
    justify-content: center;
}

/* 核心容器：左右文字夹着中间大圆球 */
.publish-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px; /* 间距 */
    /* 整体向上偏移，形成凸起 */
    transform: translateY(-8px);
    width: 100%;
}

/* 左右两侧的“发”和“布”字体样式 */
.flank-text {
    font-weight: bold;
    font-size: 16px; /* 字体偏大些 */
    color: #555;
    /* 让文字在加号下方两旁（通过 translateY 微调实现相对于圆球的下方位置） */
    transform: translateY(8px);
}

/* 绿色大圆球凸起样式 */
.publish-btn-circle {
    width: 46px;
    height: 46px;
    background: linear-gradient(135deg, #07c160, #06ad56);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 26px; /* 加号大小 */
    border: 4px solid #fff;
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
    pointer-events: auto; /* 保证圆球可以点击 */
}
</style>
