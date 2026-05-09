<script setup>
import { reactive, ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useUserStore } from '../store/user';
import { useSystemStore } from '../store/system';
import { postRide, fetchRides, deleteRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast, showDialog, showToast } from 'vant';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const systemStore = useSystemStore();

const postForm = reactive({
  type: 'driver',
  origin: '',
  destination: '',
  date: '',
  dateDisplay: '',
  seats: 1,
  price: '',
  remark: [],
  contact: '',
  car_model: '油车'
});

const submitLoading = ref(false);
const showDatePicker = ref(false);
const showSeatsPicker = ref(false);
const showMapSelector = ref(false);
const selectedDateValues = ref([]);
const mapSearchKeyword = ref('');
const mapSearchResults = ref([]);
const currentMapField = ref(''); 
const editId = ref(route.query.edit || '');

const seatColumns = Array.from({ length: 6 }, (_, i) => ({ text: `${i + 1}人`, value: i + 1 }));

const initCurrentTime = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  selectedDateValues.value = [y, m, d, h];
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`;
};

// 终极地图加载检查
const checkAMap = (callback, retry = 0) => {
  if (window.AMap && window.AMap.Geolocation) {
    callback();
  } else if (retry < 10) {
    setTimeout(() => checkAMap(callback, retry + 1), 500);
  } else {
    showToast('地图插件加载超时，请刷新页面');
  }
};

onMounted(async () => {
  if (editId.value) {
    showLoadingToast('正在加载原行程...');
    try {
      const data = await fetchRides('all');
      const item = data.results.find(r => String(r.id) === String(editId.value));
      if (item) {
        Object.assign(postForm, {
          type: item.type,
          origin: item.origin,
          destination: item.destination,
          seats: item.seats,
          price: item.price,
          contact: item.contact,
          car_model: item.car_model || '油车',
          remark: (item.remark || '').split('，').filter(Boolean)
        });
        // 恢复时间显示
        const d = new Date(item.date);
        postForm.dateDisplay = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${d.getHours()}点`;
        postForm.date = item.date;
      }
    } catch (e) {
      showToast('加载失败');
    } finally {
      closeToast();
    }
  } else {
    initCurrentTime();
    checkAMap(() => {
      autoLocate();
    });
  }
});

const autoLocate = () => {
  if (!window.AMap) return;
  
  window.AMap.plugin('AMap.Geolocation', function() {
    const geolocation = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      extensions: 'all'
    });
    
    geolocation.getCurrentPosition((status, result) => {
      if (status === 'complete') {
        const addr = result.addressComponent;
        const city = addr.city || addr.province || '';
        const district = addr.district || '';
        const township = addr.township || '';
        const street = addr.street || '';
        
        const formattedAddr = [city, district, township, street]
          .filter(Boolean)
          .join('')
          .replace(/.*省/, ''); 
          
        postForm.origin = formattedAddr;
      } else {
        // 降级使用城市定位
        window.AMap.plugin('AMap.CitySearch', function() {
          const citySearch = new window.AMap.CitySearch();
          citySearch.getLocalCity((s, r) => {
            if (s === 'complete' && r.info === 'OK') {
              postForm.origin = r.city;
            } else {
              showToast('自动定位失败，请手动输入');
            }
          });
        });
      }
    });
  });
};

const openMap = (field) => {
  currentMapField.value = field;
  showMapSelector.value = true;
  mapSearchKeyword.value = '';
  mapSearchResults.value = [];
};

watch(mapSearchKeyword, (val) => {
  if (val && window.AMap) {
    window.AMap.plugin('AMap.AutoComplete', function() {
      const auto = new window.AMap.AutoComplete({ city: '全国' });
      auto.search(val, (status, result) => {
        if (status === 'complete' && result.tips) {
          mapSearchResults.value = result.tips.filter(t => t.location);
        } else {
          mapSearchResults.value = [];
        }
      });
    });
  } else {
    mapSearchResults.value = [];
  }
});

const selectMapResult = (item) => {
  if (currentMapField.value === 'origin') postForm.origin = item.name;
  else postForm.destination = item.name;
  showMapSelector.value = false;
};

