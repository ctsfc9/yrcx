<template>
  <div style="padding: 10px; background: #f7f8fa; min-height: 100vh;">
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between;">
      <div v-for="item in rides.slice(0, 8)" :key="item.id" 
           style="width: 48%; background: #fff; margin-bottom: 10px; padding: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="font-weight: bold; font-size: 14px;">{{ item.origin }} ➡️ {{ item.destination }}</div>
        <div style="color: #666; font-size: 12px; margin-top: 5px;">时间: {{ item.date }}</div>
      </div>
    </div>
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const rides = ref([]);
onMounted(async () => {
  const res = await fetch('/api/rides');
  rides.value = await res.json();
});
</script>
