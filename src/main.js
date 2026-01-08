import { createApp } from 'vue'
import App from './App.vue'

// 1. 引入 Vant 样式 (这行非常重要，否则样式会乱)
import 'vant/lib/index.css'

// 2. 创建应用
const app = createApp(App)

// 3. 挂载
app.mount('#app')
