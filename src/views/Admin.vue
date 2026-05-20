<template>
  <div style="background: #f0f2f5; min-height: 100vh; font-family: sans-serif; display: flex; box-sizing: border-box;">
    <div v-if="!isAdmin" style="width: 100vw; padding-top: 150px;">
        <div style="max-width: 360px; margin: 0 auto; background: #fff; padding: 40px 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 25px; color: #333;">宜人出行 管理验证</div>
            <input v-model="pwd" type="password" placeholder="请输入密码" style="width:100%; height:44px; padding:0 12px; margin-bottom:25px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:16px;" @keyup.enter="doLogin" />
            <button @click="doLogin" style="width:100%; height:44px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">验证身份</button>
        </div>
    </div>
    
    <template v-else>
        <div style="width: 220px; background: #2f3447; color: #fff; flex-shrink: 0; box-shadow: 2px 0 10px rgba(0,0,0,0.1); position: relative;">
            <div style="height: 60px; line-height: 60px; text-align: center; font-size: 16px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); color: #07c160;">管理后台</div>
            <div :class="['menu-item', activeTab === 'base' ? 'active' : '']" @click="activeTab = 'base'">⚙️ 基础通讯配置</div>
            <div :class="['menu-item', activeTab === 'ui' ? 'active' : '']" @click="activeTab = 'ui'">📸 轮播与公告板</div>
            <div :class="['menu-item', activeTab === 'rides' ? 'active' : '']" @click="activeTab = 'rides'">🚗 行程详细管理</div>
            <div :class="['menu-item', activeTab === 'users' ? 'active' : '']" @click="activeTab = 'users'">👥 用户管理中心</div>
            <div class="menu-item" style="color: #ff4d4f; border-top: 1px solid rgba(255,255,255,0.1); position: absolute; bottom: 20px; width: 100%;" @click="logOut">安全退出</div>
        </div>

        <div style="flex: 1; padding: 30px; overflow-y: auto; box-sizing: border-box;">
            <div style="background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); max-width: 1000px; margin: 0 auto;">
                <div v-if="isLoading" style="text-align: center; padding: 50px; color: #999;">平台资产数据同步中...</div>
                <div v-else>
                    
                    <div v-show="activeTab === 'base'">
                        <h3 class="section-title">基础通信密钥参数</h3>
                        <div class="form-group"><label>高德地图 Key</label><input v-model="config.amap_key" type="text" class="input-ctrl" /></div>
                        <div class="form-group"><label>行程置顶推荐服务费 (元)</label><input v-model="config.top_fee" type="number" class="input-ctrl" /></div>
                        
                        <h3 class="section-title" style="margin-top:30px; border-left-color:#1989fa;">公众号与微信支付设置 (明文显示)</h3>
                        <div class="form-group"><label>请输入公众号AppID：</label><input v-model="secrets.wx_appid" type="text" class="input-ctrl" /></div>
                        <div class="form-group"><label>请输入公众号AppSecret：</label><input v-model="secrets.wx_appsecret" type="text" class="input-ctrl" /></div>
                        <div class="form-group"><label>请输入微信商户号：</label><input v-model="secrets.wx_mchid" type="text" class="input-ctrl" /></div>
                        <div class="form-group"><label>请输入微信支付秘钥：</label><input v-model="secrets.wx_paykey" type="text" class="input-ctrl" /></div>
                    </div>

                    <div v-show="activeTab === 'ui'">
                        <h3 class="section-title">动态公告与多图配置</h3>
                        <div class="form-group"><label style="color:#07c160;">📢 首页滚动公告内容</label><input v-model="config.notice" class="input-ctrl" /></div>
                        <div style="border: 1px dashed #07c160; padding: 15px; border-radius: 8px; margin-top: 20px; background:#fafafa;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                                <span style="font-weight:bold; color:#07c160;">📸 首页多张轮播图</span>
                                <button @click="addBanner" style="font-size:12px; background:#07c160; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">+ 增加图片</button>
                            </div>
                            <div v-for="(b, idx) in bannerItems" :key="idx" style="background:#fff; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #ddd; position:relative;">
                                <input v-model="b.img" class="input-ctrl" style="margin-bottom:6px;" placeholder="图片URL" />
                                <input v-model="b.url" class="input-ctrl" placeholder="跳转URL" />
                                <span @click="removeBanner(idx)" style="position:absolute; right:12px; top:12px; color:#ff4d4f; cursor:pointer; font-weight:bold; font-size: 16px;">×</span>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'rides'">
                        <h3 class="section-title">全网详细行程单据</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <tr style="background:#f4f5f6; text-align:left;">
                                <th style="padding:10px; border:1px solid #eef0f1; width:70px;">类型</th>
                                <th style="padding:10px; border:1px solid #eef0f1;">路线与时间</th>
                                <th style="padding:10px; border:1px solid #eef0f1;">详细信息</th>
                                <th style="padding:10px; border:1px solid #eef0f1; width:100px;">操作</th>
                            </tr>
                            <tr v-for="r in rides" :key="r.id" style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding:10px; border:1px solid #eef0f1; text-align:center;">
                                    <div :style="{color: r.type==='driver'?'#1989fa':'#ff7700', fontWeight:'bold', marginBottom:'5px'}">{{ r.type==='driver'?'车主':'乘客' }}</div>
                                    <div style="font-size: 11px; color:#888;">ID: #{{ r.id }}</div>
                                </td>
                                <td style="padding:10px; border:1px solid #eef0f1;">
                                    <div style="font-weight:bold; font-size:14px; color:#333; margin-bottom:4px;">{{ r.origin }} ➡️ {{ r.destination }}</div>
                                    <div style="color:#666; margin-bottom:8px;">📅 {{ formatDate(r.date) }}</div>
                                    <div style="display:flex; align-items:center; gap:6px; background:#f9f9f9; padding:6px; border-radius:6px; border:1px solid #eee;">
                                        <img :src="r.publisher_avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width:26px; height:26px; border-radius:50%; object-fit:cover;" />
                                        <div style="font-size:12px; color:#333; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">
                                            {{ r.publisher_nickname || '未知用户' }}
                                        </div>
                                    </div>
                                    <div style="color:#aaa; font-size:11px; margin-top:4px; font-family:monospace;">账号ID: {{ r.user_id }}</div>
                                </td>
                                <td style="padding:10px; border:1px solid #eef0f1; color:#555; line-height: 1.6;">
                                    <div>💺 {{ r.seats }}座 | 💰 {{ r.price || '面议' }} {{ r.car_model ? ' | 🚘 ' + r.car_model : '' }}</div>
                                    <div>📞 电话: {{ r.contact }}</div>
                                    <div style="color:#888; font-size:12px;">📝 备注: {{ r.remark || '无' }}</div>
                                </td>
                                <td style="padding:10px; border:1px solid #eef0f1; text-align: center;">
                                    <button @click="deleteRide(r.id)" style="background:#ff4d4f; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-bottom: 6px; width: 100%;">下架</button>
                                    <button @click="quickBanUser(r.user_id)" style="background:#222; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; width: 100%;">封禁用户</button>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div v-show="activeTab === 'users'">
                        <h3 class="section-title">会员权限控制与封禁管理</h3>
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label style="color:#ff6600;">🏙️ 发布页预设热门城市</label>
                            <textarea v-model="config.hot_cities" rows="2" class="input-ctrl" style="resize:none;"></textarea>
                        </div>
                        <div class="form-group"><label>车主快捷标签</label><input v-model="config.tags_driver" class="input-ctrl" /></div>
                        <div class="form-group" style="margin-bottom:30px;"><label>乘客快捷标签</label><input v-model="config.tags_passenger" class="input-ctrl" /></div>
                        
                        <h4 style="margin:25px 0 12px; color:#222; font-weight:bold; font-size:15px;">👤 授权用户身份及解封管理</h4>
                        <div v-for="u in users" :key="u.id" style="display:flex; justify-content:space-between; align-items:center; padding:15px; background: #fafafa; border-radius: 8px; margin-bottom: 10px; border: 1px solid #eee;">
                            <div style="display:flex; align-items:center; gap:14px;">
                                <img :src="u.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width:44px; height:44px; border-radius:50%; object-fit:cover;" />
                                <div>
                                    <div style="font-weight:bold; font-size: 15px; color: #111;">{{ u.nickname || '微信用户' }}</div>
                                    <div style="font-size: 12px; color: #666; margin-top: 5px; font-family: monospace;">ID: {{ u.id }} | 📱 <span style="color:#ff5500; font-weight:bold;">{{ u.phone || '未留存' }}</span></div>
                                </div>
                            </div>
                            <div style="display:flex; gap: 8px;">
                                <button v-if="!u.is_banned" @click="toggleBanUser(u, 1)" style="background:#ff976a; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor: pointer; font-weight:bold;">
                                    🚫 封禁
                                </button>
                                <button v-else @click="toggleBanUser(u, 0)" style="background:#07c160; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor: pointer; font-weight:bold;">
                                    ✅ 解封
                                </button>
                                <button @click="deleteUser(u.id)" style="background: #ee0a24; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor: pointer; font-weight:bold;">
                                    🗑️ 删除
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab==='base' || activeTab==='ui' || activeTab==='users'" style="border-top:1px solid #eee; margin-top:30px; padding-top:20px;">
                        <button @click="saveConfig" style="width:100%; height:46px; background:#07c160; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">保存全量配置</button>
                    </div>
                </div>
            </div>
        </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Toast } from 'vant';
