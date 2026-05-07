<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useUserStore } from '../store/user';
import { useSystemStore } from '../store/system';
import { postRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast, showDialog, showToast } from 'vant';
import { useRouter } from 'vue-router';

const router = useRouter();
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

onMounted(() => {
  initCurrentTime();
  loadAMap();
});

const loadAMap = () => {
  if (window.AMap) {
    autoLocateOrigin();
    return;
  }
  // 注入安全密钥
  window._AMapSecurityConfig = { securityJsCode: 'f6c5bf3568831b3f4b5f3ae35d9bfa08' };
  const script = document.createElement('script');
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${systemStore.sysConfig.amap_key}&plugin=AMap.AutoComplete,AMap.PlaceSearch,AMap.Geolocation,AMap.CitySearch`;
  script.onload = () => {
    autoLocateOrigin();
  };
  document.body.appendChild(script);
};

const autoLocateOrigin = () => {
  if (!window.AMap) return;
  AMap.plugin(['AMap.Geolocation', 'AMap.CitySearch'], function() {
    const citySearch = new AMap.CitySearch();
    citySearch.getLocalCity((status, result) => {
      if (status === 'complete' && result.info === 'OK') {
        if (!postForm.origin) postForm.origin = result.city;
      }
    });
    
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 5000,
      buttonPosition: 'RB'
    });
    geolocation.getCurrentPosition((status, result) => {
      if (status === 'complete') {
        const addr = result.addressComponent;
        postForm.origin = addr.district + addr.township + (addr.street || '');
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
    AMap.plugin('AMap.AutoComplete', () => {
      const auto = new AMap.AutoComplete({ city: '全国' });
      auto.search(val, (status, result) => {
        if (status === 'complete' && result.tips) {
          mapSearchResults.value = result.tips.filter(t => t.location);
        }
      });
    });
  }
});

const selectMapResult = (item) => {
  if (currentMapField.value === 'origin') postForm.origin = item.name;
  else postForm.destination = item.name;
  showMapSelector.value = false;
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
    showSuccessToast('发布成功');
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
    <van-nav-bar title="发布行程" />
    
    <div class="post-card">
      <van-tabs v-model:active="postForm.type" type="card" style="margin-bottom: 20px;">
        <van-tab title="车找人" name="driver" />
        <van-tab title="人找车" name="passenger" />
      </van-tabs>

      <van-cell-group inset class="form-group">
        <!-- 修复：点击输入框拉起地图 -->
        <van-field v-model="postForm.origin" label="起点" placeholder="点击定位或手动输入" readonly @click="openMap('origin')" required>
          <template #button>
            <van-button size="small" type="primary" plain @click.stop="autoLocateOrigin">自动定位</van-button>
          </template>
        </van-field>
        <van-field v-model="postForm.destination" label="终点" placeholder="点击选择目的地" readonly @click="openMap('destination')" required />
        <van-field v-model="postForm.dateDisplay" label="出发时间" placeholder="点击选择时间" readonly @click="showDatePicker = true" required />
        <van-field :model-value="postForm.seats + '人'" label="人数/空位" placeholder="点击选择人数" readonly @click="showSeatsPicker = true" required />
        
        <van-field label="车型" v-if="postForm.type === 'driver'">
          <template #input>
            <van-radio-group v-model="postForm.car_model" direction="horizontal">
              <van-radio name="油车">油车</van-radio>
              <van-radio name="电车">电车</van-radio>
              <van-radio name="油电混合">混合</van-radio>
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

    <van-popup v-model:show="showMapSelector" position="bottom" style="height: 80%">
      <div class="map-selector">
        <van-search v-model="mapSearchKeyword" placeholder="输入城市或具体位置" show-action @cancel="showMapSelector = false" />
        <div class="search-results">
          <van-cell v-for="item in mapSearchResults" :key="item.id" :title="item.name" :label="item.district + item.address" @click="selectMapResult(item)" />
          <div v-if="!mapSearchResults.length && mapSearchKeyword" class="no-result">未找到相关位置</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.page-post { padding-bottom: 100px; }
.post-card { padding: 15px; }
.form-group { margin-bottom: 20px; }
.remark-section { margin-top: 25px; padding: 0 15px; }
.remark-section .label { font-size: 18px; font-weight: bold; color: #323233; margin-bottom: 15px; }
.tags-group { display: flex; flex-wrap: wrap; gap: 10px; }
.tag-item { padding: 6px 15px; background: #f7f8fa; border-radius: 8px; font-size: 16px; color: #646566; border: 1px solid #ebedf0; }
.tag-item.active { background: #eef5fe; color: #1989fa; border-color: #1989fa; font-weight: bold; }
.remark-preview { margin-top: 12px; font-size: 14px; color: #969799; font-style: italic; }
.bottom-action { padding: 20px; position: fixed; bottom: 50px; left: 0; right: 0; background: #fff; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 100; }
.map-selector { display: flex; flex-direction: column; height: 100%; }
.search-results { flex: 1; overflow-y: auto; }
.no-result { text-align: center; padding: 40px; color: #969799; }
</style>
