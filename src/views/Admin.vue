<script setup>
import { ref, onMounted, reactive } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';

// 菜单状态
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
  amap_key: '',
  wx_appid: '',
  wx_appsecret: ''
});

const submitLoading = ref(false);

onMounted(async () => {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      Object.assign(config, data);
    }
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
    <!-- 侧边栏 -->
    <div class="sidebar">
      <div class="logo">宜人出行后台</div>
      <ul class="menu-list">
        <li :class="{ active: activeMenu === 'home' }" @click="activeMenu = 'home'"><van-icon name="wap-home-o" /> 首页控制台</li>
        
        <li :class="{ active: activeMenu === 'config' }" @click="activeMenu = 'config'"><van-icon name="setting-o" /> 平台参数设置</li>
        <ul class="sub-menu" v-if="activeMenu === 'config'">
          <li :class="{ active: activeSubMenu === 'basic' }" @click="activeSubMenu = 'basic'">基本设置</li>
          <li :class="{ active: activeSubMenu === 'wx' }" @click="activeSubMenu = 'wx'">微信公众号</li>
          <li :class="{ active: activeSubMenu === 'fee' }" @click="activeSubMenu = 'fee'">收费标准</li>
        </ul>

        <li :class="{ active: activeMenu === 'users' }" @click="activeMenu = 'users'"><van-icon name="friends-o" /> 用户管理</li>
        <li :class="{ active: activeMenu === 'rides' }" @click="activeMenu = 'rides'"><van-icon name="logistics" /> 拼车行程管理</li>
        <li :class="{ active: activeMenu === 'orders' }" @click="activeMenu = 'orders'"><van-icon name="orders-o" /> 财务流水订单</li>
      </ul>
    </div>

    <!-- 工作区 -->
    <div class="main-content">
      <div class="header-bar">
        <span class="title">系统设置 > {{ activeSubMenu === 'basic' ? '基本参数' : activeSubMenu === 'wx' ? '微信配置' : '收费标准' }}</span>
        <div class="user">管理员 <van-icon name="arrow-down" /></div>
      </div>

      <div class="content-body">
        <div class="card" v-if="activeMenu === 'config'">
          <!-- 基本设置 -->
          <div v-if="activeSubMenu === 'basic'">
            <div class="card-title">基本运行参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.notice" label="首页公告" type="textarea" rows="2" autosize placeholder="滚动公告文字" />
              <van-field v-model="config.amap_key" label="高德地图Key" placeholder="Web端JS API Key" />
              <van-field v-model="config.contact_qr" label="客服二维码" placeholder="图片URL" />
              <van-field v-model="config.tags_driver" label="车主标签" placeholder="英文逗号隔开" />
              <van-field v-model="config.tags_passenger" label="乘客标签" placeholder="英文逗号隔开" />
            </van-cell-group>
          </div>

          <!-- 微信设置 -->
          <div v-if="activeSubMenu === 'wx'">
            <div class="card-title">微信开放平台参数</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.wx_appid" label="微信AppID" placeholder="wx开头的ID" />
              <van-field v-model="config.wx_appsecret" label="微信AppSecret" type="password" placeholder="32位Secret" />
            </van-cell-group>
            <p class="tips">温馨提示：修改微信参数前，请确保域名已在公众平台加入白名单。</p>
          </div>

          <!-- 收费标准 -->
          <div v-if="activeSubMenu === 'fee'">
            <div class="card-title">平台商业化定价</div>
            <van-cell-group inset :border="false">
              <van-field v-model="config.publish_fee" label="发布单价" type="number" placeholder="单位：元" />
              <van-field v-model="config.top_fee" label="置顶单价" type="number" placeholder="单位：元" />
            </van-cell-group>
          </div>

          <div class="btn-wrap">
            <van-button block type="primary" color="#3b5998" :loading="submitLoading" @click="saveConfig">保存设置</van-button>
          </div>
        </div>
        <div class="card empty" v-else>
            <van-empty description="该模块数据正在接入中" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-layout { display: flex; height: 100vh; background-color: #f4f6f8; font-family: sans-serif; }
.sidebar { width: 240px; background-color: #263238; color: #cfd8dc; flex-shrink: 0; }
.logo { height: 64px; line-height: 64px; text-align: center; font-size: 20px; font-weight: bold; color: #fff; background-color: #1a2327; }
.menu-list { list-style: none; padding: 10px 0; margin: 0; }
.menu-list li { padding: 14px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 15px; }
.menu-list li:hover { background-color: #37474f; color: #fff; }
.menu-list li.active { background-color: #0091ea; color: #fff; }
.sub-menu { list-style: none; padding: 0; background-color: #1a2327; }
.sub-menu li { padding: 12px 20px 12px 52px; font-size: 14px; color: #b0bec5; }
.sub-menu li.active { color: #fff; font-weight: bold; }

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header-bar { height: 64px; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.header-bar .title { font-size: 14px; color: #666; }
.header-bar .user { font-size: 14px; cursor: pointer; }

.content-body { padding: 24px; overflow-y: auto; flex: 1; }
.card { background: #fff; border-radius: 4px; padding: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); max-width: 900px; }
.card-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 24px; border-left: 4px solid #0091ea; padding-left: 12px; }
.btn-wrap { margin-top: 40px; }
.tips { font-size: 12px; color: #999; margin-top: 15px; padding-left: 16px; }

:deep(.van-cell) { background-color: #fafafa; margin-bottom: 12px; border: 1px solid #eee; border-radius: 4px; }
</style>
