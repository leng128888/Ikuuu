// 从 ikzh1/ikmm1 开始，支持账号1-6（单变量对应单账号）
const BASE_ACCOUNT_VAR = "ikzh";
const BASE_PASSWORD_VAR = "ikmm";
const MIN_INDEX = 1; // 起始序号改为1（ikzh1、ikmm1）
const MAX_INDEX = 6; // 支持到账号6（ikzh6、ikmm6）
const baseURL = "https://ikuuu.de";

const icons = { success: "✅", already: "🟢", error: "❌" };

// 读取账号（从1开始，自动过滤空配置）
function getAccounts() {
    const accounts = [];
    try {
        for (let i = MIN_INDEX; i <= MAX_INDEX; i++) {
            const email = $persistentStore.read(`${BASE_ACCOUNT_VAR}${i}`);
            const pwd = $persistentStore.read(`${BASE_PASSWORD_VAR}${i}`);
            if (email && pwd && email.trim() && pwd.trim()) {
                accounts.push({
                    name: `账号${i}`,
                    email: email.trim(),
                    pwd: pwd.trim()
                });
            }
        }
    } catch (e) {
        throw new Error("变量读取失败，请检查 Loon 变量权限");
    }
    if (accounts.length === 0) throw new Error("无有效账号！请配置 ikzh1-ikzh6 + 对应 ikmm1-ikmm6");
    return accounts;
}

// 简化请求封装（兼容远程引用）
function request(method, url, headers, body) {
    return new Promise((resolve, reject) => {
        const opt = {
            url: url,
            method: method,
            headers: headers || {},
            body: body,
            timeout: 15000,
            cookieJar: true,
            followRedirects: true
        };
        const cb = (err, res, data) => err ? reject(err) : resolve({ status: res?.status || 0, body: data || "" });
        method === "GET" ? $httpClient.get(opt, cb) : $httpClient.post(opt, cb);
    });
}

// 核心签到逻辑
async function checkIn(account) {
    try {
        // 登录
        const loginBody = `email=${encodeURIComponent(account.email)}&passwd=${encodeURIComponent(account.pwd)}&remember_me=on`;
        const loginRes = await request("POST", `${baseURL}/auth/login`, {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"
        }, loginBody);

        if (![200, 302].includes(loginRes.status)) throw new Error(`登录失败[${loginRes.status}]`);
        if (loginRes.body.toLowerCase().includes("错误") || loginRes.body.toLowerCase().includes("failed")) {
            throw new Error("账号密码错误");
        }

        // 检测签到状态
        const userRes = await request("GET", `${baseURL}/user`, {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"
        });
        if (userRes.status !== 200) throw new Error(`验证失败[${userRes.status}]`);

        if (/今日已签到|already/i.test(userRes.body)) {
            const days = userRes.body.match(/连续签到(\d+)天/i)?.[1] || "";
            return { success: true, msg: `${icons.already} ${account.name}: 已签到${days ? "（连续" + days + "天）" : ""}` };
        }

        // 执行签到
        const checkinRes = await request("POST", `${baseURL}/user/checkin`, {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"
        }, "{}");

        if (checkinRes.status !== 200) throw new Error(`签到失败[${checkinRes.status}]`);
        const result = JSON.parse(checkinRes.body);
        return result.ret === 1 
            ? { success: true, msg: `${icons.success} ${account.name}: 签到成功！${result.msg ? "提示：" + result.msg : ""}` }
            : { success: false, msg: `${icons.error} ${account.name}: 签到失败${result.msg ? "：" + result.msg : ""}` };

    } catch (e) {
        return { success: false, msg: `${icons.error} ${account.name}: 处理失败：${e.message}` };
    }
}

// 主函数（确保远程引用正常执行）
async function main() {
    let results = [];
    try {
        const accounts = getAccounts();
        for (const acc of accounts) {
            const res = await checkIn(acc);
            results.push(res.msg);
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (globalErr) {
        results.push(`${icons.error} 全局错误：${globalErr.message}`);
    }

    const title = "🎯 ikuuu 签到结果";
    const subtitle = results.some(m => m.includes(icons.error)) ? "部分失败" : "全部成功";
    const detail = results.join("\n\n") + "\n\n⏰ " + new Date().toLocaleString();
    $notification.post(title, subtitle, detail);
    $done();
}

main();