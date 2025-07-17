// ikuuu-cookie.js
// 用于 Surge 抓取 Ikuuu 登录后的 Cookie 并持久化保存

const target = "https://ikuuu.one/user";

if ($request && $request.url.includes("/user")) {
  const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
  if (cookie) {
    $persistentStore.write(cookie, "ikuuu_cookie");
    $notification.post("🍪 Ikuuu Cookie 抓取成功", "", "已成功保存 Cookie。");
  } else {
    $notification.post("⚠️ Ikuuu Cookie 抓取失败", "", "未能读取到 Cookie。");
  }
}

$done();