<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const pwd = ref('');
const isAdmin = ref(false);
const isLoading = ref(false);

const config = ref({
    amap_key: '',
    wx_appid: '',
    top_fee: 0,
    tags_driver: '',
    tags_passenger: '',
    hot_cities: ''
});

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
    } else {
        window.alert('管理员密码错误');
    }
};

const fetchConfig = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data) {
                config.value = {
                    amap_key: data.amap_key || '',
                    wx_appid: data.wx_appid || '',
                    top_fee: data.top_fee || 0,
                    tags_driver: data.tags_driver || '',
                    tags_passenger: data.tags_passenger || '',
                    hot_cities: data.hot_cities || ''
                };
            }
        }
    } catch (e) {
        console.error("加载高级配置失败", e);
    } finally {
        isLoading.value = false;
    }
};

const saveConfig = async () => {
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.value)
        });
        if (res.ok) {
            window.alert('全局系统配置保存成功！');
            try {
                const { useAppStore } = await import('../store');
                const store = useAppStore();
                if (store && typeof store.loadConfig === 'function') {
                    await store.loadConfig();
                }
            } catch(ex){}
        } else {
            window.alert('保存失败，请检查网络或核心配置');
        }
    } catch (e) {
        window.alert('请求异常');
    }
};

const logOut = () => {
    localStorage.removeItem('admin_token');
    isAdmin.value = false;
    router.push('/');
};

onMounted(checkLogin);
</script>

<template>
  <div style="padding: 20px; background: #f5f5f5; min-height: 100vh; font-family: sans-serif;">
    <div v-if="!isAdmin" style="max-width: 400px; margin: 100px auto; background: #fff; padding: 30px 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #333;">宜人出行 安全后台登录</div>
        <input v-model="pwd" type="password" placeholder="请输入超级管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:20px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
        <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">验证身份并登录</button>
    </div>
    
    <div v-else style="max-width: 600px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom:1px solid #eee; padding-bottom:15px;">
            <span style="font-size: 20px; font-weight: bold; color: #333;">系统高级管理后台</span>
            <button @click="logOut" style="background:none; border:1px solid #ff4d4f; color:#ff4d4f; padding:4px 12px; border-radius:4px; cursor:pointer;">退出后台</button>
        </div>

        <div v-if="isLoading" style="text-align: center; padding: 30px; color: #999;">动态资产加载中...</div>
        
        <div v-else>
            <div class="form-item">
                <label>高德地图 Web端 API Key</label>
                <input type="text" v-model="config.amap_key" class="input-ctrl" />
            </div>

            <div class="form-item">
                <label>微信应用开发 AppID</label>
                <input type="text" v-model="config.wx_appid" class="input-ctrl" />
            </div>

            <div class="form-item">
                <label>行程置顶收费金额 (元)</label>
                <input type="number" v-model="config.top_fee" class="input-ctrl" />
            </div>

            <div class="form-item">
                <label>车主发布快捷标签 (英文逗号分隔)</label>
                <input type="text" v-model="config.tags_driver" class="input-ctrl" />
            </div>

            <div class="form-item">
                <label>乘客发布快捷标签 (英文逗号分隔)</label>
                <input type="text" v-model="config.tags_passenger" class="input-ctrl" />
            </div>

            <div class="form-item">
                <label style="color: #ff6600;">地图选位预设热门城市 (必须用英文或中文逗号分隔)</label>
                <textarea v-model="config.hot_cities" rows="3" class="input-ctrl" style="height:70px; resize:none;"></textarea>
            </div>

            <button @click="saveConfig" style="width: 100%; height: 46px; background: #07c160; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; margin-top: 25px; cursor:pointer; box-shadow: 0 4px 10px rgba(7,193,96,0.2);">
                保存并同步配置资产
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.form-item { margin-bottom: 18px; }
.form-item label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: bold; color: #444; }
.input-ctrl { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.input-ctrl:focus { border-color: #1989fa; outline: none; }
</style>
