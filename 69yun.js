// 69yun_checkin.js

const account = {
  email: $persistentStore.read("69yun_email") || "",
  password: $persistentStore.read("69yun_password") || ""
};

if (!account.email || !account.password) {
  $notification.post("❌ 69云签到失败", "请先设置账号密码", "在 Surge > Modules > Key-Value 添加对应信息");
  $done();
}

const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";
const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)…";

(async () => {
  try {
    let cookie = await login(account);
    let result = await checkin(cookie);
    notifyResult(result, account.email);
  } catch (e) {
    console.log("❌ 错误：", e);
    $notification.post("69云签到失败", e.message, "");
  } finally {
    $done();
  }
})();

function login(acc) {
  return new Promise((r, j) => {
    $httpClient.post({
      url: loginUrl,
      header: {
        "User-Agent": ua,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `email=${encodeURIComponent(acc.email)}&passwd=${encodeURIComponent(acc.password)}&code=`
    }, (e, resp, body) => {
      if (e) return j(new Error("登录请求失败"));
      if (resp.status !== 200) return j(new Error("登录状态码 " + resp.status));
      let res = JSON.parse(body);
      if (res.ret !== 1) return j(new Error(res.msg || "登录失败"));
      let setCookie = resp.headers["Set-Cookie"] || "";
      j(null, setCookie);
    });
  });
}

function checkin(cookie) {
  return new Promise((r, j) => {
    $httpClient.post({
      url: checkinUrl,
      header: {
        "User-Agent": ua,
        "Cookie": cookie
      }
    }, (e, resp, body) => {
      if (e) return j(new Error("签到请求失败"));
      if (resp.status !== 200) return j(new Error("签到状态码 " + resp.status));
      r(JSON.parse(body));
    });
  });
}

function notifyResult(res, email) {
  const masked = email.replace(/(.).*(.@.*)/, "$1***$2");
  const now = new Date().toLocaleString();
  if (res.ret === 1) {
    $notification.post("🎉 69云签到成功", masked, res.msg || "");
  } else if (res.msg && res.msg.includes("已经")) {
    $notification.post("🔁 今日已签到", masked, res.msg);
  } else {
    $notification.post("❌ 签到失败", masked, res.msg || "");
  }
}