
// 自动获取声荐token

/******************************************

手动打开声荐小程序，通知获取后禁用脚本
LOON配置
[MITM]
hostname = xcx.myinyun.com

[Script]
http-request ^https?:\/\/xcx\.myinyun\.com:4438\/napi\/wx\/getUserDetail
tag=声荐获取Token, 
script-path=https://raw.githubusercontent.com/leng128888/Ikuuu/main/yy_tk.js



******************************************/

(function () {
  try {
    const PERSIST_KEY = 'yy_token'; // 持久化存储的key，用于读取token

    // 通知工具函数：发送操作结果提示（兼容环境差异，失败不抛错）
    function notify(title, subtitle, message) {
      try { $notification.post(title, subtitle || '', message || ''); } catch (e) {}
    }

    // 安全写入token：仅清理空格，保留完整Bearer格式，成功/失败均通知
    function safeWrite(token) {
      if (!token) return false; // 空token直接返回失败
      const clean = String(token).trim(); // 只清理前后空格，不删除Bearer前缀
      if (!clean) return false; // 清洗后为空则返回失败
      
      const ok = $persistentStore.write(clean, PERSIST_KEY); // 写入本地存储
      if (ok) {
        // token预览（长token脱敏显示，保护隐私）
        const preview = clean.length > 20 ? `${clean.slice(0,12)}...${clean.slice(-6)}` : clean;
        notify('声荐TOKEN 授权已保存', `key: ${PERSIST_KEY}`, preview);
      } else {
        notify('Myinyun 授权保存失败', `key: ${PERSIST_KEY}`, '');
      }
      return ok;
    }

    // 深度搜索token：递归遍历对象/数组，匹配常见token字段
    function deepSearchForToken(obj) {
      if (!obj || typeof obj !== 'object') return null; // 非对象直接返回
      const keys = ['authorization','auth','token','access_token','bearer','accessToken']; // 常见token字段
      const seen = new Set(); // 避免循环引用
      const stack = [obj]; // 栈结构实现深度遍历

      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
        seen.add(cur); // 标记已处理，防止循环

        for (const k of Object.keys(cur)) {
          try {
            const v = cur[k];
            const kl = String(k).toLowerCase(); // 字段名不区分大小写

            // 匹配token字段名，且值为字符串则返回
            if (keys.includes(kl) && typeof v === 'string') return v;
            // 字符串值中匹配 Bearer token 格式
            if (typeof v === 'string') {
              const m = v.match(/Bearer\s+([A-Za-z0-9\-\._~\+\/=]+)/i);
              if (m && m[1]) return `Bearer ${m[1]}`; // 手动拼接完整Bearer格式
            }
            // 子对象入栈继续遍历
            else if (typeof v === 'object') {
              stack.push(v);
            }
          } catch (e) { continue; } // 单个字段处理失败不影响整体
        }
      }
      return null; // 未找到token返回null
    }

    // 1) 优先从请求头提取token（最常见场景）
    let headers = null;
    try { if (typeof $request !== 'undefined' && $request && $request.headers) headers = $request.headers; } catch (e) {}
    // 兼容不同环境的响应头获取方式
    try {
      if (!headers && typeof $response !== 'undefined' && $response) {
        if ($response.request && $response.request.headers) headers = $response.request.headers;
        else if ($response.rawRequest && $response.rawRequest.headers) headers = $response.rawRequest.headers;
        else if ($response.request && $response.request._headers) headers = $response.request._headers;
        // 处理数组格式的rawHeaders（转为对象）
        else if ($response.request && $response.request.rawHeaders && Array.isArray($response.request.rawHeaders)) {
          const arr = $response.request.rawHeaders;
          headers = {};
          for (let i = 0; i < arr.length; i += 2) {
            const kk = arr[i], vv = arr[i+1];
            if (kk) headers[kk] = vv;
          }
        } else if ($response.headers) {
          headers = $response.headers;
        }
      }
    } catch (e) {}

    // 解析请求头中的token（匹配授权相关字段）
    if (headers && typeof headers === 'object') {
      const auth = headers['authorization'] || headers['Authorization'] || headers['AUTHORIZATION'];
      if (auth && safeWrite(auth)) return $done({}); // 找到则保存并结束
      // 遍历所有请求头字段，匹配关键词
      for (const k of Object.keys(headers)) {
        try {
          if (/auth|token|authorization|bearer/i.test(k) && typeof headers[k] === 'string') {
            if (safeWrite(headers[k])) return $done({});
          }
        } catch (e) { continue; }
      }
    }

    // 2) 从响应的request对象中深度搜索token（兼容部分隐藏字段）
    try {
      if (typeof $response !== 'undefined' && $response && $response.request) {
        const t = deepSearchForToken($response.request);
        if (t && safeWrite(t)) return $done({});
      }
    } catch (e) {}

    // 3) 解析响应体（JSON格式优先，其次正则匹配）
    try {
      let bodyText = '';
      // 兼容不同环境的响应体获取方式
      if (typeof $response !== 'undefined' && $response && $response.body) bodyText = $response.body;
      else if (typeof $responseBody !== 'undefined' && $responseBody) bodyText = $responseBody;

      if (bodyText && typeof bodyText === 'string') {
        // 尝试解析为JSON，深度搜索token
        try {
          const j = JSON.parse(bodyText);
          const t = deepSearchForToken(j);
          if (t && safeWrite(t)) return $done({});
        } catch (e) {} // 非JSON格式不报错，继续正则匹配
        // 正则匹配 Bearer token 格式（保留完整格式）
        const m = bodyText.match(/Bearer\s+([A-Za-z0-9\-\._~\+\/=]+)/i);
        if (m && m[1] && safeWrite(`Bearer ${m[1]}`)) return $done({});
        // 正则匹配常见token字段（如 "access_token": "xxx"，拼接Bearer）
        const m2 = bodyText.match(/(?:"access_token"|'access_token'|accessToken|token|auth)\s*[:=]\s*["']([\w\-._~+\/=]+)["']/i);
        if (m2 && m2[1] && safeWrite(`Bearer ${m2[1]}`)) return $done({});
      }
    } catch (e) {}

    // 4) 从raw原始数据中正则抽取（最后兜底方案，处理特殊格式）
    try {
      const rawCandidates = [];
      if (typeof $response !== 'undefined' && $response) {
        if ($response.raw) rawCandidates.push($response.raw);
        if ($response.request && $response.request.raw) rawCandidates.push($response.request.raw);
        if ($response.request && $response.request.rawRequest) rawCandidates.push($response.request.rawRequest);
      }
      // 遍历所有raw数据，匹配Authorization请求头格式（保留完整格式）
      for (const raw of rawCandidates) {
        if (!raw || typeof raw !== 'string') continue;
        const m = raw.match(/Authorization:\s*(Bearer\s+[A-Za-z0-9\-\._~\+\/=]+)/i);
        if (m && m[1] && safeWrite(m[1])) return $done({});
      }
    } catch (e) {}

    // 所有方式均未找到token（提示禁用脚本，避免无效执行）
    notify('未找到Token', '请检查请求或禁用脚本', '');
    return $done({});
  } catch (err) {
    // 脚本异常捕获，发送错误通知
    try { $notification.post('Myinyun 脚本异常', String(err && err.message ? err.message : err), '请检查脚本'); } catch (e) {}
    return $done({});
  }
})();