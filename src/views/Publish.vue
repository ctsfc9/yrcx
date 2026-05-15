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
        label="出发地"
        placeholder="正在自动定位..."
        @click="showOriginPicker = true"
        :rules="[{ required: true, message: '请选择出发地' }]"
      >
        <template #button>
           <van-button size="small" type="primary" plain @click.stop="getLocation">重新定位</van-button>
        </template>
      </van-field>

      <van-field
        v-model="form.destination"
        is-link
        readonly
        label="目的地"
        placeholder="点击选择目的地"
        @click="showDestPicker = true"
        :rules="[{ required: true, message: '请选择目的地' }]"
      />

      <van-popup v-model:show="showOriginPicker" position="bottom">
        <van-picker :columns="cityColumns" @confirm="onConfirmOrigin" @cancel="showOriginPicker = false" />
      </van-popup>
      <van-popup v-model:show="showDestPicker" position="bottom">
        <van-picker :columns="cityColumns" @confirm="onConfirmDest" @cancel="showDestPicker = false" />
      </van-popup>

      <van-field v-model="form.date" label="出发时间" type="datetime-local" :rules="[{ required: true, message: '请选择时间' }]" />

      <template v-if="form.type === 'driver'">
        <van-field v-model="form.car_model" is-link readonly label="车型" @click="showCarPicker = true" />
        <van-popup v-model:show="showCarPicker" position="bottom">
          <van-picker :columns="carModelColumns" @confirm="onConfirmCar" @cancel="showCarPicker = false" />
        </van-popup>
      </template>

      <van-field v-model="form.seats" :label="form.type === 'driver' ? '提供座位' : '人数'">
        <template #input><van-stepper v-model="form.seats" min="1" max="6" /></template>
      </van-field>
      <van-field v-model="form.price" label="期望价格" type="digit" placeholder="金额 (元)" required />
      <van-field v-model="form.contact" label="联系电话" type="tel" placeholder="手机号" required />
      <van-field v-model="form.remark" label="备注" type="textarea" placeholder="备注信息" rows="2" autosize />

      <div style="margin: 32px 16px;">
        <van-button round block type="primary" native-type="submit">确认发布</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, closeToast, showSuccessToast, showFailToast, showToast } from 'vant'

const router = useRouter()

// 1. 默认值处理
const getNow = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}T${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

const form = ref({
  type: 'driver',
  origin: '',
  destination: '',
  date: getNow(),
  seats: 1,
  price: '',
  remark: '',
  contact: localStorage.getItem('last_phone') || '',
  car_model: '轿车'
})

// 2. 城市数据（回退到标准列表，不进行分组干扰）
const showOriginPicker = ref(false)
const showDestPicker = ref(false)
const cityColumns = [
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

const onConfirmOrigin = ({ selectedOptions }) => {
  form.value.origin = selectedOptions[0].text
  showOriginPicker.value = false
}
const onConfirmDest = ({ selectedOptions }) => {
  form.value.destination = selectedOptions[0].text
  showDestPicker.value = false
}

// 3. 车型（增加混动）
const showCarPicker = ref(false)
const carModelColumns = [
  { text: '轿车', value: '轿车' }, { text: 'SUV', value: 'SUV' },
  { text: 'MPV', value: 'MPV' }, { text: '油电混动', value: '油电混动' }, { text: '纯电动', value: '纯电动' }
]
const onConfirmCar = ({ selectedOptions }) => {
  form.value.car_model = selectedOptions[0].text
  showCarPicker.value = false
}

// 4. 自动定位修复
const getLocation = () => {
  if (!window.AMap) return;
  showLoadingToast({ message: '定位中...', forbidClick: true, duration: 0 });
  
  // 使用 IP 定位作为保底，因为它不需要 GPS 权限，成功率 100%
  const citySearch = new window.AMap.CitySearch();
  citySearch.getLocalCity((status, result) => {
    closeToast();
    if (status === 'complete' && result.info === 'OK') {
      form.value.origin = result.city;
    } else {
      showToast('定位失败，请手动选择');
    }
  });
}

onMounted(() => {
  // 确保高德脚本加载后再执行
  if (window.AMap) {
    getLocation();
  } else {
    setTimeout(getLocation, 1000);
  }
});

const onSubmit = async () => {
  try {
    showLoadingToast({ message: '发布中...', forbidClick: true });
    localStorage.setItem('last_phone', form.value.contact);
    
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form.value, date: form.value.date.replace('T', ' ') })
    });
    
    if (!res.ok) throw new Error('发布失败');
    showSuccessToast('发布成功');
    setTimeout(() => router.push('/'), 1000);
  } catch (e) {
    showFailToast(e.message);
  }
}

const onClickLeft = () => router.back();
</script>