import { useAppStore } from '../store';

const store = useAppStore();
const pwd = ref('');
const isAdmin = ref(false);
const isLoading = ref(false);
const activeTab = ref('base');

const config = ref({ amap_key: '', top_fee: 0, hot_cities: '', notice: '', banners: '[]' });
const secrets = ref({ wx_appid: '', wx_appsecret: '', wx_mchid: '', wx_paykey: '' });
const bannerItems = ref([]);
const rides = ref([]);
const users = ref([]);

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : str;
};

const doLogin = () => {
    if (pwd.value === 'yb644300') { localStorage.setItem('admin_token', 'true'); isAdmin.value = true; fetchAdminAssets(); }
};

const fetchAdminAssets = async () => {
    isLoading.value = true;
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            config.value = Object.assign({ amap_key: '', top_fee: 0, hot_cities: '', notice: '', banners: '[]' }, data);
            try { bannerItems.value = JSON.parse(config.value.banners || '[]'); } catch(e) { bannerItems.value = []; }
        }
        
        const secretRes = await fetch('/api/secret');
        if (secretRes.ok) { 
            const sData = await secretRes.json(); 
            secrets.value = Object.assign({ wx_appid: '', wx_appsecret: '', wx_mchid: '', wx_paykey: '' }, sData); 
        }
        
        const ridesRes = await fetch('/api/rides');
        if (ridesRes.ok) { const rData = await ridesRes.json(); rides.value = rData.results || []; }

        const usersRes = await fetch('/api/users');
        if (usersRes.ok) { users.value = await usersRes.json(); }
    } catch (e) {} finally { isLoading.value = false; }
};

