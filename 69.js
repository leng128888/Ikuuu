// 名称: 69yun自动签到
// 描述: 每日自动签到+自动登录
// 火华制作：瞎jb搞
// 支持: surge, loon

const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";
const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";

// ⚠️ LOON 配置变量方式
// 在 LOON 里添加 Scriptable Variables:
// 69yun_email
// 69yun_password
const account = {
  email: $persistentStore.read("69yun_email"),
  password: $persistentStore.read("69yun_password")
};

if (!account.email || !account.password) {
  $notification.post(
    "69云签到 ❌", 
    "未配置账号密码", 
    "请在 LOON 脚本面板或变量中配置 69yun_email 和 69yun_password"
  );
  $done();
}

// 主执行函数
async function executeCheckin() {
  try {
    console.log("🚀 开始执行69云签到脚本");
    
    // 1. 执行登录
    console.log("🔐 正在登录账号...");
    const loginResult = await performLogin();
    console.log("✅ 登录成功");
    
    // 2. 执行签到
    console.log("📝 正在执行签到操作...");
    const checkinResult = await performCheckin(loginResult.cookie);
    console.log("📬 签到请求完成");
    
    // 3. 处理结果
    handleResult(checkinResult);
    
  } catch (error) {
    console.log(`❌ 执行失败: ${error.stack || error}`);
    const maskedEmail = maskEmail(account.email);
    const time = new Date().toLocaleTimeString();
    $notification.post(
      "69云签到失败 ❌", 
      `账号: ${maskedEmail} | ${time}`,
      `错误详情: ${error.message}\n\n🚨 请检查账号状态或网络连接`
    );
  } finally {
    $done();
  }
}

// 登录函数
async function performLogin() {
  const loginBody = `email=${encodeURIComponent(account.email)}&passwd=${encodeURIComponent(account.password)}&code=`;
  
  return new Promise((resolve, reject) => {
    $httpClient.post({
      url: loginUrl,
      header: {
        "User-Agent": userAgent,
        "Origin": "https://69yun69.com",
        "Referer": loginUrl,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9"
      },
      body: loginBody
    }, (error, response, data) => {
      if (error) {
        console.log(`🔴 登录请求错误: ${error}`);
        return reject(new Error(`登录请求失败: ${error}`));
      }
      
      console.log(`📡 登录响应状态: ${response.status}`);
      
      if (response.status !== 200) {
        return reject(new Error(`登录失败 | 状态码: ${response.status}`));
      }
      
      try {
        const result = JSON.parse(data);
        console.log(`📋 登录响应数据: ${JSON.stringify(result)}`);
        
        if (result.ret !== 1) {
          return reject(new Error(`登录失败 | ${result.msg || '未知错误'}`));
        }
        
        resolve({
          cookie: response.headers['Set-Cookie'] || '',
          data: result
        });
        
      } catch (e) {
        console.log(`🔴 登录响应解析失败: ${e}`);
        reject(new Error(`登录响应解析失败: ${e.message}`));
      }
    });
  });
}

// 签到函数
async function performCheckin(cookie) {
  return new Promise((resolve, reject) => {
    $httpClient.post({
      url: checkinUrl,
      header: {
        "User-Agent": userAgent,
        "Origin": "https://69yun69.com",
        "Referer": "https://69yun69.com/user",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookie,
        "Content-Length": "0"
      }
    }, (error, response, data) => {
      if (error) {
        console.log(`🔴 签到请求错误: ${error}`);
        return reject(new Error(`签到请求失败: ${error}`));
      }
      
      console.log(`📡 签到响应状态: ${response.status}`);
      
      if (response.status !== 200) {
        return reject(new Error(`签到失败 | 状态码: ${response.status}`));
      }
      
      try {
        const result = JSON.parse(data);
        console.log(`📋 签到响应数据: ${JSON.stringify(result)}`);
        resolve(result);
      } catch (e) {
        console.log(`🔴 签到响应解析失败: ${e}`);
        reject(new Error(`签到响应解析失败: ${e.message}`));
      }
    });
  });
}

// 处理结果
function handleResult(result) {
  const maskedEmail = maskEmail(account.email);
  const date = new Date();
  const timeString = date.toLocaleTimeString();
  const dateString = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
  
  if (result.ret === 0 && result.msg.includes("已经签到过了")) {
    $notification.post(
      "🔁 69云今日已签到 ⏭️", 
      `📧 ${maskedEmail} | ⏰ ${timeString}`,
      `✨ 今日已签到，请明天再来\n\n📅 ${dateString}\n\n${result.msg}`
    );
    console.log(`ℹ️ 今日已签到: ${result.msg}`);
    return;
  }
  
  if (result.ret === 1) {
    const msg = result.msg || "签到成功";
    const traffic = formatTraffic(result.traffic) || "0B";
    
    $notification.post(
      "🎉 69云签到成功 ✅", 
      `📧 ${maskedEmail} | ⏰ ${timeString}`,
      `✨ ${msg}\n\n🚀 获得流量: ${traffic}\n📅 ${dateString}`
    );
    console.log(`✅ 签到成功: ${msg}, 流量: ${traffic}`);
    return;
  }
  
  throw new Error(`签到失败 | ${result.msg || '未知错误'}`);
}

// 邮箱打码处理
function maskEmail(email) {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  
  const maskedName = name.length > 2 
    ? name[0] + "*".repeat(3) + name.slice(-1)
    : name[0] + "*";
  
  return maskedName + "@" + domain;
}

// 流量格式化
function formatTraffic(bytes) {
  if (!bytes) return "0B";
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = parseFloat(bytes);
  
  if (isNaN(size)) return bytes;
  
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return size.toFixed(2) + units[unitIndex];
}

// 启动脚本
executeCheckin();