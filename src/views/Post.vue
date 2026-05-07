<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { useSystemStore } from '../store/system';
import { postRide } from '../api';
import { showSuccessToast, showFailToast, showLoadingToast } from 'vant';
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
const selectedDateValues = ref([]);

// 初始化时间为当前时间
const initCurrentTime = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  
  // 设置选择器的初始选中值
  selectedDateValues.value = [y, m, d, h];
  
  // 设置表单显示的默认值
  postForm.dateDisplay = `${y}年${m}月${d}日 ${h}点`;
  postForm.date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`;
};

onMounted(() => {
  initCurrentTime();
});

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

const toggleRemark = (t) => {
  const i = postForm.remark.indexOf(t);
  if (i > -1) postForm.remark.splice(i, 1);
  else postForm.remark.push(t);
};

const onSubmit = async () => {
  if (!postForm.origin || !postForm.destination) {
    showFailToast('请完善路线');
    return;
  }
  
  submitLoading.value = true;
  showLoadingToast('发布中...');
  
  try {
    const data = {
      ...postForm,
      user_id: userStore.userProfile.id,
      contact: userStore.userProfile.phone || postForm.contact,
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
      <van-tabs v-model:active="postForm.type" type="card" style="margin-bottom: 15px;">
        <van-tab title="车找人" name="driver" />
        <van-tab title="人找车" name="passenger" />
      </van-tabs>

      <van-cell-group inset>
        <van-field v-model="postForm.origin" label="起点" placeholder="请输入起点" required />
        <van-field v-model="postForm.destination" label="终点" placeholder="请输入终点" required />
        <van-field v-model="postForm.dateDisplay" label="时间" placeholder="点击选择时间" readonly @click="showDatePicker = true" required />
        <van-field label="座位">
          <template #input>
            <van-radio-group v-model="postForm.seats" direction="horizontal">
              <van-radio v-for="n in 4" :key="n" :name="n">{{ n }}座</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="postForm.price" label="费用" type="digit" placeholder="元 (不填为面议)" />
        <van-field v-model="postForm.contact" label="联系电话" type="tel" placeholder="请输入联系电话" />
      </van-cell-group>

      <div class="remark-section">
        <div class="label">快捷备注</div>
        <div class="tags-group">
          <div v-for="t in currentRemarkOptions" :key="t" class="tag-item" :class="{active: postForm.remark.includes(t)}" @click="toggleRemark(t)">
            {{ t }}
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-action">
      <van-button round block type="primary" :loading="submitLoading" @click="onSubmit">立即发布</van-button>
    </div>

    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-picker 
        :columns="dateColumns" 
        v-model="selectedDateValues"
        @confirm="onConfirmDate" 
        @cancel="showDatePicker = false" 
      />
    </van-popup>
  </div>
</template>

<style scoped>
.post-card { padding: 15px; }
.remark-section { margin-top: 20px; padding: 0 15px; }
.remark-section .label { font-size: 14px; color: #646566; margin-bottom: 10px; }
.tags-group { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-item { padding: 4px 12px; background: #f7f8fa; border-radius: 4px; font-size: 12px; color: #666; border: 1px solid #ebedf0; }
.tag-item.active { background: #eef5fe; color: #1989fa; border-color: #1989fa; }
.bottom-action { padding: 20px; position: fixed; bottom: 50px; left: 0; right: 0; background: #fff; }
</style>
