<script setup>
import { ref, onMounted } from 'vue'

const message = ref('正在连接后端...')
const rides = ref([])

onMounted(async () => {
  try {
    // 调用我们稍后创建的后端 API
    const res = await fetch('/api/rides')
    const data = await res.json()
    rides.value = data.results || []
    message.value = '加载成功'
  } catch (e) {
    message.value = '后端连接失败: ' + e.message
  }
})
</script>

<template>
  <h1>拼车平台 (Vue + Pages)</h1>
  <p>状态: {{ message }}</p>
  <ul>
    <li v-for="ride in rides" :key="ride.id">
      {{ ride.origin }} -> {{ ride.destination }} ({{ ride.price }}元)
    </li>
  </ul>
</template>
