// 单变量对应单账号（支持 ikzh1-ikzh6 + ikmm2-ikmm6，可无限扩展）
const BASE_ACCOUNT_VAR = "ikzh"; // 账号变量前缀
const BASE_PASSWORD_VAR = "ikmm"; // 密码变量前缀
const MIN_INDEX = 1; // 起始序号（ikzh2、ikmm2）
const MAX_INDEX = 6; // 结束序号（ikzh6、ikmm6）

const baseURL = "https://ikuuu.de";
const loginUrl = `${baseURL}/auth/login`;
const userUrl = `${baseURL}/user`;
const checkinUrl = `${baseURL}/user/checkin`;

// 状态图标
const icons = {
    success: "✅",
    already: "🟢",
    error: "❌",
    warning: "⚠️"
};

// 读取指定序号的账号密码，生成多账号列表
function getAccounts() {
    const accounts = [];
    for (let i = MIN_INDEX; i <= MAX_INDEX; i++) {
        const email = $persistentStore.read(`${BASE_ACCOUNT_VAR}${i}`)?.trim();
        const password = $persistentStore.read(`${BASE_PASSWORD_VAR}${i}`)?.trim();
        // 非空才添加（支持部分账号配置，无需填满1-6）
        if (email && password) {
            accounts.push({
                name: `账号${i}`, // 账号名称=变量序号（账号2、账号3...）
                email: email,
                password: password
            });
        }
    }
    if (accounts.length === 0) {
        throw new Error(`未配置有效账号！请在 Loon 变量中设置 ikzh1-ikzh6 和对应 ikmm1-ikmm6`);
    }
    return accounts;
}

// Loon 兼容请求封装
async function loonRequest(method, url, options = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = {
            url: url,
            method: method,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                ...options.headers
            },
            body: options.body,
            timeout: 15000,
            followRedirects: true,
            cookieJar: true
        };
        const callback = (error, response, data) => 
            error ? reject(new Error(`请求失败: ${error.message || error}`)) : resolve({
                status: response?.status || 0,
                headers: response?.headers || {},
                body: data || ""
            });
        method === "GET" ? $httpClient.get(requestOptions, callback) : $httpClient.post(requestOptions, callback);
    });
}

async function checkIn(account) {
    try {
        console.log(`\n===== 开始处理 ${account.name}: ${account.email} =====`);

        // 登录
        const loginBody = new URLSearchParams({
            email: account.email,
            passwd: account.password,
            remember_me: "on"
        }).toString();
        const loginResponse = await loonRequest("POST", loginUrl, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": baseURL,
                "Referer": loginUrl
            },
            body: loginBody
        });

        if (![200, 302].includes(loginResponse.status)) throw new Error(`登录失败，状态码: ${loginResponse.status}`);
        if (["邮箱或密码错误", "无效的登录凭据", "login failed"].some(k => loginResponse.body.toLowerCase().includes(k.toLowerCase()))) {
            throw new Error("邮箱或密码错误");
        }
        console.log(`${account.name} 登录成功`);

        // 验证登录状态
        const userResponse = await loonRequest("GET", userUrl, { headers: { "Referer": baseURL } });
        if (userResponse.status !== 200) throw new Error(`验证失败，状态码: ${userResponse.status}`);

        // 检测已签到
        if (/今日已签到|已连续签到|checkin.*already/i.test(userResponse.body)) {
            const daysMatch = userResponse.body.match(/连续签到 (\d+) 天|连续签到(\d+)天/i);
            const statusText = daysMatch ? `今日已签到（连续${daysMatch[1]}天）` : "今日已签到";
            const msg = `${icons.already} ${account.name}: ${statusText}`;
            console.log(msg);
            return { success: true, already: true, message: msg };
        }

        // 执行签到
        const checkinResponse = await loonRequest("POST", checkinUrl, {
            headers: {
                "Content-Type": "application/json",
                "Referer": userUrl,
                "Origin": baseURL,
                "X-Requested-With": "XMLHttpRequest"
            },
            body: JSON.stringify({})
        });
        if (checkinResponse.status !== 200) throw new Error(`签到失败，状态码: ${checkinResponse.status}`);

        const result = JSON.parse(checkinResponse.body);
        if (result?.ret === 1) {
            const msg = `${icons.success} ${account.name}: 签到成功！\n📅 提示: ${result.msg || "获得随机流量"}`;
            console.log(msg);
            return { success: true, already: false, message: msg };
        } else if (result?.ret === 0 && /已签到|already/i.test(result.msg)) {
            const msg = `${icons.already} ${account.name}: ${result.msg}`;
            console.log(msg);
            return { success: true, already: true, message: msg };
        } else {
            throw new Error(`签到失败: ${result?.msg || "未知错误"}`);
        }

    } catch (error) {
        const msg = `${icons.error} ${account.name}: 处理失败\n⚠️ 原因: ${error.message}`;
        console.log(msg);
        return { success: false, message: msg };
    }
}

async function main() {
    try {
        const accounts = getAccounts();
        const results = [];
        let hasError = false;

        for (const account of accounts) {
            const result = await checkIn(account);
            results.push(result);
            if (!result.success) hasError = true;
            await new Promise(r => setTimeout(r, 2000)); // 间隔防风控
        }

        // 汇总通知
        const title = `🎯 ikuuu 多账号签到结果`;
        const successCount = results.filter(r => r.success).length;
        const subtitle = hasError 
            ? `${icons.warning} 部分成功 (${successCount}/${accounts.length})` 
            : `${icons.success} 全部成功 (${successCount}/${accounts.length})`;
        const detail = `${results.map(r => r.message).join("\n\n")}\n\n⏰ 执行时间: ${new Date().toLocaleString()}`;

        $notification.post(title, subtitle, detail.trim());
        console.log(`\n===== 所有账号处理完成 =====\n${detail}`);

    } catch (globalError) {
        const errMsg = `${icons.error} 全局错误\n⚠️ 原因: ${globalError.message}`;
        $notification.post("🎯 ikuuu 签到失败", "配置错误", errMsg);
        console.log(errMsg);
    } finally {
        $done();
    }
}

main();