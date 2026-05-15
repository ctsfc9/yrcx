<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const router = useRouter();
const store = useAppStore();

const list = ref([]);
const loading = ref(false);
const finished = ref(false);
const refreshing = ref(false);
const filterType = ref('all');

const safeList = computed(() => [...list.value].sort((a, b) => b.id - a.id));
const bannersList = computed(() => store.sysConfig.banners.split(',').filter(Boolean));

const onLoad = async () => {
  if (refreshing.value) list.value = [];
  loading.value = true;
  try {
    const res = await fetch(`/api/rides?type=${filterType.value}`);
    if(res.ok) list.value = (await res.json()).results || [];
  } catch(e) {}
  loading.value = false; refreshing.value = false; finished.value = true;
};

const setFilter = (t) => { filterType.value = t; refreshing.value = true; onLoad(); };

const formatDate = (str) => {
  if (!str) return '待定';
  const match = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2})[:](\d{1,2}))?/);
  if (match) return `${match[1]}年${match[2]}月${match[3]}日 ${match[4] ? match[4] : '0'}点`;
  return str;
};

onMounted(() => { onLoad(); });
</script>

<template>
  <div class="page-home" style="padding: 10px; padding-bottom: 80px;">
    <van-notice-bar left-icon="volume-o" :text="store.sysConfig.notice_text" style="height:36px;margin-bottom:5px;" scrollable />
    <van-swipe :autoplay="3000" style="height:150px;">
      <van-swipe-item v-for="i in bannersList" :key="i"><img :src="i" style="width:100%;height:100%;object-fit:cover;"/></van-swipe-item>
    </van-swipe>
    
    <div style="display: flex; gap: 10px; padding: 10px 0;">
      <div style="flex:1; background: #4fc1e9; color: #fff; padding:10px; text-align:center; border-radius: 8px; font-weight: bold; cursor: pointer;" @click="setFilter('driver')">车找人</div>
      <div style="flex:1; background: #a0d468; color: #fff; padding:10px; text-align:center; border-radius: 8px; font-weight: bold; cursor: pointer;" @click="setFilter('passenger')">人找车</div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onLoad">
      <van-skeleton title avatar :row="3" :loading="loading && list.length === 0" style="margin-top:20px;">
          <div v-if="safeList.length === 0" style="text-align:center;padding:40px;color:#999;font-size:14px;">暂无信息</div>
          <van-list v-else v-model:loading="loading" :finished="finished" finished-text="没有更多了">
            <div v-for="item in safeList" :key="item.id" @click="router.push(`/ride/${item.id}`)" style="background: #fff; margin-bottom: 10px; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                  <span style="padding: 2px 6px; font-size: 14px; color: #fff; border-radius: 4px; font-weight: bold;" :style="{background: item.type==='driver'?'#07c160':'orange'}">{{ item.type==='driver'?'车主':'乘客' }}</span>
                  <span style="font-size: 17px; font-weight: bold; color: #333;">{{ item.origin }} → {{ item.destination }}</span>
                </div>
                <div @click.stop="window.location.href=`tel:${item.contact}`" style="font-size: 20px; color: #fff; background: #ff6600; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;"><van-icon name="phone" /></div>
              </div>
              <div style="display: flex; align-items: center; margin-bottom: 8px; color: #666; font-size: 14px; gap: 8px;">
                <span><van-icon name="clock-o" /> {{ formatDate(item.date) }}</span>
                <span>{{ item.seats }}座</span>
                <span style="color: #000; font-size: 18px; font-weight: bold; margin-left: 5px;">¥{{ item.price || '面议' }}</span>
              </div>
              <div v-if="item.remark" style="font-size: 13px; color: #999; background: #f8f8f8; padding: 8px; border-radius: 6px;">{{ item.remark }}</div>
            </div>
          </van-list>
      </van-skeleton>
    </van-pull-refresh>
    <TabBar />
  </div>
</template>
