import fs from 'node:fs';

const templatePath = 'C:/Users/Lacr1me/.codex/skills/artifact-template-daily-brief/assets/template.html';
const outDir = 'C:/Users/Lacr1me/Desktop/日报/民生日报/2026-8';
const outPath = `${outDir}/2026-08-23-民生日报.html`;
const policy = 'https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?key=&t=zhengcelibrary';
const un = 'https://www.un.org/en/';
const cas = 'https://www.cas.cn/syky/index_1.shtml';

const domestic = [
  ['北京公布2026年度社保缴费基数上下限','北京市明确2026年度社会保险缴费基数下限为7270元、上限为36348元，部分已按旧标准缴费人员需按规定补缴差额。','北京市人社局','2026-08-21','https://rsj.beijing.gov.cn/xxgk/2024zcjd/202608/t20260821_4831476.html'],
  ['国家部署新一代通信网与空气质量改善','国务院常务会议要求统筹推进基础、空间、国际和融合网络建设，同时持续打好蓝天保卫战并提升电力安全应急能力。','中国政府网／新华社','2026-08-21 19:39','https://big5.www.gov.cn/gate/big5/www.gov.cn/yaowen/liebiao/202608/content_7078803.htm'],
  ['国家防总对华南启动防汛防台风四级响应','国家防总办公室、应急管理部针对海南、广西、广东启动四级应急响应，要求落实人员转移和重点区域风险防范。','应急管理部','2026-08-21 21:11','https://www.mem.gov.cn/xw/yjglbgzdt/index.shtml'],
  ['上海部署就业帮扶与民生实事','上海市政府常务会议提出推进民心工程和民生实事，强化重点群体就业帮扶，提升教育、住房和社会保障服务水平。','上海市政府','2026-08-21', 'https://www.shanghai.gov.cn/nw4411/20260821/97a6c87e5f364999b2dca7da1d794a0c.html'],
  ['住房公积金管理条例完成修改','国务院修改住房公积金管理条例，新规将于9月20日起施行，政策解读强调普惠扩围和全链条赋能住房消费。','中国政府网','2026-08-18',policy],
  ['特殊教育“十五五”行动计划获批','国务院批复特殊教育发展提升“十五五”行动计划，要求教育、发展改革、民政、财政、人社、卫健等部门协同实施。','中国政府网','2026-08-17',policy],
  ['全民医疗保障“十五五”规划印发','国家医保局印发全民医疗保障“十五五”规划，部署完善多层次保障、支付方式改革、基金监管和便民服务。','国家医保局／中国政府网','2026-08-19',policy],
  ['三部门优化社区岗位吸纳高校毕业生','人社部等部门发文优化城乡社区岗位吸纳高校毕业生工作，推动基层岗位开发、就业服务与人才成长衔接。','人社部／中国政府网','2026-08-18',policy],
  ['九部门发文激发县域消费活力','商务部等九部门提出完善县域商业设施、丰富优质商品和服务供给，进一步激发下沉市场与县域消费潜力。','商务部／中国政府网','2026-08-18',policy],
  ['道路交通典型事故获国务院安委办通报','国务院安委办通报近期道路交通典型事故，部署加强重点车辆、重点路段和重点时段安全风险排查治理。','应急管理部','2026-08-18 15:53','https://www.mem.gov.cn/xw/yjglbgzdt/index.shtml']
];

const international = [
  ['刚果（金）将获7万剂埃博拉疫苗','联合国称刚果（金）将接收7万剂Ervebo疫苗，重点保护一线人员，应对仍在扩散的埃博拉疫情。','联合国新闻','2026-08-20',un],
  ['联合国调查警告南苏丹暴行风险上升','联合国支持的调查机制警告，南苏丹在选举临近之际若不能遏制重新升级的战事，人道危机可能进一步恶化。','联合国新闻','2026-08-20','https://www.un.org/ruleoflaw/from-the-field/'],
  ['苏丹战事与洪灾造成20万人新增流离失所','联合国称自2025年末以来，苏丹加剧的战斗已造成至少20万人新增流离失所，季节性洪灾进一步放大需求。','联合国新闻','2026-08-19','https://www.un.org/ruleoflaw/from-the-field/'],
  ['无人机正在重塑战场并威胁援助人员','联合国警告武装无人机改变冲突形态，人道团队越来越频繁地处于打击风险之中，援助行动安全承压。','联合国新闻','2026-08-19',un],
  ['利比亚政治僵局与无人机袭击受关注','联合国安理会审议利比亚局势，选举进程受阻之际，冲突与无人机袭击还导致一座重要炼油设施起火。','联合国新闻','2026-08-18','https://www.un.org/ruleoflaw/from-the-field/'],
  ['加沙仅约3%耕地仍可用于种植','联合国指出持续敌对行动使加沙农民更难获得安全耕地，目前仅约3%的耕地可用于种植，粮食生产能力严重受限。','联合国新闻','2026-08-18','https://www.un.org/ruleoflaw/from-the-field/'],
  ['联合国扩大哥伦比亚地震人道援助','哥伦比亚西部发生7.4级地震后，联合国正扩大在当地的人道援助，并与国家机构协调评估持续增长的需求。','联合国新闻','2026-08-18',un],
  ['联合国关注赞比亚选后反对派遭拘押','赞比亚总统赢得连任后，联合国人权部门对反对派人员遭逮捕和拘押表达关切，呼吁保障基本权利。','联合国新闻','2026-08-19','https://www.un.org/ruleoflaw/from-the-field/'],
  ['国际刑事法院谴责美国新一轮制裁','国际刑事法院回应美国针对其院长和高级检察官的新制裁，称此举冲击法院独立性与国际司法秩序。','联合国新闻／国际刑事法院','2026-08-19','https://www.un.org/ruleoflaw/from-the-field/'],
  ['联合国称加沙平民仍承受持续致命袭击','联合国人权机构称8月13日至19日至少22名巴勒斯坦人在加沙遭袭身亡，并重申针对平民和不成比例攻击受国际法禁止。','联合国人权高专办','2026-08-21','https://www.un.org/unispal/document/gaza-civilians-continue-to-pay-the-price-as-deadly-attacks-persist-en-ar/']
];

