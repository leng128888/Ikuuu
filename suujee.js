// Surge Suujee多账号签到脚本（持久化Cookie版）
const CHECKIN_URL = "https://www.suujee.com/wp-admin/admin-ajax.php";
const NOW = new Date().toLocaleString("zh-CN", {timeZone: "Asia/Shanghai"}).replace(/\//g, "-");
const COOKIE_KEY = "suujee_checkin_cookie"; // 与抓包脚本一致的持久化键名

// 日志输出函数
function log(msg) {
    console.log(`[Suujee多账号签到] ${msg}`);
}

// 通知函数
function notify(title, subtitle, content) {
    $notification.post(title, subtitle, content);
}

// 单个账号签到（接收Cookie参数）
function checkin(cookie, index) {
    return new Promise((resolve) => {
        const options = {
            url: CHECKIN_URL,
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.suujee.com/user/",
                "Cookie": cookie // 使用持久化Cookie
            },
            body: "action=user_checkin"
        };

        $httpClient.post(options, (err, resp, data) => {
            if (err) {
                log(`⚠️ 账号${index}签到异常：${err.message}`);
                notify("Suujee签到异常", `账号${index}`, err.message);
                resolve();
                return;
            }

            try {
                const res = JSON.parse(data);
                if (!res.error) {
                    log(`🎉 账号${index}签到成功！`);
                    log(`📢 提示：${res.msg} 积分+${res.data.integral} 经验值+${res.data.integral}`);
                    log(`🔥 连续签到：${res.continuous_day}天`);
                    notify("Suujee签到成功", `账号${index}`, `连续${res.continuous_day}天 | 积分+${res.data.integral}`);
                } else {
                    log(`❌ 账号${index}签到失败：${res.msg}`);
                    notify("Suujee签到失败", `账号${index}`, res.msg);
                }
            } catch (e) {
                log(`⚠️ 账号${index}解析异常：${e.message}`);
                notify("Suujee解析异常", `账号${index}`, e.message);
            }
            resolve();
        });
    });
}

// 主逻辑（读取持久化Cookie）
log(`==== suujee.com 多账号签到脚本启动 ====`);
log(`🚀 执行时间：${NOW}`);

// 读取持久化Cookie（支持多账号用分隔符拆分，默认单个账号）
const storedCookie = $persistentStore.read(COOKIE_KEY);
if (!storedCookie) {
    log(`❌ 未找到持久化Cookie（键：${COOKIE_KEY}）`);
    notify("Suujee签到失败", "关键错误", "未读取到持久化Cookie，请先执行抓包脚本");
    $done();
    return;
}

log(`🍪 已读取持久化Cookie（长度：${storedCookie.length}字符）`);
// 多账号支持：若需添加多个账号，在持久化Cookie中用"||"分隔（例：cookie1||cookie2）
const ACCOUNTS_COOKIES = storedCookie.split("||");

(async () => {
    for (let i = 0; i < ACCOUNTS_COOKIES.length; i++) {
        const cookie = ACCOUNTS_COOKIES[i].trim();
        if (!cookie) continue;
        log(`==== 账号${i+1}开始签到 ====`);
        await checkin(cookie, i+1);
        log("");
    }
    log(`==== 📜 全部账号签到流程结束 ====`);
    $done();
})();