const addBanner = () => { bannerItems.value.push({ img: '', url: '' }); };
const removeBanner = (idx) => { bannerItems.value.splice(idx, 1); };

const saveConfig = async () => {
    config.value.banners = JSON.stringify(bannerItems.value);
    try {
        await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) });
        await fetch('/api/secret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secrets.value) });
        Toast.success('保存成功');
        if (store && typeof store.loadConfig === 'function') store.loadConfig();
    } catch (e) { Toast.fail('保存失败'); }
};

const deleteRide = async (id) => {
    if(window.confirm('确认下架删除该记录吗？')) {
        try {
            const res = await fetch(`/api/rides?id=${id}&admin=true`, { method: 'DELETE' });
            if(res.ok) { rides.value = rides.value.filter(r => r.id !== id); Toast.success('已下架'); }
        } catch(e){}
    }
};

const quickBanUser = async (userId) => {
    if(!userId) return;
    if(window.confirm(`确认封禁该用户吗？`)) {
        await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, is_banned: 1 }) });
        Toast.success('账号已封禁'); fetchAdminAssets();
    }
};

const toggleBanUser = async (user, targetStatus) => {
    const res = await fetch(`/api/users/ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, is_banned: targetStatus }) });
    if(res.ok) { user.is_banned = targetStatus; Toast.success(targetStatus ? '已拉黑封禁' : '已解封'); }
};

const deleteUser = async (userId) => {
    if(window.confirm('⚠️ 彻底删除用户将同时删除其所有数据！确认操作吗？')) {
        const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
        if(res.ok) { Toast.success('用户已彻底删除'); fetchAdminAssets(); }
    }
};

const logOut = () => { localStorage.removeItem('admin_token'); location.reload(); };
onMounted(() => { if (localStorage.getItem('admin_token') === 'true') { isAdmin.value = true; fetchAdminAssets(); } });
</script>

<style scoped>
.menu-item { padding: 18px 25px; cursor: pointer; color: #a6adb4; font-size: 14px; transition: all 0.2s; box-sizing: border-box; }
.menu-item:hover { background: #1f2333; color: #fff; }
.menu-item.active { background: #07c160; color: #fff; font-weight: bold; border-left: 4px solid #fff; }
.section-title { font-size: 16px; margin-bottom: 20px; color: #333; font-weight: bold; padding-left: 10px; border-left: 4px solid #07c160; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: bold; color: #555; }
.input-ctrl { width: 100%; padding: 10px; border: 1px solid #dcdfe6; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: #fff; }
</style>
