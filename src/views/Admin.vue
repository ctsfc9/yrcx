<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif;">
    <div v-if="!isAdmin" style="padding-top: 150px;">
        <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 30px; color: #333;">管理后台登录</div>
            <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:46px; padding:0 15px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
            <button @click="doLogin" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer; letter-spacing: 2px;">登录</button>
        </div>
    </div>
    
    <div v-else style="display: flex; min-height: 100vh;">
        <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.1); z-index: 10;">
            <div style="height: 60px; line-height: 60px; text-align: center; font-size: 18px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); color: #07c160; letter-spacing: 1px;">
                宜人出行管理
            </div>
            <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
            <div :class="['menu-item', activeTab === 'ui' ? 'active' : '']" @click="activeTab = 'ui'">📸 轮播与公告板</div>
            <div :class="['menu-item', activeTab === 'tags' ? 'active' : '']" @click="activeTab = 'tags'">🏷️ 标签与热门城市</div>
            
            <div class="menu-item" style="color: #ff4d4f; position: absolute; bottom: 20px; width: 220px; border-top: 1px solid rgba(255,255,255,0.1);" @click="logOut">退出管理后台</div>
        </div>

        <div style="flex: 1; padding: 30px; background: #f0f2f5;">
            <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); max-width: 800px; margin: 0 auto;">
                
                <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">配置数据拉取中...</div>
                
                <div v-else>
                    <div v-show="activeTab === 'base'">
                        <h2 class="section-title">基础核心配置</h2>
                        <div class="form-item"><label>高德地图 Web端 Key</label><input v-model="config.amap_key" class="input-ctrl" placeholder="必填" /></div>
                        <div class="form-item"><label>微信应用 AppID</label><input v-model="config.wx_appid" class="input-ctrl" placeholder="wx开头" /></div>
                        <div class="form-item"><label>行程置顶服务费用 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
                    </div>

                    <div v-show="activeTab === 'ui'">
                        <h2 class="section-title">UI呈现配置</h2>
                        <div class="form-item">
                            <label style="color: #07c160;">📢 首页滚动公告栏文字</label>
                            <input v-model="config.notice" class="input-ctrl" placeholder="填写公告内容，留空则不显示公告" />
                        </div>

                        <div style="border: 1px dashed #07c160; padding: 20px; border-radius: 8px; margin-top: 25px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                <span style="font-weight:bold; color:#07c160; font-size:15px;">📸 首页轮播图管理</span>
                                <button @click="addBanner" style="font-size:13px; background:#07c160; color:#fff; border:none; padding:6px 15px; border-radius:4px; cursor:pointer;">+ 添加图片行</button>
                            </div>
                            <div v-for="(item, idx) in bannerItems" :key="idx" style="background:#fafafa; padding:15px; border-radius:6px; margin-bottom:12px; position:relative; border:1px solid #eee;">
                                <label style="font-size:12px; color:#666; font-weight:bold;">图片外链 (Image URL):</label>
                                <input v-model="item.img" class="input-ctrl" placeholder="https://..." style="margin-bottom: 10px;" />
                                <label style="font-size:12px; color:#666; font-weight:bold;">跳转目标 (选填):</label>
                                <input v-model="item.url" class="input-ctrl" placeholder="/detail?id=1 或 外部URL" />
                                <span @click="removeBanner(idx)" style="position:absolute; right:15px; top:15px; color:#ff4d4f; cursor:pointer; font-weight:bold; font-size:20px;">×</span>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'tags'">
                        <h2 class="section-title">业务预设配置</h2>
                        <div class="form-item"><label>车主常用快捷标签 (英文逗号分隔)</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
                        <div class="form-item"><label>乘客常用快捷标签 (英文逗号分隔)</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>
                        <div class="form-item">
                            <label style="color: #ff6600;">🏙️ 发布页预设热门城市</label>
                            <textarea v-model="config.hot_cities" rows="4" class="input-ctrl" style="height:90px; resize:none;" placeholder="例如: 上海市,嘉兴市,宜宾市 (必须用逗号隔开)"></textarea>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 25px;">
                        <button @click="saveConfig" style="width: 200px; height: 48px; background: #07c160; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor:pointer; display:block; margin: 0 auto; box-shadow: 0 4px 10px rgba(7,193,96,0.2);">
                            立即保存配置
                        </button>
                    </div>
                </div>
            </div>
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
const activeTab = ref('base');

const config = ref({
    amap_key: '', wx_appid: '', top_fee: 0,
    tags_driver: '', tags_passenger: '', hot_cities: '', notice: ''
});
const bannerItems = ref([]);

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
        showSuccessToast('登录成功');
        fetchConfig();
    } else { showFailToast('管理员密码错误'); }
};

const fetchConfig = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = { ...data };
            try { bannerItems.value = JSON.parse(data.banners || '[]'); } catch(e) { bannerItems.value = []; }
        }
    } finally { isLoading.value = false; }
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
        } else { showFailToast('保存失败'); }
    } catch (e) { showFailToast('请求异常'); }
};

const logOut = () => {
    localStorage.removeItem('admin_token');
    isAdmin.value = false;
    router.push('/');
};

onMounted(checkLogin);
</script>

<style scoped>
/* 左侧菜单样式 */
.menu-item { padding: 18px 25px; cursor: pointer; color: #a6adb4; font-size: 15px; transition: all 0.2s; box-sizing: border-box; }
.menu-item:hover { background: #1f2333; color: #fff; }
.menu-item.active { background: #07c160; color: #fff; font-weight: bold; border-left: 4px solid #fff; }

.section-title { font-size: 18px; margin-bottom: 25px; color: #333; font-weight: bold; padding-left: 10px; border-left: 4px solid #07c160; }
.form-item { margin-bottom: 22px; }
.form-item label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: bold; color: #555; }
.input-ctrl { width: 100%; padding: 12px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 14px; box-sizing: border-box; transition: all 0.2s; }
.input-ctrl:focus { border-color: #07c160; outline: none; box-shadow: 0 0 0 2px rgba(7,193,96,0.1); }
</style>
