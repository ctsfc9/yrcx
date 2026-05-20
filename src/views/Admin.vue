<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif; display: flex; box-sizing: border-box;">
    <div v-if="!isAdmin" style="width: 100vw; padding-top: 150px;">
        <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #333;">宜人出行 超级管理验证</div>
            <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
            <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">验证身份并进入</button>
        </div>
    </div>
    
    <template v-else>
        <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.1); position: relative;">
            <div style="height: 60px; line-height: 60px; text-align: center; font-size: 16px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); color: #07c160; letter-spacing: 0.5px;">宜人出行管理后台</div>
            <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
            <div :class="['menu-item', activeTab === 'ui' ? 'active' : '']" @click="activeTab = 'ui'">📸 轮播与公告板</div>
            <div :class="['menu-item', activeTab === 'rides' ? 'active' : '']" @click="activeTab = 'rides'">🚗 行程发布管理</div>
            <div :class="['menu-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👥 用户管理中心</div>
            <div class="menu-item" style="color: #ff4d4f; border-top: 1px solid rgba(255,255,255,0.1); position: absolute; bottom: 20px; width: 100%;" @click="logOut">安全退出系统</div>
        </div>

        <div style="flex: 1; padding: 30px; overflow-y: auto; box-sizing: border-box;">
            <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); max-width: 900px; margin: 0 auto;">
                
                <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">平台资产数据同步中...</div>
                
                <div v-else>
                    <div v-show="activeTab === 'base'">
                        <h3 class="section-title">基础通信密钥参数</h3>
                        <div class="form-group"><label>高德地图 Web开放平台 Key</label><input v-model="config.amap_key" class="input-ctrl" /></div>
                        <div class="form-group"><label>微信开放系统核心 AppID</label><input v-model="config.wx_appid" class="input-ctrl" /></div>
                        
                        <div class="form-group">
                            <label style="color:#ee0a24;">🔐 微信开放系统核心 AppSecret (安全加密)</label>
                            <input v-model="config.wx_appsecret" type="password" class="input-ctrl" placeholder="请输入公众平台生成的AppSecret凭证 (已做代码级防泄露保护)" />
                        </div>
                        
                        <div class="form-group"><label>行程置顶推荐收取的服务费用 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
                    </div>

                    <div v-show="activeTab === 'ui'">
                        <h3 class="section-title">动态滚动公告与轮播图矩阵</h3>
                        <div class="form-group">
                            <label style="color:#07c160; font-weight: bold;">📢 首页滚动通知公告栏文字内容</label>
                            <input v-model="config.notice" class="input-ctrl" placeholder="输入内容即可同步至大厅顶部滚动展示" />
                        </div>
                        
                        <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-top: 25px; background:#fafafa;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                <span style="font-weight:bold; color:#07c160; font-size:14px;">📸 首页多张轮播图控制中心</span>
                                <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight: bold;">+ 增加图片配置行</button>
                            </div>
                            <div v-for="(b, idx) in bannerItems" :key="idx" style="background:#fff; padding:12px; border-radius:6px; margin-bottom:10px; border:1px solid #ddd; position:relative;">
                                <label style="font-size:12px; color:#555; font-weight: bold;">图片资源外链 (Image URL):</label>
                                <input v-model="b.img" class="input-ctrl" style="margin-bottom:6px;" placeholder="https://..." />
                                <label style="font-size:12px; color:#555; font-weight: bold;">点击图片跳转目标地址 (选填):</label>
                                <input v-model="b.url" class="input-ctrl" placeholder="/detail?id=x 或 外部H5链接" />
                                <span @click="removeBanner(idx)" style="position:absolute; right:12px; top:12px; color:#ff4d4f; cursor:pointer; font-weight:bold; font-size: 16px;">×</span>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'rides'">
                        <h3 class="section-title">全网拼车行程记录单据管理</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <tr style="background:#f4f5f6; text-align:left;">
                                <th style="padding:12px; border:1px solid #eef0f1;">行程ID</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">类型</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">起止路线</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">高级干预操作</th>
                            </tr>
                            <tr v-for="r in rides" :key="r.id" style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding:12px; border:1px solid #eef0f1;">#{{ r.id }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1;">{{ r.type === 'driver' ? '车主' : '乘客' }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1; font-weight:bold; color: #333;">{{ r.origin }} ➡️ {{ r.destination }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1; display:flex; gap:8px;">
                                    <button @click="deleteRide(r.id)" style="background:#ff4d4f; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">强行下架</button>
                                    <button @click="quickBanUser(r.user_id)" style="background:#222; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">封禁发布人</button>
                                </td>
                            </tr>
                        </table>
                        <div v-if="rides.length === 0" style="text-align:center; padding:30px; color:#aaa;">暂无任何行程单据数据</div>
                    </div>

                    <div v-show="activeTab === 'users'">
                        <h3 class="section-title">用户准入权限与预设选项控制</h3>
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label style="color:#ff6600;">🏙️ 发布端高德选位预设热门城市配置</label>
                            <textarea v-model="config.hot_cities" rows="3" class="input-ctrl" style="height:70px; resize:none;"></textarea>
                        </div>
                        <div class="form-group"><label>车主发布常用快捷标签 (逗号分隔)</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
                        <div class="form-group" style="margin-bottom:30px;"><label>乘客发布常用快捷标签 (逗号分隔)</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>

                        <h4 style="margin:25px 0 12px; color:#222; font-weight:bold; font-size:15px;">👤 会员身份及预留手机号完整核验表</h4>
                        <div v-for="u in users" :key="u.id" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #f0f0f0; background: #fafafa; border-radius: 8px; margin-bottom: 8px;">
                            <div style="display:flex; align-items:center; gap:14px;">
                                <img :src="u.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border: 1px solid #eee; background: #fff;" />
                                <div>
                                    <div style="font-weight:bold; font-size: 15px; color: #111;">{{ u.nickname || '微信用户' }}</div>
                                    <div style="font-size: 12px; color: #666; margin-top: 5px; font-family: monospace;">用户ID: {{ u.id }} | 📱 手机号: <span style="color:#ff5500; font-weight:bold;">{{ u.phone || '未填写手机号' }}</span></div>
                                </div>
                            </div>
                            <button @click="toggleBanUser(u)" :style="{background: u.is_banned ? '#07c160' : '#ff4d4f', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'6px', cursor: 'pointer', fontWeight:'bold', fontSize:'13px'}">
                                {{ u.is_banned ? '解除封禁资质' : '强制拉黑封禁' }}
                            </button>
                        </div>
                        <div v-if="users.length === 0" style="text-align:center; padding:30px; color:#aaa;">暂无任何注册会员数据</div>
                    </div>

                    <div v-show="activeTab==='base' || activeTab==='ui' || activeTab==='users'" style="border-top:1px solid #eee; margin-top:30px; padding-top:20px;">
                        <button @click="saveConfig" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 12px rgba(7,193,96,0.15);">保存并全网同步当前配置</button>
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