const getCarModelStyle = (model) => {
  if (!model) return {};
  if (model.includes('电')) return { color: '#07c160', fontWeight: 'bold' }; // 绿色
  if (model.includes('混动') || model.includes('黄色')) return { color: '#edc30e', fontWeight: 'bold' }; // 黄色
  return { color: '#ee0a24', fontWeight: 'bold' }; // 油车-红色
};

const currentRemarkOptions = computed(() => {
  const str = postForm.type === 'driver' ? systemStore.sysConfig.tags_driver : systemStore.sysConfig.tags_passenger;
  return (str || '').split(',').filter(Boolean);
});

const remarkDisplayText = computed(() => (postForm.remark || []).join('，'));

const dateColumns = computed(() => {
  const now = new Date();
  const y = now.getFullYear();
  const years = [{ text: `${y}年`, value: y }, { text: `${y+1}年`, value: y+1 }];
  const months = Array.from({length: 12}, (_, i) => ({ text: `${i+1}月`, value: i+1 }));
  const days = Array.from({length: 31}, (_, i) => ({ text: `${i+1}日`, value: i+1 }));
  const hours = Array.from({length: 24}, (_, i) => ({ text: `${i}点`, value: i }));
  return [years, months, days, hours];
});

const onConfirmDate = ({ selectedOptions }) => {
  const v = selectedOptions.map(o => o.value);
  postForm.dateDisplay = `${v[0]}年${v[1]}月${v[2]}日 ${v[3]}点`;
  postForm.date = `${v[0]}-${String(v[1]).padStart(2, '0')}-${String(v[2]).padStart(2, '0')}T${String(v[3]).padStart(2, '0')}:00:00`;
  showDatePicker.value = false;
};

const onConfirmSeats = ({ selectedOptions }) => {
  postForm.seats = selectedOptions[0].value;
  showSeatsPicker.value = false;
};

const toggleRemark = (t) => {
  const i = postForm.remark.indexOf(t);
  if (i > -1) postForm.remark.splice(i, 1);
  else postForm.remark.push(t);
};

const onPreSubmit = () => {
  if (!postForm.origin || !postForm.destination) return showToast('请完善路线');
  if (!postForm.contact || postForm.contact.length !== 11) return showToast('请输入11位手机号');
  
  const fee = systemStore.sysConfig.publish_fee;
  const topFee = systemStore.sysConfig.top_fee;
  
  showDialog({
    title: '发布确认',
    message: `本次发布费用：${fee}元\n如需置顶需额外支付：${topFee}元\n是否确认发布？`,
    showCancelButton: true,
  }).then(() => {
    handlePublish();
  }).catch(() => {});
};

const handlePublish = async () => {
  submitLoading.value = true;
  showLoadingToast('发布中...');
  try {
    const data = {
      ...postForm,
      user_id: userStore.userProfile.id,
      remark: postForm.remark.join('，') || '无备注'
    };
    await postRide(data);
    
    // 如果是编辑模式，发布成功后删除旧行程
    if (editId.value) {
      try {
        await deleteRide(editId.value, userStore.userProfile.id);
      } catch (e) {
        console.error('Delete old ride failed:', e);
      }
    }
    
    showSuccessToast(editId.value ? '修改成功' : '发布成功');
    router.push('/');
  } catch (e) {
    showFailToast('发布失败');
  } finally {
    submitLoading.value = false;
  }
};
</script>

