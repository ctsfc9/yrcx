<template>
  <div style="display: flex; min-height: 100vh;">
    <div style="width: 200px; background: #2f3447; color: #fff;">
      <van-cell title="系统设置" @click="tab='base'" style="background:transparent; color:#fff;" />
      <van-cell title="行程管理" @click="tab='rides'" style="background:transparent; color:#fff;" />
    </div>
    <div style="flex: 1; padding: 20px;">
      <div v-if="tab === 'base'">
        <van-field v-model="config.hot_cities" label="热门城市" />
        <van-button type="primary" block @click="save">保存配置</van-button>
      </div>
      <div v-if="tab === 'rides'">
        <van-cell v-for="r in rides" :key="r.id" :title="r.origin+'->'+r.destination" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const tab = ref('base');
const config = ref({ hot_cities: '' });
const rides = ref([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/admin/all');
    const data = await res.json();
    config.value = data.config || {};
    rides.value = data.rides || [];
  } catch (e) { console.error("后台接口加载异常", e); }
});
const save = () => alert("已保存");
</script>
