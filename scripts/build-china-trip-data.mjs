/**
 * One-off helper: regenerates content/trip-data.json for Chongqing + Xinjiang.
 * Run from repo root: node scripts/build-china-trip-data.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const bx = (en, zh) => ({ en, zh });

const tripData = {
  appVersion: '1.0.0',
  versions: [
    {
      v: '1.0.0',
      date: '2026-05-17',
      title: 'Chongqing & Xinjiang relaunch — bilingual planner',
      latest: true,
      changes: [
        'Full itinerary retarget to Chongqing and Xinjiang — city-based itinerary sections instead of Tasmania/Melbourne',
        '简体中文 / English language toggle persisted in sidebar and backups',
        'Checklist grouping by city/region replaces travel-date grouping (dates kept ready in trip countdown for future use)',
        'Maps, budget (CN¥), accommodations, flights seed, tips, and copy aligned for travel in mainland China',
        'New app versioning series starting at 1.0.0; service worker cache id refreshed separately in sw.js',
      ],
    },
  ],
  tripMeta: {
    currencySymbol: '¥',
    groupSize: 4,
    totalDays: 14,
    statDrivingKmApprox: '~3,600',
    statBudgetApprox: '~¥12,000',
  },
  tripCountdown: {
    label: bx('Chongqing & Xinjiang', '重庆与新疆'),
    start: null,
    end: null,
    note: bx(
      'Exact trip dates will go here once confirmed — countdown and PDF headers will automatically use calendar mode.',
      '确认出发与返程日期后写入此处，倒计时与导出将自动切换为按日期显示。',
    ),
  },
  mapsData: {
    cq: {
      center: [29.563, 106.584],
      zoom: 11,
      stops: [
        { lat: 29.562, lng: 106.579, num: 1, daytrip: false, label: bx('Jiefangbei / CBD', '解放碑 · 核心区'), note: bx('City lights, hotpot central, subway hub.', '夜景与火锅集散地，轨道交汇。') },
        { lat: 29.569, lng: 106.585, num: 'A', daytrip: false, label: bx('Hongyadong skyline', '洪崖洞临江'), note: bx('Riverfront tiered lanterns — go after dusk.', '入夜后层次分明，人流量大需预留步行时间。') },
        { lat: 29.551, lng: 106.58, num: 'B', daytrip: false, label: bx('Changjiang ropeway south', '长江索道南岸'), note: bx('Classic crossing — book timed tickets when busy.', '节假日排队久，尽量选择预约时段。') },
        { lat: 29.496, lng: 106.46, num: 2, daytrip: true, label: bx('Ciqikou old town', '磁器口古镇'), note: bx('Snack lanes + teahouses.', '轻轨可达，麻花与茶馆密集的步行街区。') },
        { lat: 29.33, lng: 107.77, num: 3, daytrip: true, label: bx('Wulong karst outlet', '武隆喀斯特方向'), note: bx('Nature bridge / gorge day-trip arc from CQ.', '大型天坑地缝景区，早出晚归型长途日归。') },
        { lat: 29.552, lng: 106.54, num: 4, daytrip: false, label: bx('Li Ziba rail house', '李子坝轨道穿楼'), note: bx('Iconic train-through-building viewpoint.', '观景平台拍完可顺路鹅岭步道。') },
        { lat: 29.55, lng: 106.637, num: 5, daytrip: false, label: bx('CQ Jiangbei airport path', '江北机场方向'), note: bx('Depart leg when heading to Xinjiang.', '飞往乌鲁木齐或接续高铁时的离渝节点。') },
      ],
    },
    xj: {
      center: [43.8, 87.6],
      zoom: 7,
      stops: [
        { lat: 43.827, lng: 87.616, num: 1, daytrip: false, label: bx('Ürümqi hub', '乌鲁木齐'), note: bx('Regional flights, Xinjiang cuisine, altitude acclimatisation.', '调整作息与补水，牛羊肉与烤制主食为主。') },
        { lat: 43.88, lng: 88.122, num: 2, daytrip: true, label: bx('Heavenly Lake (Tianshan)', '天山天池'), note: bx('Alpine lake day above the forest belt.', '山区气温低，备好防风保暖与太阳镜。') },
        { lat: 42.947, lng: 89.189, num: 3, daytrip: false, label: bx('Turpan basin', '吐鲁番盆地'), note: bx('Heat + ancient irrigation Karez.', '昼夜温差大，午间防晒与补水必备。') },
        { lat: 42.915, lng: 89.692, num: 'A', daytrip: true, label: bx('Jiaohe / Grape Valley corridor', '交河 · 葡萄沟一带'), note: bx('Historical ruins paired with orchard stops.', '适合与坎儿井、火焰山景区组合安排。') },
        { lat: 43.45, lng: 88.452, num: 'B', daytrip: true, label: bx('Southern pasture day (sketch)', '南山牧场/近郊草甸'), note: bx('Flexible buffer day near Ürümqi.', '可作航班或列车变动时的缓冲休息日。') },
      ],
    },
  },
  ui: {
    en: {},
    zh: {},
  },
  itinerary: {},
  checklist: [],
  clMeta: {},
  costs: [],
  tips: [],
  stays: [],
  flights: [],
};

const uiEn = {
  'lang.english': 'English',
  'lang.chinese': '中文',
  'nav.overview': 'Trip overview',
  'nav.chongqing': 'Chongqing',
  'nav.xinjiang': 'Xinjiang',
  'nav.planning': 'Planning',
  'nav.stays': 'Accommodation',
  'nav.budget': 'Budget & costs',
  'nav.tips': 'Tips & packing',
  'nav.checklist': 'Booking checklist',
  'nav.cq.days': 'Chongqing — city leg',
  'nav.xj.days': 'Xinjiang — region leg',
  'badge.private': 'Private planner',
  'badge.sub':
    '{days} days · {people} travellers · CN¥ planner',
  'tools.pdf': '↓ PDF',
  'tools.history': '⏱ History',
  'tools.revert': '↺ Revert all',
  'tools.edit': '✏️ Edit',
  'tools.backup': '💾 Backup & restore',
  'auth.logoAlt': '🀄🏔',
  'auth.sub':
    'Password-protected Chongqing ↔ Xinjiang trip hub — enter password to continue',
  'auth.password': 'Password',
  'auth.placeholder': 'Enter password',
  'auth.remember': 'Remember me on this device',
  'auth.unlock': 'Unlock',
  'auth.checking': 'Checking…',
  'auth.wrong': 'Incorrect password. Try again.',
  'auth.restore': 'Restore from backup…',
  'auth.restoreHint':
    'Choose a JSON backup exported from this app. Saved data on this device is replaced, then the page reloads.',
  'flight.schedule': 'Schedule',
  'flight.yours': 'Your flights',
  'flight.hide': 'Hide',
  'flight.show': 'Show',
  'flight.add': '+ Add flight',
  'flight.addPromptFirst': 'Add your first flight card above.',
  'stat.daysTotal': 'Days total',
  'stat.travellers': 'Travellers',
  'stat.drive': 'Total driving',
  'stat.pp': 'Est. per person ({cur})',
  'overview.routeTag': 'Draft route',
  'overview.journeyTitle': '14 days · two-region arc',
  'overview.gettingTransport': 'Planes, trains & cars',
  'overview.highlightsLbl': 'Trip highlights',
  'checklist.header': 'Trip bookings — itinerary draft (dates flexible)',
  'checklist.loading': 'Loading…',
  'checklist.reset': 'Reset all',
  'checklist.sort.urgency': '🔥 Urgency',
  'checklist.sort.category': '🗂 Category',
  'checklist.sort.city': '🏙 City',
  'checklist.sort.status': '✅ Status',
  'checklist.city.pre': '📋 Pre-trip / anytime',
  'checklist.city.cq': '🏙 Chongqing segment',
  'checklist.city.xj': '🏜 Xinjiang segment',
  'stay.bestAreas': 'Best areas',
  'stay.perNightWhole': '/night · whole apartment',
};

const uiZh = {
  ...Object.fromEntries(
    Object.entries({
      ...uiEn,
      'nav.overview': '行程概览',
      'nav.chongqing': '重庆',
      'nav.xinjiang': '新疆',
      'nav.planning': '行前规划',
      'nav.stays': '住宿指南',
      'nav.budget': '预算花费',
      'nav.tips': '贴士装备',
      'nav.checklist': '预订清单',
      'nav.cq.days': '重庆 · 城市段',
      'nav.xj.days': '新疆 · 区域段',
      'badge.private': '私密行程助手',
      'badge.sub': '{days} 天 · {people} 人 · 人民币预算',
      'tools.history': '⏱ 历史记录',
      'tools.revert': '↺ 全部还原',
      'tools.edit': '✏️ 编辑模式',
      'tools.backup': '💾 备份与恢复',
      'auth.logoAlt': '🀄🏔',
      'auth.sub': '重庆 ↔ 私人行程簿 — 输入密码后继续',
      'auth.password': '密码',
      'auth.placeholder': '输入密码',
      'auth.remember': '在本机记住登录',
      'auth.unlock': '解锁',
      'auth.checking': '验证中…',
      'auth.wrong': '密码错误，请重试。',
      'auth.restore': '从备份恢复…',
      'auth.restoreHint':
        '选择本应用导出的 JSON 备份。将替换当前设备的数据并自动刷新页面。',
      'flight.schedule': '行程安排',
      'flight.yours': '航班与时间',
      'flight.hide': '收起',
      'flight.show': '展开',
      'flight.add': '+ 添加航班',
      'flight.addPromptFirst': '在上方添加第一张航班卡片。',
      'stat.daysTotal': '总天数',
      'stat.travellers': '同行人数',
      'stat.drive': '预估行车',
      'stat.pp': '人均估算（人民币）',
      'overview.routeTag': '路线图草案',
      'overview.journeyTitle': '14 天 · 双城大省连线',
      'overview.gettingTransport': '机票、火车与租车',
      'overview.highlightsLbl': '高光想法',
      'checklist.header': '预订清单 · 草稿阶段（日历待定）',
      'checklist.loading': '载入中…',
      'checklist.reset': '重置全部勾选',
      'checklist.sort.urgency': '🔥 紧急度',
      'checklist.sort.category': '🗂 类别',
      'checklist.sort.city': '🏙 城市/区域',
      'checklist.sort.status': '✅ 完成情况',
      'checklist.city.pre': '📋 行前不限日',
      'checklist.city.cq': '🏙 重庆市内/周边段',
      'checklist.city.xj': '🏜 新疆段',
      'stay.bestAreas': '推荐住宿片区',
      'stay.perNightWhole': '/晚 · 整套租房',
      'lang.english': 'English',
      'lang.chinese': '中文',
    }).map(([k, v]) => [k, v]),
  ),
};

tripData.ui.en = uiEn;
tripData.ui.zh = uiZh;

function dayTpl(id, num, cityLine, subtitle, title, meta, img, imgAlt, desc, timeline, activities) {
  return {
    id,
    num,
    day: cityLine,
    date: subtitle,
    title,
    meta,
    img,
    imgAlt,
    desc,
    timeline,
    activities,
  };
}

tripData.itinerary = {
  chongqing: [
    dayTpl(
      'cq1',
      '01',
      bx('Chongqing', '重庆'),
      bx('Metro mountain city · arrivals', '山城抵达 · 调整'),
      bx('Land in Chongqing · river lights & skyline', '抵达重庆 · 江边夜景'),
      bx('CKG arrivals · light walking only · hydrate after flying', '抵达江北/市区 · 以轻松漫步为主 · 飞行后多喝水'),
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=960&q=80',
      bx('Chongqing river bend at dusk', '重庆两江夜景'),
      bx(
        'Drop bags, ride the metro uphill, and soak in stacked neighbourhoods above the Yangtze and Jialing rivers. Chongqing humid heat in summer differs from Xinjiang dryness — tune clothing before heading west.',
        '先放下行李，体验立体交通与江城夜景。重庆的湿热与新疆干旱差别大，行前注意衣物与补水节奏。',
      ),
      [
        { time: bx('Flexible', '灵活'), icon: '🛬', label: bx('Airport ↔ city link', '机场↔市区') },
        { time: bx('Evening', '晚间'), icon: '🌉', label: bx('Hongyadong viewpoints', '洪崖洞观灯') },
        { time: bx('Late', '宵夜'), icon: '🍲', label: bx('Hotpot intro', '火锅入门一局') },
      ],
      [
        {
          icon: '🚕',
          name: bx('Airport metro / taxi to downtown', '轨道或出租入城'),
          desc: bx(
            'Metro Line 10 links Jiangbei Airport to central transfers; taxis queue on levelled roads — screenshot your hotel Chinese address.',
            '10 号线等与出租车都方便；陡坡与立交多，备好酒店的中文地址卡片。',
          ),
          cost: bx('Metro ~¥5–10 · Taxi ~¥50–90', '轨道约¥5–10 · 出租约¥50–90'),
        },
        {
          icon: '🍲',
          name: bx('Mild numb hotpot pacing', '微辣九宫格量力而行'),
          desc: bx(
            'Order sesame oil dips to cool spice; yoghurt drinks help newcomers. Hydrate generously.',
            '油碟可缓和辣感；乳酸菌饮料对新手有用，记得补水。',
          ),
          cost: bx('Roughly ¥80–140 pp casual shop', '普通店人均约¥80–140'),
        },
      ],
    ),
    dayTpl(
      'cq2',
      '02',
      bx('Chongqing', '重庆'),
      bx('CBD core museums & river crossing', '核心城区与过江'),
      bx('River ropeway · museums · skyline night', '长江索道 · 展馆 · 夜景'),
      bx('Metro + walking stairs · hydrate · sun hat', '轨交+步道爬坡 · 注意补水防晒'),
      'https://images.unsplash.com/photo-1567154990175-cef8d7e7e5c4?w=960&q=80',
      bx('Busy urban riverfront', '江城滨水'),
      bx(
        'Touch modern CQ history exhibitions, glide the ropeway across the gorge, wander Jiefangbei’s crossing towers, finish with lanterns along the gorge-cut cliffs.',
        '白天了解近代城市变迁，过江索道取景，晚间回到解放碑与临江栈道感受层次灯光。',
      ),
      [
        { time: bx('Morning', '上午'), icon: '🏛', label: bx('Three Gorges Museum belt', '三峡博物馆片区') },
        { time: bx('Afternoon', '下午'), icon: '🚠', label: bx('River cable timed ride', '预约索道时段') },
        { time: bx('Night', '夜晚'), icon: '🌉', label: bx('Hongyadong pacing', '洪崖洞错峰') },
      ],
      [
        {
          icon: '🏛',
          name: bx('Three Gorges Museum campus', '重庆中国三峡博物馆'),
          desc: bx(
            'Free entry pockets with river engineering history — quieter weekdays mornings.',
            '常设展免费预约，侧重江河工程与城市记忆，工作日早晨较安静。',
          ),
          cost: bx('Usually free reservations', '多数情况免费预约'),
        },
        {
          icon: '🚠',
          name: bx('Changjiang ropeway', '长江索道'),
          desc: bx(
            'Short iconic crossing — expect queues on sunny weekends.',
            '体验型过江项目，晴朗周末排队明显。',
          ),
          cost: bx('~¥20–40 round trip typical', '往返常见约¥20–40区间'),
        },
      ],
    ),
    dayTpl(
      'cq3',
      '03',
      bx('Chongqing', '重庆'),
      bx('River towns & creative lanes', '古镇与老街'),
      bx('Magnetic-era lanes & teahouse pacing', '磁器口与茶馆慢游'),
      bx('Metro + hillside walking · souvenir snacks', '轨交接驳 · 陡坡步行'),
      'https://images.unsplash.com/photo-1577083555083-9247cdd35b9c?w=960&q=80',
      bx('Tea steam and tiled roofs', '青瓦茶花'),
      bx(
        'Slow commercial old-town lanes for snacks plus optional craft streets; dodge midday heat.',
        '以小吃与茶楼为主的古镇步行区；午间避开曝晒时段。',
      ),
      [
        { time: bx('Morning', '上午'), icon: '🚈', label: bx('Metro to Ciqikou', '轻轨至磁器口') },
        { time: bx('Lunch', '午餐'), icon: '🥟', label: bx('Street bites sampling', '街头小吃拼盘') },
        { time: bx('Tea', '茶歇'), icon: '🍵', label: bx('Courtyard tea pause', '庭院盖碗茶歇脚') },
      ],
      [
        {
          icon: '🥢',
          name: bx('Maodu hotpot alley contrast', '对比昨日火锅强度'),
          desc: bx(
            'Share smaller portions of spicy noodles instead of repeat heavy hotpot lunches.',
            '可用小面酸辣粉等轻量化午餐，避开连续重油火锅午间作战。',
          ),
          cost: bx('Snack crawl ~¥40–70 pp', '小吃组合约¥40–70每人'),
        },
      ],
    ),
    dayTpl(
      'cq4',
      '04',
      bx('CQ outskirts', '重庆周边'),
      bx('Karst day arc', '喀斯特一日游'),
      bx('Wulong-style gorge viewpoints (plan early)', '武隆喀斯特景区早出晚归'),
      bx('Coach or tour day ·  ~280 km circuit · pack rain shell', '长途景区日 · 约280km级往返 · 带薄雨衣'),
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=960&q=80',
      bx('Fog lifting over limestone gorge', '石灰岩峡谷晨雾'),
      bx(
        'Huge natural bridges slot into the Yangtze tributary valleys — sunrise departures beat traffic. Energy heavy; recuperate afterward.',
        '大型天坑地缝景区耗能高；建议早出，回程早点休息以备进疆。',
      ),
      [
        { time: bx('Early', '清晨'), icon: '🚌', label: bx('Depart CQ east', '向东出城') },
        { time: bx('Midday', '正午'), icon: '🪨', label: bx('Bridge lookout loop', '天生桥观景环线') },
        { time: bx('Return', '返程'), icon: '😴', label: bx('Recovery evening', '轻松晚餐早点睡') },
      ],
      [
        {
          icon: '🎫',
          name: bx('Timed scenic tickets', '分时预约门票'),
          desc: bx(
            'Book ahead on busy domestic holidays; carry ID matching reservation.',
            '旺季务必提前预约；证件需与订单一致。',
          ),
          cost: bx('Bundle varies seasonally ~¥100–200+ pp', '套票淡旺季约¥100–200+每人'),
        },
      ],
    ),
    dayTpl(
      'cq5',
      '05',
      bx('Chongqing', '重庆'),
      bx('Layers & parks', '起伏城市公园'),
      bx('Mountain city layers · parks above fog', '立体交通 · 观景台'),
      bx('Elevators + ridges · short climbs', '电梯与步道结合 · 短小爬升'),
      'https://images.unsplash.com/photo-1605218427306-7637f6c6c5d4?w=960&q=80',
      bx('Metro train threading towers', '轨道穿楼城市剖面'),
      bx(
        'Peek the train-through-building platforms, ascend viewing decks, savour one last chilli aromatherapy before Xinjiang dryness.',
        '打卡轨道穿梭楼体的城市剖面，再上观景平台俯视雾都，为进疆的干热气候做准备。',
      ),
      [
        { time: bx('Morning', '上午'), icon: '🚇', label: bx('YZ house viewpoint', '李子坝观景台') },
        { time: bx('Afternoon', '下午'), icon: '🌳', label: bx('Park ridge wander', '山脊林荫步道') },
        { time: bx('Prep', '准备'), icon: '🧳', label: bx('Dry-air clothing check', '换洗衣物与润肤') },
      ],
      [],
    ),
    dayTpl(
      'cq6',
      '06',
      bx('CQ → Xinjiang', '重庆→新疆'),
      bx('Transit day', '赶路日'),
      bx('Fly Ürümqi · reset clocks · lighter dinner', '飞乌鲁木齐 · 时差适应 · 清淡晚餐'),
      bx('Flight block · airport security early · hydrate cabin', '航班日 · 提前到机场 · 机舱补水'),
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=960&q=80',
      bx('Twin engine over western ranges', '飞往西北航程'),
      bx(
        'Expect longer security queues at mega hubs; Xinjiang gateways may add extra luggage screening — patience + portable snacks.',
        '大型枢纽安检耗时；进疆航道常见额外行李检查环节，备好零食与水。',
      ),
      [
        { time: bx('Day', '白天'), icon: '✈️', label: bx('CQ–URC leg', '重庆—乌鲁木齐航段') },
        { time: bx('Late', '落地后'), icon: '🍉', label: bx('melon + yoghurt dinner', '瓜果酸奶餐') },
      ],
      [
        {
          icon: '🧴',
          name: bx('Altitude & dryness kit', '干燥防护包'),
          desc: bx(
            'Lip balm, lotion, and saline nasal spray outperform fancy serums overnight.',
            '润唇膏与鼻腔盐水喷雾比花哨护肤品更实用。',
          ),
          cost: bx('Prep at home/pharmacy', '出行前药妆店添置'),
        },
      ],
    ),
  ],
  xinjiang: [
    dayTpl(
      'xj1',
      '07',
      bx('Ürümqi', '乌鲁木齐'),
      bx('Regional capital settle-in', '首府安顿'),
      bx('Altitude gentle · bazaar aromas', '初入新疆 · 巴扎夜市'),
      bx('Urban day · taxis cheap · bilingual maps helpful', '城市日 · 打车不贵 · 离线地图备好'),
      'https://images.unsplash.com/photo-1526481280695-074c716a8e71?w=960&q=80',
      bx('Desert dusk tones', '西北暮色'),
      bx(
        'Walk the Grand Bazaar fringes after sunset for music and grills without overcommitting the first jet-lagged evening.',
        '到达当晚以轻松夜游为主，逛逛大巴扎周边的烟火气即可，不宜安排远程车程。',
      ),
      [
        { time: bx('PM', '下午'), icon: '🕌', label: bx('Intl Grand Bazaar pacing', '二道桥国际大巴扎') },
        { time: bx('Snack', '小食'), icon: '🍢', label: bx('Lamb skewers trial', '烤羊肉串试档') },
      ],
      [],
    ),
    dayTpl(
      'xj2',
      '08',
      bx('Ürümqi outskirts', '乌市近郊'),
      bx('Alpine lake day', '天池一日'),
      bx('Shuttle Tianchi ridge · colder layer', '景区车+徒步 · 加一件外套'),
      bx('Shuttle queues · ID checks · refill water', '区间车排队 · 证件随身 · 备水'),
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=960&q=80',
      bx('Mountain lake plateau', '高山湖泊草甸'),
      bx(
        'Forest-lined shuttle climb to cobalt water — midday UV strong even when air feels cool.',
        '森林上下的区间车与高海拔湖的紫外线强强组合，体感凉也要防晒。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj3',
      '09',
      bx('Ürümqi', '乌鲁木齐'),
      bx('Museum calm day', '博物馆舒缓日'),
      bx('Regional history exhibits · park sunset', '疆史常设 · 公园日落'),
      bx('Metro/taxi hops · hydrate', '短途移动 · 补水'),
      'https://images.unsplash.com/photo-1577083555083-9247cdd35b9c?w=960&q=80',
      bx('Hall galleries interior', '展陈安静节奏'),
      bx(
        'Alternate heavy walking with conditioned museum halls; perfect for dusty-wind contingency plans.',
        '若扬尘或大风沙尘预警，可把户外行程调换到展馆类室内。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj4',
      '10',
      bx('Turpan', '吐鲁番'),
      bx('Fast train south', '动车南下盆地'),
      bx('Dry heat introductions · shaded ruins', '干热盆地 · 遮阴遗址'),
      bx('Ride ~1h tier train · brim hat essential', '动车约一小时级 · 宽檐帽必需'),
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=960&q=80',
      bx('Clay ruins under sun', '烈日下的土质遗址'),
      bx(
        'Karez underground channels stay surprisingly cool midday — weave them between sun-exposed ridges.',
        '坎儿井地下渠道中午相对凉爽，可与暴晒地表点穿插安排。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj5',
      '11',
      bx('Turpan', '吐鲁番'),
      bx('Vineyards + ancient city', '葡萄沟与古城'),
      bx('Morning orchards · afternoon archaeology', '上午果园 · 下午遗址'),
      bx('Hydration + salted tea rhythm', '甜瓜果切 + 咸味奶茶补水节奏'),
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=960&q=80',
      bx('Green canopy rows', '葡萄架阴凉'),
      bx(
        'Ride electric carts inside scenic loops; negotiate photo stops politely with growers.',
        '景区内电瓶车省时，与种植户沟通再进行采摘或拍照更可愉快。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj6',
      '12',
      bx('Turpan→Ürümqi', '吐鲁番→乌鲁木齐'),
      bx('Return hop + errands', '回乌市修整'),
      bx('Flexible tickets · mall resupply', '灵活车次 · 补给'),
      bx('Night market optional lightly', '夜市浅尝即止'),
      'https://images.unsplash.com/photo-1526481280695-074c716a8e71?w=960&q=80',
      bx('Urban golden hour', '城市黄昏'),
      bx(
        'Use buffer day for SIM top-up, meds, parcel gifts — Ürümqi courier counters cluster near rail hubs.',
        '缓冲整理日：可处理流量卡、常备药与当地伴手礼快递。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj7',
      '13',
      bx('Ürümqi buffer', '乌鲁木齐缓冲'),
      bx('Southern foothills OR spa hotel', '南山浅行或休整'),
      bx('Either meadow picnic or hammam unwind', '草甸野餐式轻松 / 休整'),
      bx('Tune to next-day departure stamina', '为返程蓄积体力'),
      'https://images.unsplash.com/photo-1605218427306-7637f6c6c5d4?w=960&q=80',
      bx('Open plateau pasture sketch', '近郊草甸意向'),
      bx(
        'Book ride-share groups if meadows interest you; alternatively pool day at hotel sauna to detox spice oils from Chongqing week.',
        '若不去远郊可酒店休整与桑拿排汗，给身体代谢重庆火锅残留。',
      ),
      [],
      [],
    ),
    dayTpl(
      'xj8',
      '14',
      bx('Depart Xinjiang', '离开新疆'),
      bx('Outbound pack day', '离疆日'),
      bx('Morning flight CQ or home pivot', '早间航班接驳重庆或回原居地'),
      bx('Liquids allowance · dehydrated fruit gifts', '注意液体托运 · 干果手信'),
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=960&q=80',
      bx('Airside sunrise', '航站楼日出'),
      bx(
        'Photocopy itineraries for security questions; souvenir knives stay in checked bags only.',
        '安检问询时行程单打印件更顺滑；刀刃类纪念品务必托运。',
      ),
      [],
      [],
    ),
  ],
};

tripData.stays = [
  {
    id: 'stay-jfb',
    name: bx('Jiefangbei / Linjiang corridor', '解放碑—临江地带'),
    loc: bx('Yuzhong core — walkable to ropeway & Hongyadong', '渝中核心区，步行可达索道与洪崖洞'),
    nights: bx('3 nights · Chongqing base', '3 晚 · 重庆大本营'),
    areas: [bx('Jiefangbei CBD towers', '解放碑商圈'), bx('Linjiang mid-rise lanes', '临江中高层民俗')],
    minPrice: 380,
    maxPrice: 720,
    img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=720&q=80',
    tip: bx(
      'Pick properties with lift access after midnight hotpot — stairs-only walk-ups hurt after ropeway queues.',
      '深夜火锅归来尽量选有电梯房源，纯楼梯房在排队索道日后会很累。',
    ),
    pills: [bx('Metro L1/L2', '轨道1/2号线'), bx('Night views', '夜景'), bx('Hotpot radius', '火锅密集')],
  },
  {
    id: 'stay-wulong',
    name: bx('Wulong scenic gateway town', '武隆景区门户镇'),
    loc: bx('Near visitor centre shuttles', '游客中心班车圈'),
    nights: bx('1 night · karst day buffer', '1 晚 · 喀斯特日后缓冲'),
    areas: [bx('Main street hotels', '主街酒店'), bx('Riverside newer blocks', '沿江较新小区')],
    minPrice: 260,
    maxPrice: 520,
    img: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=720&q=80',
    tip: bx(
      'Book flexible cancellation — weather can sock-in the gorge photos you came for.',
      '建议选可免费取消的房型，山区起雾时景观波动大。',
    ),
    pills: [bx('Shuttle walk', '区间车方便'), bx('Early breakfast', '早餐早开')],
  },
  {
    id: 'stay-urumqi',
    name: bx('Ürümqi midtown', '乌鲁木齐市中心'),
    loc: bx('Near Hongshan / metro axis', '红山—地铁轴带'),
    nights: bx('4 nights · capital base', '4 晚 · 首府基地'),
    areas: [bx('Hongshan Park radius', '红山公园半径'), bx('Rail hub service apartments', '高铁枢纽服务公寓')],
    minPrice: 320,
    maxPrice: 680,
    img: 'https://images.unsplash.com/photo-1526481280695-074c716a8e71?w=720&q=80',
    tip: bx(
      'Central heating in winter floors can feel dry — ask for humidifier if provided.',
      '冬季集中供暖偏干，可向前台争取加湿器。',
    ),
    pills: [bx('Halal dining rich', '清真餐饮丰富'), bx('Car hire desks', '租车门店集中')],
  },
  {
    id: 'stay-turpan',
    name: bx('Turpan oasis blocks', '吐鲁番绿洲城区'),
    loc: bx('Shuttles to Karez + ruins', '坎儿井与遗址班车圈'),
    nights: bx('2 nights · basin heat', '2 晚 · 干热盆地'),
    areas: [bx('Youth hostel lanes', '青旅小院'), bx('Hotel pools', '泳池酒店解暑')],
    minPrice: 220,
    maxPrice: 480,
    img: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=720&q=80',
    tip: bx(
      'Courtyard fountains beat rooftop-only AC when midday hits 40°C+.',
      '午间40°C以上时带喷泉的内院休憩优于纯空调顶楼。',
    ),
    pills: [bx('Grape carts', '瓜果小车'), bx('Night breeze', '夜风解暑')],
  },
];

tripData.costs = [
  {
    catSlug: 'flt',
    cat: bx('Flights', '大交通 · 机票'),
    item: bx('Intl / domestic flights into CQ + return from Xinjiang (placeholder)', '进渝与离疆的国内/跨境机票（占位）'),
    total: 12000,
    pp: 3000,
    note: bx('Peak summer domestic fares swing wildly — stalk alerts 6–8 weeks out.', '暑期票价波动极大，提前6–8周盯票与里程兑换。'),
  },
  {
    catSlug: 'flt',
    cat: bx('Flights', '大交通 · 机票'),
    item: bx('Chongqing ↔ Ürümqi main jet leg', '重庆↔乌鲁木齐主航段'),
    total: 6400,
    pp: 1600,
    note: bx('Wide-body sometimes appears on ultra-busy days.', '旺季偶见宽体执飞，关注航司换季表。'),
  },
  {
    catSlug: 'rooms',
    cat: bx('Accommodation', '住宿'),
    item: bx('10 hotel/Airbnb-style nights midpoint ¥460/night', '10晚中位¥460估算'),
    total: 4600,
    pp: 1150,
    note: bx('Splurge nights at lake-view Ürümqi towers optional.', '可看天山轮廓的高层酒店每晚加价明显。'),
  },
  {
    catSlug: 'car',
    cat: bx('Transport', '当地交通'),
    item: bx('Regional car+hsk tickets + metro top-ups', '租车/包车段 + 动车 + 轨交充值'),
    total: 5600,
    pp: 1400,
    note: bx('Xinjiang distances punish one-way taxis — bundle driver days.', '远距离建议打包包车日，比单程打车省钱。'),
  },
  {
    catSlug: 'food',
    cat: bx('Food & outings', '餐饮景点'),
    item: bx('Hotpot labs + scenic tickets averaged', '火锅与景区门票摊销'),
    total: 3600,
    pp: 900,
    note: bx('Government-run parks publish seasonal bundles online.', '官方渠道常有季节联票。',
    ),
  },
  {
    catSlug: 'misc',
    cat: bx('Buffer', '缓冲杂费'),
    item: bx('SIM, meds, souvenirs slush fund', '流量卡常备药纪念品备用金'),
    total: 2000,
    pp: 500,
    note: bx('Rounded to sweet ¥ totals for chatting in WeChat splits.', '方便微信群AA凑整的人民币口径。'),
  },
];

tripData.tips = [
  {
    icon: '🪪',
    title: bx('Documents & pacing', '证件与通行节奏'),
    items: [
      bx('Keep passports + photocopies segmented in waterproof pouches.', '护照与复印件分袋防水收纳。'),
      bx('Domestic checkpoints love printed itineraries — stash PDF exports from this planner.', '部分查验更认纸质行程，善用本页的 PDF 导出。'),
      bx('Alternate heavy outdoor days whenever AQI spikes.', '沙尘或重污染天气灵活调换室内外行程。'),
    ],
  },
  {
    icon: '📶',
    title: bx('Connectivity', '通讯与离线'),
    items: [
      bx('Grab a mainland SIM with generous data — mapping traffic layers update live.', '办一张大流量套餐，路况图层实时更新非常关键。'),
      bx('Offline map packs both CQ’s vertical blocks and Xinjiang motorway spurs.', '离线城市包需同时缓存重庆立交与新疆国道支路。'),
      bx('Power banks >22k mAh occasionally blocked at tighter airports — carry two midsize packs.', '超规充电宝偶被拦下，分拆两只中等容量更安全。'),
    ],
  },
  {
    icon: '🥘',
    title: bx('Flavor handover', '口味过渡'),
    items: [
      bx('Ease chilli transition with yoghurt drinks before jumping into Xinjiang lamb feasts.', '进入新疆羊肉串大餐前先用酸奶饮品过渡肠胃。'),
      bx('Carry peppermint oil for windy bus hops — scents calm motion upsets.', '长途盘山巴士可随身薄荷油提神防晕。'),
    ],
  },
];

tripData.checklist = [
  {
    id: 'week',
    color: '#ff3b30',
    label: bx('Book ASAP', '尽快落实'),
    sub: bx('Flights/rail still floating — grab anchors first.', '票务尚未锁死，先把骨架构住。'),
    items: [],
  },
  {
    id: 'month',
    color: '#ff9500',
    label: bx('Soon', '紧随其后'),
    sub: bx('Hot hotels + drivers once dates firm.', '日期敲定后尽早锁房与包车。'),
    items: [],
  },
  {
    id: 'later',
    color: '#34c759',
    label: bx('Before departure', '出发前'),
    sub: bx('Insurance, SIM, backups.', '保险、SIM、离线资料。'),
    items: [],
  },
];

tripData.checklist[0].items = [
  {
    id: 'flt-cq-hub',
    icon: '✈️',
    title: bx('Commit Chongqing inbound tickets', '锁定进重庆的航班或高铁'),
    dates: bx('City leg · ASAP', '重庆段 · 尽快'),
    detail: bx(
      'Flying via CAN/SHA/PEK all work — optimise for midday CKG arrival.',
      '经广州/上海/首都等枢纽均可—尽量中午前落地江北以便入城。',
    ),
    est: bx('Rough ¥900–2200 pp one-way placeholders', '单程示意¥900–2200/人区间'),
    where: bx('CTrip · airlines’ apps · mileage portals', '携程 · 航司App · 里程票'),
  },
  {
    id: 'flt-urc',
    icon: '✈️',
    title: bx('Lock CQ ↔ Ürümqi segment', '锁重庆⇄乌鲁木齐航线'),
    dates: bx('Pivot day between regions', '两区转折日'),
    detail: bx('Baggage rules differ — confirm ski gear if planning winter detour.', '行李限额差别大——若冬季绕路滑雪需提早票规。'),
    est: bx('¥1500–3000 typical summer bucket', '暑期常见¥1500–3000档'),
    where: bx('Hangzhou/Sichuan/Chongqing airlines compare', '多航司比价'),
  },
];

tripData.checklist[1].items = [
  {
    id: 'stay-jfb',
    icon: '🏠',
    title: bx('Jiefangbei whole-home nightly', '解放碑整套民宿/公寓'),
    dates: bx('CQ segment nights', '重庆段晚间'),
    detail: bx('Need elevator + humidifier asks in notes.', '下单备注加湿与电梯需求。'),
    est: bx('¥380–720 previews', '预览价¥380–720'),
    where: bx('Trip.com rentals · Airbnb China inventory', '携程民宿 · Airbnb国内房源'),
  },
  {
    id: 'driver-xj',
    icon: '🚐',
    title: bx('Reserve capped-day driver quotes', '新疆包车日报价'),
    dates: bx('Lake + Turpan arcs', '天池 + 吐鲁番弧'),
    detail: bx('Government-plated tourism vans required in some prefectures.', '部分地区需营运资质车辆，聊天记录里写明线路。'),
    est: bx('¥800–1400/driver-day ballpark off-season', '淡季司机日费示意¥800–1400'),
    where: bx('Hotel concierge · Dianping chauffeur tags', '酒店礼宾 · 点评包车标签'),
  },
];

tripData.checklist[2].items = [
  {
    id: 'ins-cn',
    icon: '🛡',
    title: bx('Buy China-wide medical + evacuation cover', '含医疗转运的旅游险'),
    dates: bx('Immediately after ticketing', '出票后即买'),
    detail: bx('Declare hotpot mishaps joking aside — dehydration IVs happen.', '别忽视急性肠胃炎脱水就诊场景。'),
    est: bx('¥200–380 pp boutique plans', '精品计划¥200–380/人'),
    where: bx(' Alipay insurance marketplace', '支付宝保险频道'),
  },
  {
    id: 'offline-pack',
    icon: '📦',
    title: bx('Duplicate PDF + offline maps pack', '重复PDF与离线地图包'),
    dates: bx('Week before travel', '出行前一周'),
    detail: bx('AirDrop copies to buddies — WeChat compression kills photos clarity.', '隔空投送备份给朋友，微信群传图易被压缩。'),
    est: bx('¥0 planner export', '使用本应用的 PDF 导出'),
    where: bx('Planner PDF button · Maps.me layers', '本应用 PDF · Maps.me离线层'),
  },
];

tripData.clMeta = {
  'flt-cq-hub': { cat: 'Flights', catIcon: '✈️', catColor: '#0071e3', tripCity: 'cq' },
  'flt-urc': { cat: 'Flights', catIcon: '✈️', catColor: '#0071e3', tripCity: 'xj' },
  'stay-jfb': {
    cat: 'Accommodation',
    catIcon: '🏠',
    catColor: '#34c759',
    tripCity: 'cq',
  },
  'driver-xj': {
    cat: 'Ground transport',
    catIcon: '🚐',
    catColor: '#ff9500',
    tripCity: 'xj',
  },
  'ins-cn': { cat: 'Insurance', catIcon: '🛡', catColor: '#636366', tripCity: 'pre' },
  'offline-pack': { cat: 'Essentials', catIcon: '📦', catColor: '#636366', tripCity: 'pre' },
};

const outPath = join(__dirname, '..', 'content', 'trip-data.json');
writeFileSync(outPath, JSON.stringify(tripData, null, 2), 'utf8');
console.log('Wrote', outPath);