<template>
  <div class="page-post">
    <van-nav-bar title="发布行程" left-arrow @click-left="router.back()" />
    
    <div class="post-card">
      <van-tabs v-model:active="postForm.type" type="card" style="margin-bottom: 20px;">
        <van-tab title="车找人" name="driver" />
        <van-tab title="人找车" name="passenger" />
      </van-tabs>

      <van-cell-group inset class="form-group">
        <van-cell title="起点" is-link @click="openMap('origin')" required class="clickable-cell">
          <template #value>
            <span :class="{ 'placeholder-text': !postForm.origin }">{{ postForm.origin || '点击定位或手动输入' }}</span>
          </template>
          <template #right-icon>
            <van-button size="mini" type="primary" plain @click.stop="autoLocate">定位</van-button>
          </template>
        </van-cell>

        <van-cell title="终点" is-link @click="openMap('destination')" required class="clickable-cell">
          <template #value>
            <span :class="{ 'placeholder-text': !postForm.destination }">{{ postForm.destination || '点击选择目的地' }}</span>
          </template>
        </van-cell>

        <van-cell title="出发时间" is-link @click="showDatePicker = true" required>
          <template #value>{{ postForm.dateDisplay }}</template>
        </van-cell>

        <van-cell title="人数/空位" is-link @click="showSeatsPicker = true" required>
          <template #value>{{ postForm.seats }}人</template>
        </van-cell>
        
        <van-field label="车型" v-if="postForm.type === 'driver'">
          <template #input>
            <van-radio-group v-model="postForm.car_model" direction="horizontal">
              <van-radio name="油车"><span :style="getCarModelStyle('油车')">油车</span></van-radio>
              <van-radio name="电车"><span :style="getCarModelStyle('电车')">电车</span></van-radio>
              <van-radio name="油电混动"><span :style="getCarModelStyle('混动')">油电混动</span></van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field v-model="postForm.price" label="费用" type="digit" placeholder="元/人 (不填为面议)" />
        <van-field v-model="postForm.contact" label="联系电话" type="tel" maxlength="11" placeholder="请输入11位手机号" required />
      </van-cell-group>

      <div class="remark-section">
        <div class="label">快捷备注 (仅限勾选)</div>
        <div class="tags-group">
          <div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">
            {{ t }}
          </div>
        </div>
        <div class="remark-preview" v-if="postForm.remark.length">已选：{{ remarkDisplayText }}</div>
      </div>
    </div>

    <div class="bottom-action">
      <van-button round block type="primary" size="large" :loading="submitLoading" @click="onPreSubmit">立即发布</van-button>
    </div>

    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-picker :columns="dateColumns" v-model="selectedDateValues" @confirm="onConfirmDate" @cancel="showDatePicker = false" />
    </van-popup>

    <van-popup v-model:show="showSeatsPicker" position="bottom">
      <van-picker :columns="seatColumns" @confirm="onConfirmSeats" @cancel="showSeatsPicker = false" />
    </van-popup>

    <!-- 地图选择弹窗优化 -->
    <van-popup v-model:show="showMapSelector" position="bottom" style="height: 85%; border-radius: 16px 16px 0 0;" teleport="body">
      <div class="map-selector">
        <van-search v-model="mapSearchKeyword" placeholder="输入城市或具体位置" show-action @cancel="showMapSelector = false" autofocus />
        <div class="search-results">
          <van-cell v-for="item in mapSearchResults" :key="item.id" :title="item.name" :label="item.district + (item.address || '')" @click="selectMapResult(item)" icon="location-o" />
          <div v-if="!mapSearchResults.length && mapSearchKeyword" class="no-result">未找到相关位置</div>
          <div v-if="!mapSearchKeyword" class="map-tip">请输入关键词搜索位置</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.page-post { padding-bottom: 100px; background: #f7f8fa; min-height: 100vh; }
.post-card { padding: 15px; }
.form-group { margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.clickable-cell { cursor: pointer; }
.placeholder-text { color: #ccc; }
.remark-section { margin-top: 25px; padding: 0 15px; }
.remark-section .label { font-size: 18px; font-weight: bold; color: #323233; margin-bottom: 15px; }
.tags-group { display: flex; flex-wrap: wrap; gap: 10px; }
.tag-item { padding: 6px 15px; background: #fff; border-radius: 8px; font-size: 16px; color: #646566; border: 1px solid #ebedf0; }
.tag-item.active { background: #eef5fe; color: #1989fa; border-color: #1989fa; font-weight: bold; }
.remark-preview { margin-top: 12px; font-size: 14px; color: #969799; font-style: italic; }
.bottom-action { padding: 20px; position: fixed; bottom: 50px; left: 0; right: 0; background: #fff; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 100; }
.map-selector { display: flex; flex-direction: column; height: 100%; background: #fff; }
.search-results { flex: 1; overflow-y: auto; padding-bottom: 20px; }
.no-result, .map-tip { text-align: center; padding: 60px; color: #969799; font-size: 14px; }
</style>
