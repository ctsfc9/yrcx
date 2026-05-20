<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif; display: flex;">
    <div v-if="!isAdmin" style="width: 100vw; padding-top: 150px;">
        <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #333;">宜人出行 超级管理验证</div>
            <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
            <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">进入系统后台</button>
        </div>
    </div>
    
    <template v-else>
        <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.1);">
            <div style="height: 60px; line-height: 60px; text-align: center; font-size: 16px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); color: #07c160;">宜人出行管理后台</div>
            <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
            <div :class="['menu-item', activeTab === 'ui' ? 'active' : '']" @click="activeTab = 'ui'">📸 轮播与公告板</div>
            <div :class="['menu-item', activeTab === 'rides' ? 'active' : '']" @click="activeTab = 'rides'">🚗 行程发布管理</div>
            <div :class="['menu-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👥 用户管理中心</div>
            <div class="menu-item" style="color: #ff4d4f; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 30px;" @click="logOut">安全退出系统</div>
        </div>

        <div style="flex: 1; padding: 30px; overflow-y: auto;">
            <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); max-width: 900px; margin: 0 auto;">
                
                <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">配置数据加载同步中...</div>
                
                <div v-else>
                    <div v-show="activeTab === 'base'">
                        <h3 class="section-title">基础通信密钥参数</h3>
                        <div class="form-group"><label>高德地图 Web开放平台 Key</label><input v-model="config.amap_key" class="input-ctrl" /></div>
                        <div class="form-group"><label>微信开放系统核心 AppID</label><input v-model="config.wx_appid" class="input-ctrl" /></div>
                        <div class="form-group"><label>行程置顶服务费用 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
                    </div>

                    <div v-show="activeTab === 'ui'">
                        <h3 class="section-title">动态公告与轮播大图配置</h3>
                        <div class="form-group">
                            <label style="color:#07c160;">📢 首页大厅滚动通知栏文字</label>
                            <input v-model="config.notice" class="input-ctrl" placeholder="输入内容即可同步至大厅顶部滚动展示" />
                        </div>
                        
                        <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-top: 20px; background:#fafafa;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                <span style="font-weight:bold; color:#07c160; font-size:14px;">📸 首页滚动广告大图配置</span>
                                <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">+ 增加图片配置</button>
                            </div>
                            <div v-for="(b, idx) in bannerItems" :key="idx" style="background:#fff; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #ddd; position:relative;">
                                <label style="font-size:12px; color:#555;">图片外链 (URL):</label>
                                <input v-model="b.img" class="input-ctrl" style="margin-bottom:5px;" placeholder="https://..." />
                                <label style="font-size:12px; color:#555;">映射跳转地址 (路径/URL):</label>
                                <input v-model="b.url" class="input-ctrl" placeholder="/detail?id=x 或 外部链接" />
                                <span @click="removeBanner(idx)" style="position:absolute; right:10px; top:10px; color:red; cursor:pointer; font-weight:bold;">×</span>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'rides'">
                        <h3 class="section-title">全网行程单据管理与发布者封禁</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <tr style="background:#f4f5f6; text-align:left;">
                                <th style="padding:12px; border:1px solid #eef0f1;">行程单ID</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">发布人ID</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">起止路线</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">高级管理操作</th>
                            </tr>
                            <tr v-for="r in rides" :key="r.id">
                                <td style="padding:12px; border:1px solid #eef0f1;">#{{ r.id }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1;">{{ r.user_id || '未知用户' }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1; font-weight:bold;">{{ r.origin }} ➡️ {{ r.destination }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1; display:flex; gap:8px;">
                                    <button @click="deleteRide(r.id)" style="background:#ff4d4f; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">下架行程</button>
                                    <button @click="quickBanUser(r.user_id)" style="background:#222; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">拉黑此发布者</button>
                                </td>
                            </tr>
                        </table>
                        <div v-if="rides.length === 0" style="text-align:center; padding:30px; color:#aaa;">暂无拼车行程单数据</div>
                    </div>

                    <div v-show="activeTab === 'users'">
                        <h3 class="section-title">会员实名准入权限控制中心</h3>
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label style="color:#ff6600; font-weight:bold;">🏙️ 发布页地图精准预设热门城市配置</label>
                            <textarea v-model="config.hot_cities" rows="3" class="input-ctrl" style="height:70px; resize:none;" placeholder="以中英文逗号隔开即可"></textarea>
                        </div>
                        <div class="form-group"><label>车主发布快捷标签</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
                        <div class="form-group" style="margin-bottom:30px;"><label>乘客发布快捷标签</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>

                        <h4 style="margin:20px 0 12px; color:#333; font-weight:bold;">👥 全网实名注册会员控制名单</h4>
                        <div v-for="u in users" :key="u.id" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img :src="u.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" />
                                <span style="font-weight:bold;">{{ u.nickname || '微信用户' }} (ID: {{ u.id }})</span>
                            </div>
                            <button @click="toggleBanUser(u)" :style="{background: u.is_banned ? '#07c160' : '#ff4d4f', color:'#fff', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}">
                                {{ u.is_banned ? '安全解除限制' : '永久拉黑封禁' }}
                            </button>
                        </div>
                        <div v-if="users.length === 0" style="text-align:center; padding:20px; color:#999;">暂无会员资产数据</div>
                    </div>

                    <div v-show="activeTab==='base' || activeTab==='ui' || activeTab==='users'" style="border-top:1px solid #eee; margin-top:25px; padding-top:20px;">
                        <button @click="saveConfig" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">保存并同步生效当前模块配置</button>
                    </div>
                </div>
            </div>
        </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';
