<template>
  <div style="padding: 20px;">
    <h2>宜人出行后台管理</h2>
    <van-tabs v-model:active="activeTab">
      <van-tab title="全局配置">
        <van-field v-model="config.hot_cities" label="热门城市" placeholder="城市A,城市B" />
        <van-button type="primary" block @click="saveConfig">保存配置</van-button>
      </van-tab>
      
      <van-tab title="行程管理">
        <van-list>
          <van-cell v-for="item in allRides" :key="item.id" :title="`${item.origin} -> ${item.destination}`" :label="item.nickname">
            <template #right-icon>
              <van-button size="small" type="danger" @click="deleteRide(item.id)">删除</van-button>
            </template>
          </van-cell>
        </van-list>
      </van-tab>

      <van-tab title="用户管理">
        <van-cell v-for="u in users" :key="u.id" :title="u.nickname" :value="u.is_banned ? '已封禁' : '正常'">
          <template #right-icon>
            <van-button size="small" :type="u.is_banned ? 'primary' : 'danger'" @click="toggleBan(u.id)">
              {{ u.is_banned ? '解封' : '封禁' }}
            </van-button>
          </template>
        </van-cell>
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showSuccessToast } from 'vant';

const activeTab = ref(0);
const allRides = ref([]);
const users = ref([]);
const config = ref({});

const fetchData = async () => {
  // 模拟请求后台接口
  const res = await fetch('/api/admin/data');
  const data = await res.json();
  allRides.value = data.rides;
  users.value = data.users;
  config.value = data.config;
};

const deleteRide = async (id) => {
  await fetch(`/api/admin/rides/${id}`, { method: 'DELETE' });
  fetchData();
  showSuccessToast('删除成功');
};

const toggleBan = async (uid) => {
  await fetch(`/api/admin/ban/${uid}`, { method: 'POST' });
  fetchData();
};

onMounted(fetchData);
</script>
