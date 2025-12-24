/* 抓包模式 刷新网页
 * 脚本类型：HTTP-REQUEST
 * 匹配类型：URL 正则
 * 匹配内容：^https?:\/\/www\.suujee\.com\/wp-admin\/admin-ajax\.php
*/
const targetUrl = "https://www.suujee.com/wp-admin/admin-ajax.php";
const KEY_FIELDS = ["wordpress_sec_", "wordpress_logged_in_", "PHPSESSID", "HMACCOUNT", "server_name_session"];

// 成功通知函数（全程仅调用1次）
function successNotify(title, msg) {
    $notification.post(title, "", msg);
    console.log(`[成功通知] ${title}：${msg}`);
}

// 仅日志输出函数
function onlyLog(msg) {
    console.log(`[Cookie提取] ${msg}`);
}

// 主逻辑
try {
    // 1. 校验请求对象
    if (!$request || !$request.url) {
        onlyLog("❌ 脚本未命中：未检测到请求对象，请检查分流规则");
        $done({});
        return;
    }
    onlyLog(`✅ 脚本命中请求：${$request.url} | 方法：${$request.method}`);

    // 2. 提取原始Cookie
    const rawCookie = $request.headers["cookie"] || $request.headers["Cookie"] || "";
    if (!rawCookie) {
        onlyLog("❌ 请求头无Cookie数据");
        $done({ request: $request });
        return;
    }
    onlyLog(`✅ 检测到Cookie，长度：${rawCookie.length}字符`);

    // 3. 筛选关键字段
    const cookieMap = {};
    rawCookie.split("; ").forEach(item => {
        const [key, value] = item.split("=", 2);
        if (key && value && KEY_FIELDS.some(k => key.startsWith(k))) {
            cookieMap[key] = value;
        }
    });

    // 4. 校验是否提取到有效字段
    if (Object.keys(cookieMap).length === 0) {
        onlyLog("❌ 未筛选到任何关键Cookie字段");
        $done({ request: $request });
        return;
    }

    // 5. 持久化存储+拼接通知内容
    let notifyMsg = "";
    let finalCookie = "";
    Object.keys(cookieMap).forEach(key => {
        const newValue = cookieMap[key];
        const oldValue = $persistentStore.read(`suujee_${key}`);
        notifyMsg += newValue !== oldValue ? `🔄 ${key} 已更新\n` : `✅ ${key} 未变化\n`;
        $persistentStore.write(newValue, `suujee_${key}`);
        finalCookie += `${key}=${newValue}; `;
    });

    // 存储完整Cookie串
    $persistentStore.write(finalCookie.trim(), "suujee_checkin_cookie");
    notifyMsg += "\n✅ 完整Cookie已持久化（键：suujee_checkin_cookie）";

    // 唯一1次成功弹窗
    successNotify("Cookie提取成功", notifyMsg.trim());

} catch (error) {
    onlyLog(`❌ 脚本执行异常：${error.message} | 行号：${error.line || "未知"}`);
}

$done({ request: $request });