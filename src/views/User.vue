<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog, showSuccessToast, showLoadingToast, closeToast } from 'vant';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const router = useRouter();
const myRides = ref([]);
const pageLoading = ref(true);

onMounted(async () => {
    // 极简防御逻辑，防止任何空指针导致白屏
    try {
        if (!store.userProfile || !store.userProfile.id) {
            pageLoading.value = false;
            return;
        }
        const res = await fetch(`/api/rides`);
        const data = await res.json();
        if (data && data.results) {
            myRides.value = data.results.filter(r => r.user_id === store.userProfile.id);
        }
    } catch(e) {
        console.error('加载行程失败');
    } finally {
        pageLoading.value = false;
    }
});

const formatDate = (str) => {
  if (!str) return '';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})/);
  if (match) return `${match[2]}月${match[3]}日 ${match[4]}:${match[5]}`;
  return str;
};

const goToAuth = () => {
    const appId = store.sysConfig?.wx_appid;
    if (!appId) { showToast('后台未配置微信AppID'); return; }
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`;
};

const deleteRide = (id) => {
    showDialog({
        title: '确认删除',
        message: '删除后无法恢复，是否继续？',
        showCancelButton: true,
        confirmButtonColor: '#ee0a24'
    }).then(async () => {
        showLoadingToast({ message: '删除中...', forbidClick: true });
        try {
            const res = await fetch(`/api/rides?id=${id}&user_id=${store.userProfile.id}`, { method: 'DELETE' });
            if (res.ok) {
                showSuccessToast('已删除');
                myRides.value = myRides.value.filter(r => r.id !== id);
            } else {
                showFailToast('删除失败');
            }
        } catch(e) {
            showFailToast('网络错误');
        } finally {
            closeToast();
        }
    }).catch(() => {});
};
</script>

<template>
  <div style="min-height: 100vh; background: #f7f8fa; padding-bottom: 80px;">
    <van-nav-bar title="个人中心" />

    <div v-if="pageLoading" style="text-align: center; padding: 50px 0; color: #999;">
        <van-loading type="spinner" color="#ff6600" />
        <div style="margin-top: 10px; font-size: 14px;">加载中...</div>
    </div>

    <div v-else>
        <div style="background: linear-gradient(135deg, #ff9000, #ff5c00); padding: 30px 20px; color: #fff; display: flex; align-items: center; box-shadow: 0 4px 12px rgba(255,102,0,0.2);">
            <template v-if="store.userProfile && store.userProfile.id">
                <img :src="store.userProfile.avatar || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg'" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); object-fit: cover;" />
                <div style="margin-left: 15px; flex: 1;">
                    <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">{{ store.userProfile.nickname || '顺风车用户' }}</div>
                    <div style="font-size: 13px; opacity: 0.9;">📱 {{ store.userProfile.phone || '未绑定手机号' }}</div>
                </div>
            </template>
            <template v-else>
                <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                    <van-icon name="user-o" size="32" color="#fff" />
                </div>
                <div style="margin-left: 15px; flex: 1;" @click="goToAuth">
                    <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">点击登录/授权</div>
                    <div style="font-size: 13px; opacity: 0.9;">登录后可发布和管理行程</div>
                </div>
                <van-icon name="arrow" size="20" />
            </template>
        </div>

        <div style="margin: 15px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <van-cell-group>
                <van-cell title="发布新行程" icon="add-square" is-link to="/publish" />
            </van-cell-group>
        </div>

        <div style="margin: 15px;">
            <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; padding-left: 5px; border-left: 4px solid #ff6600;">我的发布</div>
            
            <div v-if="!store.userProfile || !store.userProfile.id" style="text-align: center; padding: 40px 0; color: #999; background: #fff; border-radius: 8px;">
                请先登录后查看
            </div>
            
            <div v-else-if="myRides.length === 0" style="text-align: center; padding: 40px 0; color: #999; background: #fff; border-radius: 8px;">
                您还没有发布过行程
            </div>
            
            <div v-else v-for="item in myRides" :key="item.id" style="background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span :style="{background: item.type==='driver'?'#eaf5ff':'#fff2e8', color: item.type==='driver'?'#1989fa':'#ff7700'}" style="font-size:12px; padding:2px 8px; border-radius:4px;">
                        {{ item.type === 'driver' ? '车主找人' : '乘客找车' }}
                    </span>
                    <span v-if="item.is_top" style="color: #ee0a24; font-size: 12px; font-weight: bold;"><van-icon name="fire" /> 已置顶</span>
                </div>
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;" @click="router.push(`/detail?id=${item.id}`)">
                    {{ item.origin }} <van-icon name="arrow" color="#ccc" /> {{ item.destination }}
                </div>
                <div style="color: #666; font-size: 13px; margin-bottom: 15px;">出发时间: {{ formatDate(item.date) }}</div>
                
                <div style="display: flex; gap: 10px; border-top: 1px dashed #eee; padding-top: 10px;">
                    <van-button size="small" plain type="primary" block @click="router.push(`/detail?id=${item.id}`)">查看详情</van-button>
                    <van-button size="small" plain type="danger" block @click="deleteRide(item.id)">删除行程</van-button>
                </div>
            </div>
        </div>
    </div>

    <TabBar />
  </div>
</template>
