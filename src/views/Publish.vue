<template>
  <div class="publish-container">
    <van-nav-bar title="发布行程" left-arrow @click-left="onClickLeft" />

    <van-form @submit="onSubmit">
      <van-field name="type" label="我是">
        <template #input>
          <van-radio-group v-model="form.type" direction="horizontal">
            <van-radio name="driver">车主</van-radio>
            <van-radio name="passenger">乘客</van-radio>
          </van-radio-group>
        </template>
      </van-field>

      <van-field
        v-model="form.origin"
        is-link
        readonly
        name="origin"
        label="出发地"
        placeholder="正在获取位置..."
        @click="showOriginPicker = true"
        :rules="[{ required: true, message: '请选择出发地' }]"
      >
        <template #button>
           <van-button size="small" type="primary" plain @click.stop="getLocation">重新定位</van-button>
        </template>
      </van-field>
      <van-popup v-model:show="showOriginPicker" position="bottom">
        <van-picker
          title="选择出发地"
          :columns="cityColumns"
          @confirm="onConfirmOrigin"
          @cancel="showOriginPicker = false"
        />
      </van-popup>

      <van-field
        v-model="form.destination"
        is-link
        readonly
        name="destination"
        label="目的地"
        placeholder="点击选择目的地"
        @click="showDestPicker = true"
        :rules="[{ required: true, message: '请选择目的地' }]"
      />
      <van-popup v-model:show="showDestPicker" position="bottom">
        <van-picker
          title="选择目的地"
          :columns="cityColumns"
          @confirm="onConfirmDest"
          @cancel="showDestPicker = false"
        />
      </van-popup>

      <van-field
        v-model="form.date"
        name="date"
        label="出发时间"
        type="datetime-local"
        :rules="[{ required: true, message: '请填写出发时间' }]"
      />

      <van-field name="seats" :label="form.type === 'driver' ? '提供座位' : '乘车人数'">
        <template #input>
          <van-stepper v-model="form.seats" min="1" max="6" />
        </template>
      </van-field>

      <template v-if="form.type === 'driver'">
        <van-field
          v-model="form.car_model"
          is-link
          readonly
          name="car_model"
          label="车型"
          placeholder="点击选择车型"
          @click="showCarModelPicker = true"
        />
        <van-popup v-model:show="showCarModelPicker" position="bottom">
          <van-picker
            :columns="carModelColumns"
            @confirm="onConfirmCarModel"
            @cancel="showCarModelPicker = false"
          />
        </van-popup>
      </template>

      <van-field
        v-model="form.price"
        name="price"
        label="期望价格"
        type="digit"
        placeholder="请输入金额 (元)"
        :rules="[{ required: true, message: '请输入价格' }]"
      >
        <template #extra>元</template>
      </van-field>

      <van-field
        v-model="form.contact"
        name="contact"
        label="联系电话"
        type="tel"
        placeholder="请输入您的手机号"
        :rules="[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误' }]"
      />

      <van-field
        v-model="form.remark"
        name="remark"
        label="备注"
        type="textarea"
        placeholder="可填写行李大小、上车地点、是否走高速等"
        rows="2"
        autosize
        maxlength="100"
        show-word-limit
      />

      <div style="margin: 32px 16px;">
        <van-button round block type="primary" native-type="submit" size="large">
          确认发布
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, closeToast, showSuccessToast, showFailToast, showToast } from 'vant'

const router = useRouter()