const config = ref({ amap_key: '', wx_appid: '', wx_appsecret: '', top_fee: 0, tags_driver: '', tags_passenger: '', hot_cities: '', notice: '', banners: '[]' });
const bannerItems = ref([]);
const rides = ref([]);
const users = ref([]);

const doLogin = () => {
    if (pwd.value === 'yb644300') {
        localStorage.setItem('admin_token', 'true');
        isAdmin.value = true;
        fetchAdminAssets();
    } else { showFailToast('管理端安全凭证错误'); }
};

const fetchAdminAssets = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = Object.assign({ amap_key: '', wx_appid: '', wx_appsecret: '', top_fee: 0, tags_driver: '', tags_passenger: '', hot_cities: '', notice: '', banners: '[]' }, data);
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
        console.warn('后端网络资产读取受限');
    } finally { isLoading.value = false; }
};

const addBanner = () => { bannerItems.value.push({ img: '', url: '' }); };
const removeBanner = (idx) => { bannerItems.value.splice(idx, 1); };

const saveConfig = async () => {
    config.value.banners = JSON.stringify(bannerItems.value);
    try {
        const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) });
        if (res.ok) {
            showSuccessToast('全局系统配置同步保存成功');
            if (store && typeof store.loadConfig === 'function') store.loadConfig();
        }
    } catch (e) { showFailToast('核心数据同步受阻'); }
};

const deleteRide = async (id) => {
    if(window.confirm('确认强制删除该条拼车路线单据吗？')){
        try {
            const res = await fetch(`/api/rides?id=${id}&admin=true`, { method: 'DELETE' });
            if(res.ok) { rides.value = rides.value.filter(r => r.id !== id); showSuccessToast('行程信息已成功强行下架'); }
        } catch(e){}
    }
};

const quickBanUser = async (userId) => {
    if(!userId) return;
    if(window.confirm(`超级干预：确认直接封禁并拉黑该发布人(用户ID: ${userId})吗？`)){
        try {
            const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, is_banned: 1 }) });
            if(res.ok) { showSuccessToast('发布者账号已强行终止服务权限'); fetchAdminAssets(); }
        } catch(e){}
    }
};

const toggleBanUser = async (user) => {
    const targetStatus = user.is_banned ? 0 : 1;
    try {
        const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, is_banned: targetStatus }) });
        if(res.ok) { user.is_banned = targetStatus; showSuccessToast(targetStatus ? '已强行将该会员拉黑封禁' : '该会员拼车准入资质已成功解封'); }
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
