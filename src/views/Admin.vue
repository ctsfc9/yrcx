<template>
  <div style="padding: 20px; background: #f5f5f5; min-height: 100vh; font-family: sans-serif;">
    <div v-if="!isAdmin" style="max-width: 400px; margin: 100px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 20px;">宜人出行 管理后台</div>
        <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:20px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
        <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">验证并登录</button>
    </div>
    
    <div v-else style="max-width: 600px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom:1px solid #eee; padding-bottom:15px;">
            <span style="font-size: 18px; font-weight: bold; color: #333;">系统高级配置</span>
            <button @click="logOut" style="background:none; border:1px solid #ff4d4f; color:#ff4d4f; padding:4px 12px; border-radius:4px; cursor:pointer;">退出登录</button>
        </div>

        <div v-if="isLoading" style="text-align: center; padding: 30px; color: #999;">配置数据加载中...</div>
        
        <div v-else>
            <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                    <span style="font-weight:bold; color:#07c160;">📸 首页多张轮播图控制中心</span>
                    <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">+ 添加新图</button>
                </div>
                <div v-for="(item, idx) in bannerItems" :key="idx" style="background:#f9f9f9; padding:12px; border-radius:6px; margin-bottom:10px; position:relative; border:1px solid #eee;">
                    <label style="font-size:12px; color:#666; font-weight:bold;">图片链接 (URL):</label>
                    <input v-model="item.img" class="input-ctrl" placeholder="https://..." />
                    <label style="font-size:12px; color:#666; font-weight:bold; margin-top:5px; display:block;">点击跳转目标地址 (选填):</label>
                    <input v-model="item.url" class="input-ctrl" placeholder="/detail?id=1 或 外部URL" />
                    <span @click="removeBanner(idx)" style="position:absolute; right:10px; top:10px; color:#ff4d4f; cursor:pointer; font-weight:bold; font-size:16px;">×</span>
                </div>
            </div>

            <div class="form-item"><label>高德地图 Web端 Key</label><input v-model="config.amap_key" class="input-ctrl" /></div>
            <div class="form-item"><label>微信公众号/小程序 AppID</label><input v-model="config.wx_appid" class="input-ctrl" /></div>
            <div class="form-item"><label>行程置顶服务费用 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
            <div class="form-item"><label>车主常用快捷标签 (逗号分隔)</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
            <div class="form-item"><label>乘客常用快捷标签 (逗号分隔)</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>
            
            <div class="form-item">
                <label style="color: #ff6600;">🏙️ 地图发布选位预设热门城市</label>
                <textarea v-model="config.hot_cities" rows="3" class="input-ctrl" style="height:70px; resize:none;" placeholder="例如: 上海市,杭州市,宜宾市"></textarea>
            </div>

            <button @click="saveConfig" style="width: 100%; height: 46px; background: #07c160; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; margin-top: 25px; cursor:pointer; box-shadow: 0 4px 10px rgba(7,193,96,0.2);">
                保存并同步配置
            </button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showSuccessToast, showFailToast } from 'vant';
import { useAppStore } from '../store';

const store = useAppStore();
const router = useRouter();
const pwd = ref('');
const isAdmin = ref(false);
const isLoading = ref(false);

const config = ref({
    amap_key: '', wx_appid: '', top_fee: 0,
    tags_driver: '', tags_passenger: '', hot_cities: ''
});
const bannerItems = ref([]);

const checkLogin = () => {
    if (localStorage.getItem('admin_token') === 'true') {
        isAdmin.value = true;
        fetchConfig();
    }
};

const doLogin = () => {
    // 恢复严格比对，并增加弹窗反馈
    if (pwd.value === 'yb644300') {
        localStorage.setItem('admin_token', 'true');
        isAdmin.value = true;
        showSuccessToast('登录成功');
        fetchConfig();
    } else {
        showFailToast('管理员密码错误');
    }
};

const fetchConfig = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = { ...data };
            try {
                bannerItems.value = JSON.parse(data.banners || '[]');
            } catch(e) { bannerItems.value = []; }
        }
    } finally {
        isLoading.value = false;
    }
};

const addBanner = () => { bannerItems.value.push({ img: '', url: '' }); };
const removeBanner = (idx) => { bannerItems.value.splice(idx, 1); };

const saveConfig = async () => {
    config.value.banners = JSON.stringify(bannerItems.value);
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.value)
        });
        if (res.ok) {
            showSuccessToast('配置保存成功');
            if (store && typeof store.loadConfig === 'function') store.loadConfig();
        } else {
            showFailToast('保存失败');
        }
    } catch (e) {
        showFailToast('网络请求异常');
    }
};

const logOut = () => {
    localStorage.removeItem('admin_token');
    isAdmin.value = false;
    router.push('/');
};

onMounted(checkLogin);
</script>

<style scoped>
.form-item { margin-bottom: 18px; }
.form-item label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: bold; color: #444; }
.input-ctrl { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.input-ctrl:focus { border-color: #07c160; outline: none; }
</style>