// --- 1. 获取当前时间并格式化，作为默认时间 ---
const getNowStr = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}` // datetime-local 要求的格式
}

// 自动读取上次填写的手机号（优先从个人中心或本地缓存获取）
const defaultPhone = localStorage.getItem('yrcx_user_phone') || ''

// --- 表单数据 ---
const form = ref({
  type: 'driver',
  origin: '',
  destination: '',
  date: getNowStr(), // 默认赋值为当前时间
  seats: 1,
  price: '',
  remark: '',
  contact: defaultPhone, 
  car_model: '轿车'
})

// --- 2. 车型配置 (已增加油电混动) ---
const showCarModelPicker = ref(false)
const carModelColumns = [
  { text: '轿车', value: '轿车' },
  { text: 'SUV', value: 'SUV' },
  { text: 'MPV', value: 'MPV' },
  { text: '油电混动', value: '油电混动' },
  { text: '纯电动', value: '纯电动' }
]
const onConfirmCarModel = ({ selectedOptions }) => {
  form.value.car_model = selectedOptions[0].value
  showCarModelPicker.value = false
}

// --- 3. 城市选择器配置 (🌟 常用城市置顶) ---
const showOriginPicker = ref(false)
const showDestPicker = ref(false)
const cityColumns = [
  {
    text: '🌟 常用城市',
    children: [
      { text: '成都市', value: '成都市' },
      { text: '绵阳市', value: '绵阳市' },
      { text: '南充市', value: '南充市' },
      { text: '巴中市', value: '巴中市' },
      { text: '达州市', value: '达州市' }
    ]
  },
  {
    text: '四川省',
    children: [
      { text: '成都市', value: '成都市' },
      { text: '绵阳市', value: '绵阳市' },
      { text: '自贡市', value: '自贡市' },
      { text: '攀枝花市', value: '攀枝花市' },
      { text: '泸州市', value: '泸州市' },
      { text: '德阳市', value: '德阳市' },
      { text: '广元市', value: '广元市' },
      { text: '遂宁市', value: '遂宁市' },
      { text: '内江市', value: '内江市' },
      { text: '乐山市', value: '乐山市' },
      { text: '南充市', value: '南充市' },
      { text: '眉山市', value: '眉山市' },
      { text: '宜宾市', value: '宜宾市' },
      { text: '广安市', value: '广安市' },
      { text: '达州市', value: '达州市' },
      { text: '雅安市', value: '雅安市' },
      { text: '巴中市', value: '巴中市' },
      { text: '资阳市', value: '资阳市' }
    ]
  }
]

const onConfirmOrigin = ({ selectedOptions }) => {
  form.value.origin = selectedOptions[1]?.value || selectedOptions[0]?.value
  showOriginPicker.value = false
}
const onConfirmDest = ({ selectedOptions }) => {
  form.value.destination = selectedOptions[1]?.value || selectedOptions[0]?.value
  showDestPicker.value = false
}

// --- 4. 安全的高德定位 (带超时防卡死) ---
const getLocation = () => {
  showLoadingToast({ message: '精确定位中...', forbidClick: true, duration: 0 })
  
  if (window.AMap && window.AMap.Geolocation) {
    const geolocation = new window.AMap.Geolocation({
      enableHighAccuracy: true, // 设置为高精度
      timeout: 4000,            // 🌟 核心：4秒超时，绝不无限卡死
      buttonPosition: 'RB',
    })
    
    geolocation.getCurrentPosition((status, result) => {
      closeToast()
      if (status === 'complete' && result.addressComponent) {
        // 优先使用具体的区县，没有区县才用市
        form.value.origin = result.addressComponent.district || result.addressComponent.city || '北京市'
        showToast('已获取当前区县')
      } else {
        console.warn('定位失败，转为手动模式', result)
        form.value.origin = ''
        showToast('自动定位超时，请手动选择')
      }
    })
  } else {
    closeToast()
    form.value.origin = ''
    showToast('未能加载地图，请手动选择城市')
  }
}

// 进入页面时尝试自动定位
onMounted(() => {
  getLocation()
})

const onClickLeft = () => {
  router.back()
}

// --- 5. 提交表单 ---
const onSubmit = async () => {
  try {
    showLoadingToast({ message: '正在发布...', forbidClick: true, duration: 0 })
    
    // 🌟 将本次填写的手机号存在本地缓存，下次进来直接调用
    localStorage.setItem('yrcx_user_phone', form.value.contact)
    
    // 整理要发送到后端的数据
    const postData = {
       ...form.value,
       // 把 HTML5 原生的 T 符号换成空格，保持格式美观：2026-05-15 10:00
       date: form.value.date.replace('T', ' ')
    }

    // 调用 Cloudflare 的后端 API (如果您的代码里统一用 api.post，可以把这里改回 api.post)
    const response = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    })

    const result = await response.json()

    if (!response.ok) {
       throw new Error(result.error || '服务器连接失败')
    }

    closeToast()
    showSuccessToast('发布成功！')
    
    // 延迟跳回首页，让用户看到成功提示
    setTimeout(() => {
      router.push('/')
    }, 1000)
    
  } catch (error) {
    closeToast()
    // 🌟 错误原因弹窗展示，再也不会“点完没反应”了
    showFailToast(error.message || '发布失败，请检查网络')
    console.error('发布错误：', error)
  }
}
</script>

<style scoped>
.publish-container {
  padding-bottom: 20px;
  background-color: #f7f8fa;
  min-height: 100vh;
}
/* 优化表单边距，看起来更专业 */
:deep(.van-cell-group) {
  margin-top: 10px;
}
</style>
