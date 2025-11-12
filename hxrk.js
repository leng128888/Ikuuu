// 自动获取鸿星尔克token+签到

/******************************************

手动打开鸿星尔克小程序，通知获取后禁用脚本
LOON配置
[MITM]
hostname = hope.demogic.com

[Script]
http-request ^https:\/\/hope\.demogic\.com\/gic-wx-app\/get-member-asset\.json
tag=鸿星尔克获取Token, 
script-path=https://raw.githubusercontent.com/leng128888/Ikuuu/main/hxrk.js



******************************************/
const signUrl = "https://hope.demogic.com/gic-wx-app/sign/get-member-sign-info.json";
const needParams = ["memberId", "unionid", "openid", "wxOpenid", "enterpriseId", "appid", "sign"];

// 第一步：MITM 抓包逻辑（简化通知）
function captureParams() {
  try {
    if ($request) {
      const params = JSON.parse($persistentStore.read("signParams") || "{}");
      let hasNewParam = false;

      // 提取URL参数
      const queryStr = $request.url?.split("?")[1];
      queryStr && queryStr.split("&").forEach(item => {
        const [key, value] = item.split("=");
        if (needParams.includes(key) && value) {
          const decodeVal = decodeURIComponent(value);
          if (params[key] !== decodeVal) {
            params[key] = decodeVal;
            hasNewParam = true;
          }
        }
      });

      // 提取POST Body参数
      if ($request.body) {
        try {
          const body = JSON.parse($request.body);
          needParams.forEach(key => {
            if (body[key] && params[key] !== body[key]) {
              params[key] = body[key];
              hasNewParam = true;
            }
          });
        } catch (e) {
          $request.body.split("&").forEach(item => {
            const [key, value] = item.split("=");
            if (needParams.includes(key) && value) {
              const decodeVal = decodeURIComponent(value);
              if (params[key] !== decodeVal) {
                params[key] = decodeVal;
                hasNewParam = true;
              }
            }
          });
        }
      }

      
      if (hasNewParam) {
        $persistentStore.write(JSON.stringify(params), "signParams");
        $notification.post("✅ 参数捕获成功", "", "token已保存");
      }
    }
  } catch (err) {
    console.log("抓包逻辑异常：", err.message);
  }
}

// 第二步：签到逻辑（不变）
function doSign() {
  const storedParams = $persistentStore.read("signParams");
  if (!storedParams) {
    $notification.post("❌ 签到失败", "无存储参数", "请先启动小程序触发抓包");
    $done();
    return;
  }

  let params;
  try {
    params = JSON.parse(storedParams);
  } catch (e) {
    $notification.post("❌ 签到失败", "参数解析错误", "请清空缓存重新抓包");
    $done();
    return;
  }

  // 校验核心参数
  const missingParams = needParams.filter(key => !params[key]);
  if (missingParams.length > 0) {
    $notification.post("❌ 签到失败", "参数缺失", `缺少：${missingParams.join("、")}`);
    $done();
    return;
  }

  // 补充动态参数
  const now = new Date().toLocaleString("zh-CN", {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/\//g, "-").replace(/\s+/g, " ");

  Object.assign(params, {
    timestamp: now,
    transId: `${params.appid}${now}`,
    random: Math.floor(Math.random() * 10000000),
    source: "wxapp",
    cliqueId: "-1",
    cliqueMemberId: "-1",
    useClique: 0,
    gicWxaVersion: "3.9.54",
    launchOptions: "{\"path\":\"pages/member-center/member-sign/index/index\",\"query\":{},\"scene\":1089,\"referrerInfo\":{},\"mode\":\"default\",\"apiCategory\":\"default\"}"
  });

  // 构造请求并发送
  const urlParams = Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
  const requestUrl = `${signUrl}?${urlParams}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) MicroMessenger/8.0.38 NetType/WIFI MiniProgramEnv/iOS",
    "Referer": "https://servicewechat.com/wxa1f1fa3785a47c7d/devtools/page-frame.html",
    "Content-Type": "application/json"
  };

  $httpClient.get({ url: requestUrl, headers: headers }, (err, resp, data) => {
    if (err) {
      $notification.post("❌ 签到失败", "网络异常", err.message);
      $done();
      return;
    }

    try {
      const res = JSON.parse(data);
      if (res.code === "0") {
        const todaySign = res.result.memberSignCalendar?.find(item => item.currentDayFlag === 1);
        todaySign?.signFlag === 1
          ? $notification.post("✅ 签到成功", "", `累计：${res.result.cumulativeSign}天 | 连续：${res.result.continuousSign}天 | 积分：${todaySign.memberSignAwards[0]?.count || 0}分`)
          : $notification.post("❌ 签到失败", "未签到", "参数可能过期，重新打开小程序即可");
      } else {
        $notification.post("❌ 签到失败", "接口错误", res.message || "参数无效");
      }
    } catch (e) {
      $notification.post("❌ 签到失败", "解析异常", e.message);
    }

    $done();
  });
}

// 主逻辑：先抓包再签到
captureParams();
doSign();