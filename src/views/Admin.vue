<template>
  <div style="display: flex; min-height: 100vh; background: #f0f2f5;">
    <div style="width: 200px; background: #2f3447; color: #fff;">
      <div style="padding: 20px; font-weight: bold; text-align: center; border-bottom: 1px solid #3d445c;">管理后台</div>
      <van-cell title="基础通讯配置" @click="tab = 'base'" style="background:transparent; color:#fff;" />
      <van-cell title="轮播与公告" @click="tab = 'ui'" style="background:transparent; color:#fff;" />
      <van-cell title="行程与用户管理" @click="tab = 'manage'" style="background:transparent; color:#fff;" />
    </div>

    <div style="flex: 1; padding: 20px;">
      <div style="background: #fff; padding: 20px; border-radius: 8px;">
        
        <div v-if="tab === 'base'">
          <van-field v-model="config.amap_key" label="高德Key" placeholder="请输入Key" />
          <van-field v-model="config.wx_appid" label="微信AppID" />
          <van-field v-model="config.hot_cities" label="热门城市" placeholder="用逗号分隔，例如: 北京,上海" />
          <van-button type="primary" block @click="save">保存基础配置</van-button>
        </div>

        <div v-if="tab === 'ui'">
          <van-field v-model="config.notice" label="首页公告" type="textarea" />
          <van-button type="primary" block @click="save">保存轮播公告</van-button>
        </div>

        <div v-if="tab === 'manage'">
          <van-tabs v-model:active="subTab">
            <van-tab title="行程管理">
              <van-list>
                <van-cell v-for="item in rides" :key="item.id" :title="item.origin+'->'+item.destination">
                  <template #right-icon>
                    <van-button size="small" type="danger" @click="deleteItem(item.id)">删除</van-button>
                  </template>
                </van-cell>
              </van-list>
            </van-tab>
            <van-tab title="用户封禁">
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showSuccessToast } from 'vant';

const tab = ref('base');
const subTab = ref(0);
const config = ref({ amap_key: '', wx_appid: '', hot_cities: '', notice: '' });
const rides = ref([]);
const users = ref([]);

const fetchData = async () => {
  // 保持逻辑简洁，从后端拉取完整状态
  const res = await fetch('/api/admin/all');
  const data = await res.json();
  config.value = data.config;
  rides.value = data.rides;
  users.value = data.users;
};

const save = async () => {
  await fetch('/api/admin/save', { method: 'POST', body: JSON.stringify(config.value) });
  showSuccessToast('保存成功');
};

const deleteItem = async (id) => {
  await fetch(`/api/admin/rides/${id}`, { method: 'DELETE' });
  fetchData();
};

const toggleBan = async (id) => {
  await fetch(`/api/admin/ban/${id}`, { method: 'POST' });
  fetchData();
};

onMounted(fetchData);
</script>