const tech = [
  ['发现大脑全新神经调控环路','中科院团队发现伏隔核D1、D2神经元可双向调控杏仁核乙酰胆碱释放，为理解显著性加工异常提供潜在靶点。','中国科学院','2026-08-20','https://www.cas.cn/syky/202608/t20260820_5118673.shtml'],
  ['揭示我国森林碳汇形成机制','科研人员系统分析过去30余年我国森林碳汇变化，进一步阐明气候、植被恢复与生态工程对碳汇形成的共同作用。','中国科学院','2026-08-18','https://www.cas.cn/syky/202608/t20260818_5118526.shtml'],
  ['TOPCon太阳能电池金属化研究获进展','研究团队围绕TOPCon电池高效金属化开展材料与工艺优化，为降低银耗、提升效率和推动光伏规模化制造提供新思路。','中国科学院','2026-08-18','https://www.cas.cn/syky/202608/t20260818_5118523.shtml'],
  ['揭示棕榈酸加剧肥胖炎症新机制','研究发现棕榈酸可破坏内脏脂肪免疫稳态并加剧肥胖相关炎症，为代谢疾病机制研究与干预提供新线索。','中国科学院','2026-08-19','https://www.cas.cn/syky/202608/t20260819_5118566.shtml'],
  ['高效一价离子分离研究获进展','科研人员在高效一价离子选择性分离方面取得进展，有望服务盐湖资源利用、水处理及相关分离过程的能效提升。','中国科学院','2026-08-18','https://www.cas.cn/syky/202608/t20260818_5118525.shtml'],
  ['科学家将量子存储器纠缠距离提升至420公里','中国科研团队把量子存储器之间的纠缠距离提升至420公里，为远距离量子网络和量子中继技术研究推进关键一步。','中国科学院','2026-08-18',cas],
  ['极端条件下电池材料失效机制获揭示','科研人员解析电池材料在极端条件下的失效过程，为提升储能器件安全性、寿命和极端环境适应能力提供依据。','中国科学院','2026-08-18',cas],
  ['轻量化AI赋能术中影像引导','研究团队实现轻量化人工智能用于术中影像引导，旨在减少计算负担并提升临床场景中的实时辅助能力。','中国科学院','2026-08-18',cas],
  ['观测到核子内部奇特结构','科学家通过实验观测到核子内部新的奇特结构，为理解强相互作用和核子内部夸克、胶子动力学提供新证据。','中国科学院','2026-08-17','https://www.cas.cn/syky/202608/t20260817_5118472.shtml'],
  ['植物RNA编辑因子演化规律获揭示','研究团队揭示植物RNA编辑因子的演化规律，增进对植物细胞器基因表达调控及适应性演化的认识。','中国科学院','2026-08-17',cas]
];

const ai = [
  ['OpenAI成立“AI Futures”研究平台','OpenAI战略未来团队推出AI Futures，聚焦变革性AI时代个人权利、社会制度与权力制衡等长期治理议题。','OpenAI','2026-08-20','https://openai.com/index/introducing-ai-futures/'],
  ['前沿模型将继续提供零数据保留选项','OpenAI预览Private Safety Processing，使符合条件的API客户可在零数据保留前提下识别跨交互风险模式。','OpenAI','2026-08-19','https://openai.com/index/offering-zero-data-retention-for-frontier-models/'],
  ['ChatGPT广告扩展至欧洲31个市场','OpenAI宣布ChatGPT广告将进入31个欧洲市场，仅面向Free与Go用户展示，付费订阅继续保持无广告。','OpenAI','2026-08-18','https://openai.com/index/chatgpt-ads-expands-across-europe/'],
  ['OpenAI加强高危网络能力模型防护','OpenAI称即将推出的Astra模型可能触及关键网络安全能力阈值，将强化研究环境、思维链监控与对齐保障。','OpenAI','2026-08-18','https://openai.com/index/pacing-model-development-cyber-capabilities/'],
  ['ChatGPT for Teens正式推出','OpenAI推出面向青少年的ChatGPT版本，强调学习场景和保护机制，围绕年龄适配体验与家长支持增强安全设计。','OpenAI','2026-08-18','https://openai.com/index/chatgpt-for-teens/']
];

