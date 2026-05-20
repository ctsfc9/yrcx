<template>
  <div style="display: flex; min-height: 100vh; background: #f0f2f5;">
    <div style="width: 200px; background: #2f3447; color: #fff;">
      <div style="padding:20px; text-align:center; font-weight:bold;">管理中心</div>
      <van-cell title="系统配置" @click="tab='base'" clickable style="background:transparent; color:#fff;" />
      <van-cell title="内容管理" @click="tab='content'" clickable style="background:transparent; color:#fff;" />
      <van-cell title="用户行程" @click="tab='data'" clickable style="background:transparent; color:#fff;" />
    </div>

    <div style="flex: 1; padding: 20px;">
      <div style="background: #fff; padding: 20px; border-radius: 8px;">
        <div v-if="tab === 'base'">
          <van-field v-model="config.amap_key" label="高德Key" />
          <van-field v-model="config.wx_appid" label="微信AppID" />
          <van-field v-model="config.hot_cities" label="热门城市" />
          <van-button type="primary" block @click="save">保存</van-button>
        </div>
        <div v-if="tab === 'content'">
          <van-field v-model="config.notice" label="首页公告" type="textarea" />
          <van-button type="primary" block @click="save">更新公告</van-button>
        </div>
        <div v-if="tab === 'data'">
           <van-cell v-for="r in rides" :key="r.id" :title="r.origin+'->'+r.destination" value="删除" @click="delRide(r.id)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showSuccessToast } from 'vant';

const tab = ref('base');
const config = ref({ amap_key: '', wx_appid: '', hot_cities: '', notice: '' });
const rides = ref([]);

const fetchData = async () => {
  // 核心：请求同一个全量接口，防止数据丢失
  const res = await fetch('/api/admin/all'); 
  const data = await res.json();
  config.value = data.config;
  rides.value = data.rides;
};

const save = async () => {
  await fetch('/api/admin/save', { method: 'POST', body: JSON.stringify(config.value) });
  showSuccessToast('已保存');
};

const delRide = async (id) => {
  await fetch('/api/admin/rides/'+id, { method: 'DELETE' });
  fetchData();
};

onMounted(fetchData);
</script>
