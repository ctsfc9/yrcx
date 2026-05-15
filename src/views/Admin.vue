<script setup>
import { ref, onMounted, reactive } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';

// 左侧菜单激活状态
const activeMenu = ref('config');
const activeSubMenu = ref('basic');

// 系统配置数据
const config = reactive({
  notice: '',
  tags_driver: '',
  tags_passenger: '',
  contact_qr: '',
  top_fee: 0,
  publish_fee: 0,
  amap_key: '' // 新增高德Key
});

const submitLoading = ref(false);

onMounted(async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) Object.assign(config, await res.json());
  } catch(e) {
    showFailToast('获取配置失败');
  }
});

const saveConfig = async () => {
  submitLoading.value = true;
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) showSuccessToast('配置已更新');
    else showFailToast('保存失败');
  } catch (e) {
    showFailToast('网络异常');
  } finally {
    submitLoading.value = false;
  }
};
</script>

<template>
  <div class="admin-layout">
    <div class="sidebar">
      <div class="logo">宜人出行后台</div>
      <ul class="menu-list">
        <li :class="{ active: activeMenu === 'home' }" @click="activeMenu = 'home'"><van-icon name="wap-home-o" /> 首页</li>
        
        <li :class="{ active: activeMenu === 'config' }" @click="activeMenu = 'config'"><van-icon name="setting-o" /> 平台参数设置</li>
        <ul class="sub-menu" v-if="activeMenu === 'config'">
          <li :class="{ active: activeSubMenu === 'basic' }" @click="activeSubMenu = 'basic'">基本设置</li>
          <li :class="{ active: activeSubMenu === 'wx' }" @click="activeSubMenu = 'wx'">公众号设置</li>
          <li :class="{ active: activeSubMenu === 'pwd' }" @click="activeSubMenu = 'pwd'">重置账号密码</li>
          <li :class="{ active: activeSubMenu === 'share' }" @click="activeSubMenu = 'share'">推广分销设置</li>
        </ul>

        <li :class="{ active: activeMenu === 'banner' }" @click="activeMenu = 'banner'"><van-icon name="photo-o" /> 首页轮播图</li>
        <li :class="{ active: activeMenu === 'users' }" @click="activeMenu = 'users'"><van-icon name="friends-o" /> 用户管理</li>
        <li :class="{ active: activeMenu === 'rides' }" @click="activeMenu = 'rides'"><van-icon name="logistics" /> 拼车管理</li>
        <li :class="{ active: activeMenu === 'finance' }" @click="activeMenu = 'finance'"><van-icon name="gold-coin-o" /> 收入流水管理</li>
        <li :class="{ active: activeMenu === 'affiliate' }" @click="activeMenu = 'affiliate'"><van-icon name="cluster-o" /> 分销管理</li>
        <li :class="{ active: activeMenu === 'orders' }" @click="activeMenu = 'orders'"><van-icon name="orders-o" /> 订单管理</li>
      </ul>
    </div>

    <div class="main-content">
      <div class="header-bar">
        <span style="font-weight: bold; font-size: 18px;">{{ activeMenu === 'config' ? '平台参数设置' : '开发中...' }}</span>
        <van-button size="small" type="danger" plain>退出登录</van-button>
      </div>

      <div class="content-body" v-if="activeMenu === 'config' && activeSubMenu === 'basic'">
        <div class="card">
          <div class="card-title">基础与 API 配置</div>
          <van-cell-group inset :border="false">
            <van-field v-model="config.notice" label="首页公告" type="textarea" rows="2" autosize placeholder="输入首页滚屏公告" />
            <van-field v-model="config.contact_qr" label="客服二维码" placeholder="填入图片URL地址" />
            <van-field v-model="config.amap_key" label="高德地图Key" placeholder="Web端(JS API)的安全密钥或Key" />
          </van-cell-group>

          <div class="card-title" style="margin-top: 20px;">业务与标签配置</div>
          <van-cell-group inset :border="false">
            <van-field v-model="config.tags_driver" label="车主标签" placeholder="例如：有空位,车找人" />
            <van-field v-model="config.tags_passenger" label="乘客标签" placeholder="例如：带行李,人找车" />
          </van-cell-group>

          <div class="card-title" style="margin-top: 20px;">收费与商业化策略</div>
          <van-cell-group inset :border="false">
            <van-field v-model="config.publish_fee" label="发布收费(元)" type="number" placeholder="0为免费" />
            <van-field v-model="config.top_fee" label="置顶收费(元)" type="number" placeholder="0为免费" />
          </van-cell-group>

          <div style="margin-top: 30px; padding: 0 16px;">
            <van-button block type="primary" color="#3b5998" :loading="submitLoading" @click="saveConfig">
              保存修改
            </van-button>
          </div>
        </div>
      </div>
      
      <div class="content-body" v-else>
        <div class="card" style="text-align: center; padding: 100px; color: #999;">
          模块正在加紧开发中，敬请期待...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PC端后台经典深色侧边栏布局 */
.admin-layout {
  display: flex;
  height: 100vh;
  background-color: #f0f2f5;
}
.sidebar {
  width: 240px;
  background-color: #2c3542;
  color: #aeb9c2;
  overflow-y: auto;
  flex-shrink: 0;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  background-color: #1e2630;
  letter-spacing: 2px;
}
.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.menu-list li {
  padding: 15px 20px;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 10px;
}
.menu-list li:hover, .menu-list li.active {
  background-color: #3b5998;
  color: #fff;
}
.sub-menu {
  list-style: none;
  padding: 0;
  background-color: #1e2630;
}
.sub-menu li {
  padding: 12px 20px 12px 50px;
  font-size: 14px;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.header-bar {
  height: 60px;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
  z-index: 10;
}
.content-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.card-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  padding-left: 10px;
  border-left: 4px solid #3b5998;
}
:deep(.van-cell) {
  background-color: #f9fafc;
  margin-bottom: 10px;
  border-radius: 4px;
}
</style>
