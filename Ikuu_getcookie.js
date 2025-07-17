// ikuuu_getcookie.js
if ($request.headers) {
  const cookie = $request.headers['Cookie'];
  if (cookie) {
    $persistentStore.write(cookie, "ikuuu_cookie");
    $notification.post("🍪 Cookie 获取成功", "iKuuu", "已保存 Cookie");
  }
}
$done({});