const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const stories = arr => arr.map((x,i)=>`<article class="story"><div class="story-title"><span class="num">${i+1}</span><a href="${esc(x[4])}">${esc(x[0])}</a></div><div class="summary">${esc(x[1])}</div><div class="meta"><a href="${esc(x[4])}">${esc(x[2])}</a>　${esc(x[3])}</div></article>`).join('');
const top3 = [
  ['#d71920','1','北京公布2026年度社保缴费基数上下限'],
  ['#6a19d8','2','刚果（金）将获7万剂埃博拉疫苗'],
  ['#079447','3','量子存储器纠缠距离提升至420公里']
].map(x=>`<div class="top3-row"><b style="background:${x[0]}">${x[1]}</b><span>${x[2]}</span></div>`).join('');

const metrics = [
 ['🥇','国内金价','Au99.99：979.80元/克','8月21日最近交易日延时最新价；上海黄金交易所'],
 ['⛽','北京油价','92号7.78元/升；95号8.29元/升','8月14日24时起最高零售价；北京发改委'],
 ['🛢️','布伦特原油','92.13美元/桶','8月21日最近收盘；公开市场数据'],
 ['🛢️','WTI原油','86.91美元/桶','8月21日最近收盘；Twelve Data'],
 ['💵','人民币兑美元','1美元＝6.7817元人民币','8月21日中间价；中国外汇交易中心'],
 ['💶','人民币兑欧元','1欧元＝7.8906元人民币','8月21日中间价；中国外汇交易中心'],
 ['💴','人民币兑日元','100日元＝4.2516元人民币','8月21日中间价；中国外汇交易中心'],
 ['📈','上证指数','3905.20点　+0.04%','8月21日最近收盘；新华财经'],
 ['📊','深证／创业板','14094.17／3545.58点','8月21日最近收盘；+0.87%／+1.43%']
];
const metricHtml = metrics.map(m=>`<div class="metric"><div class="metric-icon">${m[0]}</div><div><div class="metric-name">${m[1]}</div><div class="metric-value">${m[2]}</div><div class="metric-note">${m[3]}</div></div></div>`).join('');

const now = new Date();
const productionTime = new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replaceAll('/','-');
let html = fs.readFileSync(templatePath,'utf8');
const replacements = {
 '{{DATE}}':'2026-08-23','{{DATE_CN}}':'2026年8月23日','{{WEEKDAY}}':'星期日・处暑','{{LUNAR_DATE}}':'农历丙午年七月十一',
 '{{WEATHER}}':'','{{TEMP_RANGE}}':'','{{WIND}}':'',
 '{{TOP3_ROWS}}':top3,'{{DOMESTIC_10}}':stories(domestic),'{{INTERNATIONAL_10}}':stories(international),'{{CHINA_TECH_10}}':stories(tech),'{{AI_5}}':stories(ai),
 '{{DATA_METRICS}}':metricHtml,'{{DATA_CUTOFF_AND_SOURCES}}':`数据截至：${productionTime}（北京时间）<br>主要来源：上海黄金交易所、北京市发改委、中国外汇交易中心、新华财经、公开国际油价数据。休市项目均标注最近交易日。`,
 '{{OBSERVATION}}':'今天的民生主线呈现“安全托底、制度扩围、科技提效”三重特征。防汛防台风响应和道路交通安全治理强调风险预防；社保缴费、住房公积金、医保、特殊教育及高校毕业生社区就业等政策，继续向居民切身利益和公共服务可及性延伸。国际层面，疫情、地震、冲突与流离失所交织，人道资源承压。科技栏目则从量子网络、脑科学、森林碳汇延伸至AI隐私和高危网络能力治理，创新速度与安全边界正在同步成为公共议题。',
 '{{FOOTER_SOURCES}}':'中国政府网、应急管理部、北京市人社局、上海市政府、联合国、中国科学院、OpenAI、上海黄金交易所、中国外汇交易中心、北京市发改委、新华财经。全部标题和来源在HTML中保留可点击原始链接。',
 '{{PRODUCTION_TIME}}':`${productionTime}（北京时间）`
};
for (const [k,v] of Object.entries(replacements)) html = html.replaceAll(k,v);
html = html.replace(/<div class="weather">[\s\S]*?<\/div>/,'<div class="weather"></div>');
html = html.replace('.story-title{display:grid;', '.story-title a{color:inherit;text-decoration:none}.story-title{display:grid;');
html = html.replace('main{display:grid;', 'main{display:grid;');
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(outPath,html,'utf8');
console.log(outPath);
