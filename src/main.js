import { createApp } from 'vue'
import App from './App.vue'

// 1. 必须引入 Vant 的样式文件，否则组件不显示或白屏
import 'vant/lib/index.css'

const app = createApp(App)
app.mount('#app')
