<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);
const isFetchingData = ref(true);

// 👉 绝对安全的数据通道：杜绝 template 解析崩溃
const isLogin = computed(() => !!(store && store.userProfile && store.userProfile.id));
const uId = computed(() => (store && store.userProfile && store.userProfile.id) ? store.userProfile.id : null);
const uAvatar = computed(() => (store && store.userProfile && store.userProfile.avatar) ? store.userProfile.avatar : 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg');
const uNickname = computed(() => (store && store.userProfile && store.userProfile.nickname) ? store.userProfile.nickname : '微信用户');
const uPhone = computed(() => (store && store.userProfile && store.userProfile.phone) ? store.userProfile.phone : '未绑定手机号');

onMounted(async () => {
    try {
        if (isLogin.value) {
            const res = await fetch('/api/rides');
            if (res.ok) {
                const data = await res.json();
                if (data && data.results) {
                    myRides.value = data.results.filter(r => r.user_id === uId.value);
                }
            }
        }
    } catch (e) {
        console.error("后台数据获取失败", e);
    } finally {
        isFetchingData.value = false;
    }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
    const appId = (store && store.sysConfig && store.sysConfig.wx_appid) ? store.sysConfig.wx_appid : 'wx90223bd25485040a';
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = async (id) => {
    if (!isLogin.value) return;
    if (!window.confirm('此操作不可恢复，确定要删除这条行程吗？')) return;
    
    try {
        const res = await fetch(`/api/rides?id=${id}&user_id=${uId.value}`, { method: 'DELETE' });
        if (res.ok) {
            myRides.value = myRides.value.filter(r => r.id !== id);
            window.alert('删除成功');
        } else {
            window.alert('删除失败，请重试');
        }
    } catch(e) {
        window.alert('网络请求遇到异常');
    }
};
</script>

<template>
  <div class="user-page-container">
    <div class="user-nav-bar">个人中心</div>

    <div class="profile-header-card">
        <template v-if="isLogin">
            <img :src="uAvatar" class="user-avatar" />
            <div class="user-details">
                <div class="user-nickname">{{ uNickname }}</div>
                <div class="user-sub-info">📱 {{ uPhone }}</div>
            </div>
        </template>
        <template v-else>
            <div class="user-avatar-placeholder">👤</div>
            <div class="user-details-auth" @click="goToAuth">
                <div class="auth-title">点击登录/授权微信</div>
                <div class="auth-subtitle">登录后可安全管理您的行程</div>
            </div>
            <span class="arrow-right">➡️</span>
        </template>
    </div>

    <div class="rides-section-container">
        <div class="rides-section-title">我的发布行程</div>
        
        <div v-if="isFetchingData" class="rides-empty-status">数据加载中...</div>
        <div v-else-if="!isLogin" class="rides-empty-status">请登录后查看您的发布历史</div>
        <div v-else-if="myRides.length === 0" class="rides-empty-status">暂无任何发布记录</div>
        
        <div v-else v-for="item in myRides" :key="item.id" class="ride-card">
            <div class="ride-card-header">
                <span class="ride-type-tag" :class="item.type === 'driver' ? 'driver' : 'passenger'">
                    {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
                </span>
                <span v-if="item.is_top" class="top-tag">🔥已置顶</span>
            </div>
            <div class="ride-card-body" @click="router.push(`/detail?id=${item.id}`)">
                <span class="origin-city">{{ item.origin }}</span>
                <span class="arrow-icon">➡️</span>
                <span class="dest-city">{{ item.destination }}</span>
            </div>
            <div class="ride-card-footer-info">出发日期: {{ formatDate(item.date) }}</div>
            
            <div class="ride-card-actions">
                <button class="action-btn detail" @click="router.push(`/detail?id=${item.id}`)">详情</button>
                <button class="action-btn delete" @click="deleteRide(item.id)">删除</button>
            </div>
        </div>
    </div>
    
    <TabBar />
  </div>
</template>

<style scoped>
.user-page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 90px; }
.user-nav-bar { height: 46px; background: #fff; text-align: center; line-height: 46px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #f0f0f0; }

.profile-header-card { background: linear-gradient(135deg, #ff9000, #ff5c00); padding: 30px 20px; color: #fff; display: flex; align-items: center; box-shadow: 0 4px 8px rgba(255,102,0,0.15); }
.user-avatar { width: 64px; height: 64px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; }
.user-avatar-placeholder { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 32px; color: #fff; }
.user-details, .user-details-auth { margin-left: 15px; flex: 1; }
.user-nickname, .auth-title { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
.user-sub-info, .auth-subtitle { font-size: 13px; }
.arrow-right { font-size: 20px; }

.rides-section-container { margin: 15px; }
.rides-section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-left: 4px solid #ff6600; padding-left: 8px; }
.rides-empty-status { text-align: center; padding: 40px 0; color: #999; background: #fff; border-radius: 8px; }

.ride-card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
.ride-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ride-type-tag { font-weight: bold; font-size: 13px; }
.ride-type-tag.driver { color: #1989fa; }
.ride-type-tag.passenger { color: #ff7700; }
.top-tag { color: #ee0a24; font-size: 12px; font-weight: bold; }
.ride-card-body { font-weight: bold; font-size: 16px; margin-bottom: 8px; cursor: pointer; }
.arrow-icon { color: #ccc; margin: 0 5px; }
.ride-card-footer-info { color: #666; font-size: 13px; margin-bottom: 15px; }
.ride-card-actions { display: flex; gap: 10px; border-top: 1px solid #eee; padding-top: 10px; }
.action-btn { flex: 1; height: 32px; background: #fff; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; cursor: pointer; }
.action-btn.detail { border-color: #1989fa; color: #1989fa; }
.action-btn.delete { border-color: #ee0a24; color: #ee0a24; }
</style>
