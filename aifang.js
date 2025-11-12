// Loon 巡检自动提交脚本（终极版，零误判）
const url = "https://jindu.mgr.hzxinyule.com/jindu/api/minijd/addBatchHotelPatrol";
const today = new Date().toISOString().split('T')[0];

// 表单参数
const formData = [
    `token=tttttt`,
    `companyId=19733`,
    `serverDay=${today}`,
    `patrolResult=0`,
    `patrolProblem=`,
    `type=1`,
    `roomAreaIds=47213,47214,47215`,
    `roomAreaNames=一楼大厅,卫生间,二楼大厅`,
    `patrolBatchImgurls={}`,
    `appVersion=3.4.8`
].join('&');

// 发送请求+终极判定逻辑
$httpClient.post({
    url: url,
    headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Accept": "*/*",
        "Connection": "keep-alive"
    },
    body: formData
}, function(err, resp, data) {
    let title, content;
    if (err) {
        title = "巡检提交失败❌";
        content = `日期：${today}\n错误：${err}`;
    } else {
        // 优先用关键词兜底（不管解析是否异常）
        if (data.includes('"result":"保存成功"') || data.includes('保存成功')) {
            title = "巡检提交成功✅";
            content = `日期：${today}\n结果：每日巡查提交成功\n区域：一楼大厅、卫生间、二楼大厅`;
        } else {
            try {
                const outerRes = JSON.parse(data);
                const innerRes = JSON.parse(outerRes.resText);
                title = innerRes.code === "0" ? "巡检提交成功✅" : "巡检提交失败❌";
                content = title.includes("成功") 
                    ? `日期：${today}\n结果：${innerRes.result || "每日巡查提交成功"}\n区域：一楼大厅、卫生间、二楼大厅`
                    : `日期：${today}\n错误码：${innerRes.code}\n提示：${innerRes.errorMsg}`;
            } catch (e) {
                title = "数据解析失败⚠️";
                content = `日期：${today}\n返回数据：${data.slice(0, 80)}`;
            }
        }
    }
    $notification.post(title, "", content);
    console.log(`[巡检结果] ${title}：${content}`);
});