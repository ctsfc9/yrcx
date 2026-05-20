<template>
  <div style="display: flex; min-height: 100vh; background: #f0f2f5;">
    <div style="width: 200px; background: #2f3447; color: #fff;">
      <div style="padding: 20px; font-weight: bold; text-align: center; border-bottom: 1px solid #3d445c;">管理后台</div>
      <van-cell title="基础通讯配置" @click="tab = 'base'" style="background:transparent; color:#fff;" clickable />
      <van-cell title="轮播与公告" @click="tab = 'ui'" style="background:transparent; color:#fff;" clickable />
      <van-cell title="数据管理" @click="tab = 'manage'" style="background:transparent; color:#fff;" clickable />
    </div>

    <div style="flex: 1; padding: 20px;">
      <div style="background: #fff; padding: 20px; border-radius: 8px;">
        <div v-if="tab === 'base'">
          <van-field v-model="config.amap_key" label="高德Key" />
          <van-field v-model="config.wx_appid" label="微信AppID" />
          <van-field v-model="config.hot_cities" label="热门城市" placeholder="北京,上海" />
          <van-button type="primary" block @click="save">保存配置</van-button>
        </div>
        <div v-if="tab === 'manage'">
          <van-tabs v-model:active="subTab">
            <van-tab title="行程管理">
              <van-cell v-for="item in rides" :key="item.id" :title="item.origin+'->'+item.destination">
                <template #right-icon><van-button size="small" type="danger" @click="deleteItem(item.id)">删除</van-button></template>
              </van-cell>
            </van-tab>
          </van-tabs>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showToast } from 'vant';

const tab = ref('base');
const subTab = ref(0);
const config = ref({ amap_key: '', wx_appid: '', hot_cities: '' });
const rides = ref([]);

const fetchData = async () => {
  try {
    const res = await fetch('/api/admin/all');
    if (!res.ok) throw new Error();
    const data = await res.json();
    config.value = data.config || {};
    rides.value = data.rides || [];
  } catch (e) {
    console.warn("接口未就绪，使用默认配置");
  }
};

const save = () => showToast('已触发保存逻辑');
const deleteItem = (id) => showToast('删除ID: ' + id);

onMounted(fetchData);
</script>
