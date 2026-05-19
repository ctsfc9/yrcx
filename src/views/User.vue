<script setup>
import { ref, onMounted } from 'vue';
import { useAppStore } from '../store';
import TabBar from '../components/TabBar.vue';

const store = useAppStore();
const myRides = ref([]);

onMounted(async () => {
  if (store.userProfile?.id) {
    const res = await fetch('/api/rides');
    const data = await res.json();
    myRides.value = data.results.filter(r => r.user_id === store.userProfile.id);
  }
});
</script>

<template>
  <div class="user-container">
    <div class="header">
      <img :src="store.userProfile?.avatar" class="avatar" />
      <div class="name">{{ store.userProfile?.nickname || '未登录' }}</div>
    </div>
    <div class="list">
      <div v-for="ride in myRides" :key="ride.id" class="ride-item">
        {{ ride.origin }} -> {{ ride.destination }}
      </div>
    </div>
    <TabBar />
  </div>
</template>

<style scoped>
.user-container { padding: 20px; }
.header { display: flex; align-items: center; margin-bottom: 20px; }
.avatar { width: 50px; height: 50px; border-radius: 50%; }
.ride-item { padding: 10px; border-bottom: 1px solid #eee; }
</style>
