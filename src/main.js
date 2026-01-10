import { createApp } from 'vue'
import App from './App.vue'

// 1. 引入 Vant 组件库
import Vant from 'vant';
// 2. ★★★ 必须引入 Vant 样式，否则白屏 ★★★
import 'vant/lib/index.css';

const app = createApp(App);
app.use(Vant);
app.mount('#app');
