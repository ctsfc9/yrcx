<template>
  <div style="display: flex; min-height: 100vh; background: #f0f2f5;">
    <div style="width: 200px; background: #2f3447; color: #fff;">
      <div style="padding: 20px; font-weight: bold; font-size: 18px; text-align: center;">管理后台</div>
      <van-cell-group style="background: transparent;">
        <van-cell title="基础通讯配置" @click="tab = 'base'" clickable />
        <van-cell title="轮播与公告" @click="tab = 'ui'" clickable />
        <van-cell title="用户行程管理" @click="tab = 'manage'" clickable />
      </van-cell-group>
    </div>

    <div style="flex: 1; padding: 20px;">
      <div v-if="tab === 'base'">
        <van-field v-model="config.amap_key" label="高德Key" />
        <van-field v-model="config.wx_appid" label="微信AppID" />
        <van-field v-model="config.hot_cities" label="热门城市" placeholder="北京,上海,成都" />
        <van-button type="primary" block @click="save">保存所有配置</van-button>
      </div>

      <div v-if="tab === 'manage'">
        <van-list>
          <van-cell v-for="item in rides" :key="item.id" :title="item.origin+'->'+item.destination">
            <template #right-icon>
              <van-button size="small" type="danger" @click="deleteItem(item.id)">删除</van-button>
            </template>
          </van-cell>
        </van-list>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showSuccessToast } from 'vant';

const tab = ref('base');
const config = ref({ amap_key: '', wx_appid: '', hot_cities: '' });
const rides = ref([]);

const fetchData = async () => {
  const res = await fetch('/api/admin/all');
  const data = await res.json();
  config.value = data.config;
  rides.value = data.rides;
};

const save = async () => {
  await fetch('/api/admin/save', { method: 'POST', body: JSON.stringify(config.value) });
  showSuccessToast('配置已保存');
};

const deleteItem = async (id) => {
  await fetch(`/api/admin/rides/${id}`, { method: 'DELETE' });
  fetchData();
};

onMounted(fetchData);
</script>