import { useAppStore } from '../store';

const store = useAppStore();
const pwd = ref('');
const isAdmin = ref(false);
const isLoading = ref(false);
const activeTab = ref('base');

const config = ref({ amap_key: '', wx_appid: '', top_fee: 0, tags_driver: '', tags_passenger: '', hot_cities: '', notice: '', banners: '[]' });
const bannerItems = ref([]);
const rides = ref([]);
const users = ref([]);

const doLogin = () => {
    if (pwd.value === 'yb644300') {
        localStorage.setItem('admin_token', 'true');
        isAdmin.value = true;
        fetchAdminAssets();
    } else { showFailToast('管理员密码验证失败'); }
};

const fetchAdminAssets = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = Object.assign({ amap_key: '', wx_appid: '', top_fee: 0, tags_driver: '', tags_passenger: '', hot_cities: '', notice: '', banners: '[]' }, data);
            try { bannerItems.value = JSON.parse(config.value.banners || '[]'); } catch(e) { bannerItems.value = []; }
        }
        
        const ridesRes = await fetch('/api/rides');
        if (ridesRes.ok) {
            const rData = await ridesRes.json();
            rides.value = rData.results || [];
        }

        const usersRes = await fetch('/api/users');
        if (usersRes.ok) { users.value = await usersRes.json(); }
    } catch (e) {
        console.warn('后端资产拉取受限');
    } finally { isLoading.value = false; }
};

const addBanner = () => { bannerItems.value.push({ img: '', url: '' }); };
const removeBanner = (idx) => { bannerItems.value.splice(idx, 1); };

const saveConfig = async () => {
    config.value.banners = JSON.stringify(bannerItems.value);
    try {
        const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) });
        if (res.ok) {
            showSuccessToast('全局配置资产修改并保存成功');
            if (store && typeof store.loadConfig === 'function') store.loadConfig();
        }
    } catch (e) { showFailToast('网络数据同步故障'); }
};

const deleteRide = async (id) => {
    if(window.confirm('确认下架并永久删除该条拼车记录吗？')){
        try {
            const res = await fetch(`/api/rides?id=${id}`, { method: 'DELETE' });
            if(res.ok) { rides.value = rides.value.filter(r => r.id !== id); showSuccessToast('行程信息已成功强行下架'); }
        } catch(e){}
    }
};

const quickBanUser = async (userId) => {
    if(!userId) return;
    if(window.confirm(`确认直接封禁拉黑发布人(ID: ${userId})吗？`)){
        try {
            const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, is_banned: 1 }) });
            if(res.ok) { showSuccessToast('发布者已被执行永久封禁'); fetchAdminAssets(); }
        } catch(e){}
    }
};

const toggleBanUser = async (user) => {
    const targetStatus = user.is_banned ? 0 : 1;
    try {
        const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, is_banned: targetStatus }) });
        if(res.ok) { user.is_banned = targetStatus; showSuccessToast(targetStatus ? '已执行账户封禁拉黑' : '会员准入资质已成功解封'); }
    } catch(e){}
};

const logOut = () => { localStorage.removeItem('admin_token'); location.reload(); };

onMounted(() => {
    if (localStorage.getItem('admin_token') === 'true') { isAdmin.value = true; fetchAdminAssets(); }
});
</script>

<style scoped>
.menu-item { padding: 18px 25px; cursor: pointer; color: #a6adb4; font-size: 14px; transition: all 0.2s; box-sizing: border-box; }
.menu-item:hover { background: #1f2333; color: #fff; }
.menu-item.active { background: #07c160; color: #fff; font-weight: bold; border-left: 4px solid #fff; }
.section-title { font-size: 16px; margin-bottom: 20px; color: #333; font-weight: bold; padding-left: 10px; border-left: 4px solid #07c160; }
.form-item, .form-group { margin-bottom: 15px; }
.form-item label, .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: bold; color: #555; }
.input-ctrl { width: 100%; padding: 10px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: #fff; }
.input-ctrl:focus { border-color: #07c160; outline: none; }
</style>
