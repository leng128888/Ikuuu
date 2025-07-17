// ikuuu_checkin.js
const cookie = $persistentStore.read("ikuuu_cookie");
if (!cookie) {
  $notification.post("❌ iKuuu 签到失败", "未找到 Cookie", "请先登录并抓取 Cookie");
  $done();
}

const req = {
  url: "https://ikuuu.one/user/checkin",
  method: "POST",
  headers: {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)...",
    "Referer": "https://ikuuu.one/user",
    "X-Requested-With": "XMLHttpRequest"
  }
};

$httpClient.post(req, (err, resp, data) => {
  if (err) {
    $notification.post("iKuuu 签到失败", "网络错误", err);
    return $done();
  }
  try {
    const obj = JSON.parse(data);
    if (obj.ret === 1) {
      let info = obj.trafficInfo
        ? `今日已用: ${fmt(obj.trafficInfo.todayUsedTraffic)}\n剩余: ${fmt(obj.trafficInfo.unUsedTraffic)}`
        : `获得流量: ${fmt(obj.traffic)}`;
      $notification.post("iKuuu 签到 成功 ✅", obj.msg || "签到成功", info);
    } else {
      const m = obj.msg || "未知错误";
      const title = m.includes("已签到") || m.includes("already") ? "今日已签到" : "签到失败 ❌";
      $notification.post("iKuuu 签到", title, m);
    }
  } catch {
    $notification.post("iKuuu 签到 异常", "解析错误", "");
  }
  $done();
});

function fmt(b) {
  let n = Number(b);
  if (isNaN(n)) return "0B";
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return n.toFixed(2) + u[i];
}