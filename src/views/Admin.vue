<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif; display: flex;">
    <div v-if="!isAdmin" style="width: 100vw; padding-top: 150px;">
        <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #333;">超级管理员验证</div>
            <input v-model="pwd" type="password" placeholder="请输入管理员密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
            <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">进入系统</button>
        </div>
    </div>
    
    <template v-else>
        <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.1);">
            <div style="height: 60px; line-height: 60px; text-align: center; font-size: 16px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); color: #07c160;">宜人出行运营后台</div>
            <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
            <div :class="['menu-item', activeTab === 'ui' ? 'active' : '']" @click="activeTab = 'ui'">📸 轮播与公告板</div>
            <div :class="['menu-item', activeTab === 'rides' ? 'active' : '']" @click="activeTab = 'rides'">🚗 行程发布管理</div>
            <div :class="['menu-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👥 用户拉黑封禁</div>
            <div class="menu-item" style="color: #ff4d4f; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 30px;" @click="logOut">安全退出系统</div>
        </div>

        <div style="flex: 1; padding: 30px; overflow-y: auto;">
            <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); max-width: 900px; margin: 0 auto;">
                
                <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">平台资产加载中...</div>
                
                <div v-else>
                    <div v-show="activeTab === 'base'">
                        <h3 class="section-title">基础通信密钥参数</h3>
                        <div class="form-group"><label>高德地图 Web开放平台 Key</label><input v-model="config.amap_key" class="input-ctrl" /></div>
                        <div class="form-item"><label>微信开放系统核心 AppID</label><input v-model="config.wx_appid" class="input-ctrl" /></div>
                        <div class="form-item"><label>行程置顶推荐收取的服务费用 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
                    </div>

                    <div v-show="activeTab === 'ui'">
                        <h3 class="section-title">动态公告与多图控制</h3>
                        <div class="form-group">
                            <label style="color:#07c160;">📢 首页滚动通知公告栏内容</label>
                            <input v-model="config.notice" class="input-ctrl" placeholder="填写此处将在前端大厅顶部滚动展现" />
                        </div>
                        
                        <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-top: 20px; background:#fafafa;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                <span style="font-weight:bold; color:#07c160; font-size:14px;">📸 首页滚动轮播图阵列</span>
                                <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">+ 增加图片配置行</button>
                            </div>
                            <div v-for="(b, idx) in bannerItems" :key="idx" style="background:#fff; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #ddd; position:relative;">
                                <label style="font-size:12px; color:#555;">图片资源地址:</label>
                                <input v-model="b.img" class="input-ctrl" style="margin-bottom:5px;" placeholder="https://..." />
                                <label style="font-size:12px; color:#555;">点击跳转映射地址 (选填):</label>
                                <input v-model="b.url" class="input-ctrl" placeholder="/detail?id=x 或 外部URL" />
                                <span @click="removeBanner(idx)" style="position:absolute; right:10px; top:10px; color:red; cursor:pointer; font-weight:bold;">×</span>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'rides'">
                        <h3 class="section-title">全网拼车行程单据管理</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <tr style="background:#f4f5f6; text-align:left;">
                                <th style="padding:12px; border:1px solid #eef0f1;">行程单ID</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">类型</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">起止路线</th>
                                <th style="padding:12px; border:1px solid #eef0f1;">单据管理</th>
                            </tr>
                            <tr v-for="r in rides" :key="r.id">
                                <td style="padding:12px; border:1px solid #eef0f1;">#{{ r.id }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1;">{{ r.type === 'driver' ? '车主' : '乘客' }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1; font-weight:bold;">{{ r.origin }} ➡️ {{ r.destination }}</td>
                                <td style="padding:12px; border:1px solid #eef0f1;">
                                    <button @click="deleteRide(r.id)" style="background:#ff4d4f; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">强行下架删除</button>
                                </td>
                            </tr>
                        </table>
                        <div v-if="rides.length === 0" style="text-align:center; padding:30px; color:#aaa;">暂无拼车行程单资产</div>
                    </div>

                    <div v-show="activeTab === 'users'">
                        <h3 class="section-title">用户准入权限与城市名单</h3>
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label style="color:#ff6600;">🏙️ 发布端高德选位预设热门城市配置</label>
                            <textarea v-model="config.hot_cities" rows="3" class="input-ctrl" style="height:70px; resize:none;"></textarea>
                        </div>
                        <div class="form-group"><label>车主发布常用快捷标签 (逗号分隔)</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
                        <div class="form-group" style="margin-bottom:30px;"><label>乘客发布常用快捷标签 (逗号分隔)</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>

                        <h4 style="margin:20px 0 10px; color:#333;">👥 平台实名注册会员控制名单</h4>
                        <div v-for="u in users" :key="u.id" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img :src="u.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width:36px; height:36px; border-radius:50%;" />
                                <span style="font-weight:bold;">{{ u.nickname || '微信用户' }} (ID: {{ u.id }})</span>
                            </div>
                            <button @click="toggleBanUser(u)" :style="{background: u.is_banned ? '#07c160' : '#ff4d4f', color:'#fff', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer'}">
                                {{ u.is_banned ? '解除封禁' : '强制封禁拉黑' }}
                            </button>
                        </div>
                    </div>

                    <div v-show="activeTab==='base' || activeTab==='ui' || activeTab==='tags'" style="border-top:1px solid #eee; margin-top:25px; padding-top:20px;">
                        <button @click="saveConfig" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">保存并同步生效当前配置</button>
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
        // ⚔️ 绝对防御性容错保护，如果全量或单项接口返回不全，自动平滑切入并加载兜底防止白屏
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
        console.warn('后端资产同步受限，启动运行期安全策略');
    } finally { isLoading.value = false; }
};

const addBanner = () => { bannerItems.value.push({ img: '', url: '' }); };
const removeBanner = (idx) => { bannerItems.value.splice(idx, 1); };

const saveConfig = async () => {
    config.value.banners = JSON.stringify(bannerItems.value);
    try {
        const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) });
        if (res.ok) {
            showSuccessToast('全局系统配置保存成功');
            if (store && typeof store.loadConfig === 'function') store.loadConfig();
        }
    } catch (e) { showFailToast('资产同步请求中断'); }
};

const deleteRide = async (id) => {
    if(window.confirm('确认强制删除该条拼车路线单据吗？')){
        try {
            const res = await fetch(`/api/rides?id=${id}`, { method: 'DELETE' });
            if(res.ok) { rides.value = rides.value.filter(r => r.id !== id); showSuccessToast('行程强行下架成功'); }
        } catch(e){}
    }
};

const toggleBanUser = async (user) => {
    const targetStatus = user.is_banned ? 0 : 1;
    try {
        const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, is_banned: targetStatus }) });
        if(res.ok) { user.is_banned = targetStatus; showSuccessToast(targetStatus ? '已强行封禁拉黑' : '已解除封禁资质'); }
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
