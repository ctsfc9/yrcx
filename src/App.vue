<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './store'

const store = useAppStore()
onMounted(() => {
  store.loadConfig() // APP启动时拉取全局配置
})
</script>

<template>
  <router-view />
</template>
