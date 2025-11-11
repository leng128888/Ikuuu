// [MITM]
//hostname = xcx.myinyun.com



// Response 阶段脚本：尽量从 response 中探测并保存 Authorization 到 $persistentStore
(function () {
  try {
    const PERSIST_KEY = 'yy_token'; // ✅ 改成 yy_token

    function notify(title, subtitle, message) {
      try { $notification.post(title, subtitle || '', message || ''); } catch (e) {}
    }

    function safeWrite(token) {
      if (!token) return false;
      const clean = String(token).replace(/^Bearer\s+/i, '').trim();
      if (!clean) return false;
      const ok = $persistentStore.write(clean, PERSIST_KEY);
      if (ok) {
        const preview = clean.length > 12 ? `${clean.slice(0,8)}...${clean.slice(-4)}` : clean;
        notify('声荐TOKEN 授权已保存', `key: ${PERSIST_KEY}`, preview);
      } else {
        notify('Myinyun 授权保存失败', `key: ${PERSIST_KEY}`, '');
      }
      return ok;
    }

    function deepSearchForToken(obj) {
      if (!obj || typeof obj !== 'object') return null;
      const keys = ['authorization','auth','token','access_token','bearer','accessToken'];
      const seen = new Set();
      const stack = [obj];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
        seen.add(cur);
        for (const k of Object.keys(cur)) {
          try {
            const v = cur[k];
            const kl = String(k).toLowerCase();
            if (keys.includes(kl) && typeof v === 'string') return v;
            if (typeof v === 'string') {
              const m = v.match(/Bearer\s+([A-Za-z0-9\-\._~\+\/=]+)/i);
              if (m && m[1]) return m[1];
            } else if (typeof v === 'object') {
              stack.push(v);
            }
          } catch (e) { continue; }
        }
      }
      return null;
    }

    // 1) 尝试获取 headers（多种实现兼容）
    let headers = null;
    try { if (typeof $request !== 'undefined' && $request && $request.headers) headers = $request.headers; } catch (e) {}
    try {
      if (!headers && typeof $response !== 'undefined' && $response) {
        if ($response.request && $response.request.headers) headers = $response.request.headers;
        else if ($response.rawRequest && $response.rawRequest.headers) headers = $response.rawRequest.headers;
        else if ($response.request && $response.request._headers) headers = $response.request._headers;
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

    if (headers && typeof headers === 'object') {
      const auth = headers['authorization'] || headers['Authorization'] || headers['AUTHORIZATION'];
      if (auth && safeWrite(auth)) return $done({});
      for (const k of Object.keys(headers)) {
        try {
          if (/auth|token|authorization|bearer/i.test(k) && typeof headers[k] === 'string') {
            if (safeWrite(headers[k])) return $done({});
          }
        } catch (e) { continue; }
      }
    }

    // 2) 在 $response.request 对象中深度搜索
    try {
      if (typeof $response !== 'undefined' && $response && $response.request) {
        const t = deepSearchForToken($response.request);
        if (t && safeWrite(t)) return $done({});
      }
    } catch (e) {}

    // 3) 解析响应体（JSON 或 正则）
    try {
      let bodyText = '';
      if (typeof $response !== 'undefined' && $response && $response.body) bodyText = $response.body;
      else if (typeof $responseBody !== 'undefined' && $responseBody) bodyText = $responseBody;

      if (bodyText && typeof bodyText === 'string') {
        try {
          const j = JSON.parse(bodyText);
          const t = deepSearchForToken(j);
          if (t && safeWrite(t)) return $done({});
        } catch (e) {}
        const m = bodyText.match(/Bearer\s+([A-Za-z0-9\-\._~\+\/=]+)/i);
        if (m && m[1] && safeWrite(m[1])) return $done({});
        const m2 = bodyText.match(/(?:"access_token"|'access_token'|accessToken|token|auth)\s*[:=]\s*["']([\w\-._~+\/=]+)["']/i);
        if (m2 && m2[1] && safeWrite(m2[1])) return $done({});
      }
    } catch (e) {}

    // 4) 从 raw 候选项正则抽取
    try {
      const rawCandidates = [];
      if (typeof $response !== 'undefined' && $response) {
        if ($response.raw) rawCandidates.push($response.raw);
        if ($response.request && $response.request.raw) rawCandidates.push($response.request.raw);
        if ($response.request && $response.request.rawRequest) rawCandidates.push($response.request.rawRequest);
      }
      for (const raw of rawCandidates) {
        if (!raw || typeof raw !== 'string') continue;
        const m = raw.match(/Authorization:\s*Bearer\s*([A-Za-z0-9\-\._~\+\/=]+)/i);
        if (m && m[1] && safeWrite(m[1])) return $done({});
      }
    } catch (e) {}

    notify('Token已保存', '请禁用脚本', '');
    return $done({});
  } catch (err) {
    try { $notification.post('Myinyun 脚本异常', String(err && err.message ? err.message : err), '请检查脚本'); } catch (e) {}
    return $done({});
  }
})();