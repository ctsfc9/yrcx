<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const pwd = ref('');
const isAdmin = ref(false);
const isLoading = ref(false);

const config = ref({
    amap_key: '', wx_appid: '', top_fee: 0,
    tags_driver: '', tags_passenger: '', hot_cities: '',
    banners: '[]'
});

const bannerItems = ref([]); // 格式化后的轮播项

const checkLogin = () => {
    if (localStorage.getItem('admin_token') === 'true') {
        isAdmin.value = true;
        fetchConfig();
    }
};

const doLogin = () => {
    if (pwd.value === 'yb644300') {
        localStorage.setItem('admin_token', 'true');
        isAdmin.value = true;
        fetchConfig();
    } else { window.alert('管理员密码错误'); }
};

const fetchConfig = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = data;
            try {
                bannerItems.value = JSON.parse(data.banners || '[]');
            } catch(e) { bannerItems.value = []; }
        }
    } finally { isLoading.value = false; }
};

const addBanner = () => {
    bannerItems.value.push({ img: '', url: '' });
};

const removeBanner = (idx) => {
    bannerItems.value.splice(idx, 1);
};

const saveConfig = async () => {
    // 将轮播项转回 JSON 字符串
    config.value.banners = JSON.stringify(bannerItems.value);
    
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.value)
        });
        if (res.ok) window.alert('全局系统配置保存成功！');
    } catch (e) { window.alert('请求异常'); }
};

onMounted(checkLogin);
</script>

<template>
  <div style="padding: 20px; background: #f5f5f5; min-height: 100vh;">
    <div v-if="!isAdmin" style="max-width: 400px; margin: 100px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <input v-model="pwd" type="password" placeholder="请输入超级管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:20px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;" @keyup.enter="doLogin" />
        <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-weight:bold;">登录后台</button>
    </div>
    
    <div v-else style="max-width: 600px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px;">
        <h2 style="margin-bottom: 25px;">系统资产配置</h2>

        <div v-if="isLoading">加载中...</div>
        <div v-else>
            <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <span style="font-weight:bold; color:#07c160;">📸 首页轮播图管理</span>
                    <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:4px 10px; border-radius:4px;">+ 添加图片</button>
                </div>
                <div v-for="(item, idx) in bannerItems" :key="idx" style="background:#f9f9f9; padding:10px; border-radius:6px; margin-bottom:10px; position:relative;">
                    <label style="font-size:12px; color:#666;">图片链接:</label>
                    <input v-model="item.img" class="input-ctrl" placeholder="https://..." />
                    <label style="font-size:12px; color:#666;">跳转地址 (选填):</label>
                    <input v-model="item.url" class="input-ctrl" placeholder="/detail?id=1 或 https://..." />
                    <span @click="removeBanner(idx)" style="position:absolute; right:5px; top:5px; color:red; cursor:pointer;">×</span>
                </div>
            </div>

            <div class="form-item"><label>高德 Key</label><input v-model="config.amap_key" class="input-ctrl" /></div>
            <div class="form-item"><label>微信 AppID</label><input v-model="config.wx_appid" class="input-ctrl" /></div>
            <div class="form-item"><label>热门城市</label><textarea v-model="config.hot_cities" class="input-ctrl" style="height:60px;"></textarea></div>

            <button @click="saveConfig" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-weight:bold; margin-top:20px;">立即保存</button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.form-item { margin-bottom: 15px; }
.form-item label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.input-ctrl { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px; margin-bottom: 5px; }
</style>
