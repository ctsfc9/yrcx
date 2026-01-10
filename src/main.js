import { createApp } from 'vue'
import App from './App.vue'

// 1. 引入 Vant 组件库
import Vant from 'vant';
// 2. ★★★ 关键：必须引入 Vant 的 CSS 样式，否则白屏或样式错乱 ★★★
import 'vant/lib/index.css';

const app = createApp(App);

// 3. 注册 Vant
app.use(Vant);

// 4. 挂载到 #app
app.mount('#app');
