import { createApp } from 'vue';
import App from './App.vue';

// 1. 引入 Vant 全量组件
import Vant from 'vant';
// 2. ★★★ 必须引入样式，否则白屏或布局错乱 ★★★
import 'vant/lib/index.css';

const app = createApp(App);

// 3. 注册 Vant
app.use(Vant);

// 4. 挂载
app.mount('#app');
