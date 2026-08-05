const cloud = require("wx-server-sdk");
const https = require("https");
const { URL } = require("url");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 });
const db = cloud.database();
const _ = db.command;
const AGENT_ID = "agt-timeslip-4gbqdboj2f9f506d";
const ACP_ENDPOINT =
  "https://cloud1-d8guq74iacc68352a.api.tcloudbasegateway.com/v1/aibot/bots/agt-timeslip-4gbqdboj2f9f506d/acp";
// TODO: 迁移后从新环境 cloud1-d8guq74iacc68352a 控制台重新生成 Publishable Key 并替换下面这行
const PUBLISHABLE_KEY =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL2Nsb3VkMS1kOGd1cTc0aWFjYzY4MzUyYS5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoiY2xvdWQxLWQ4Z3VxNzRpYWNjNjgzNTJhIiwiZXhwIjo0MDg5NjM5MzY2LCJpYXQiOjE3ODU5NTYxNjYsIm5vbmNlIjoiSlBaREczTjZTLXVMZzUzT1pXZjQ0ZyIsImF0X2hhc2giOiJKUFpERzNONlMtdUxnNTNPWldmNDRnIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImNsb3VkMS1kOGd1cTc0aWFjYzY4MzUyYSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.PzYAfjYkqwovp23xgkgWyCVmsNel_kYkvhI0DfVZTw74luIfkZO_qX0N2UsZ4O_ZeFgx2buqOE-fkE894vK_O7Eckk1r_bI0jDEW-NmgnSjMnaHo75S-zhcd0u38_dOKZTDeF9g1K79hT0LPcHEFjgo0VStu0QlBrVMeC_pD58h_MjEBZc8VRMd2O12I7tFy3dnFSeWjhEZ5HJy5tvaSOvBamGzrcoxmbaluSkqSzBeJoWahmet_tzlcEvcCxx09HziDB4JO5i7BiIge_d6RLVvAhDT9BD1JuIfhforvB91f-8Nrx9A8hTiaIC_i6iySDkZzC64oEd85sFMOD0L1DQ";

// 生成 JSON-RPC 请求 ID
function genRpcId() {
  return "rpc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// 从SSE事件块中提取文本（只取 agent_message_chunk，跳过思考过程 agent_thought_chunk）
function extractTextFromSsePart(part, onText) {
  const lines = part.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const evt = JSON.parse(dataStr);
        if (
          evt &&
          evt.method === "session/update" &&
          evt.params &&
          evt.params.update
        ) {
          const update = evt.params.update;
          const su = update.sessionUpdate;
          // 只提取真正回复用户的消息块，跳过思考过程 agent_thought_chunk
          if (
            su === "agent_message_chunk" &&
            update.content &&
            typeof update.content.text === "string"
          ) {
            onText(update.content.text);
          }
        }
      } catch (_) {}
    }
  }
}

// ACP JSON-RPC 调用（流式 SSE 响应）
function acpRequest(method, params) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(ACP_ENDPOINT);
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: genRpcId(),
      method,
      params: params || {},
    });

    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + PUBLISHABLE_KEY,
          Accept: "text/event-stream",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 55000,
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errBody = "";
          res.on("data", (chunk) => {
            errBody += chunk;
          });
          res.on("end", () =>
            reject(
              new Error(`ACP_HTTP_${res.statusCode}: ${errBody.slice(0, 500)}`),
            ),
          );
          return;
        }

        let fullText = "";
        let buf = "";
        res.on("data", (chunk) => {
          buf += chunk.toString("utf8");
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            extractTextFromSsePart(part, (text) => {
              fullText += text;
            });
          }
        });

        res.on("end", () => {
          if (buf.trim())
            extractTextFromSsePart(buf, (text) => {
              fullText += text;
            });
          resolve(fullText.trim());
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("ACP_TIMEOUT")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// 通用指数退避重试（容器冷启动 DNS/TLS 偶发 443/DNS 失败时救急）
function withRetry(fn, opts = {}) {
  const max = opts.max != null ? opts.max : 2;
  const baseMs = opts.baseMs || 800;
  const jitterMs = opts.jitterMs || 400;
  const retryOn =
    typeof opts.retryOn === "function" ? opts.retryOn : () => true;
  const onRetry = typeof opts.onRetry === "function" ? opts.onRetry : () => {};
  let attempt = 0;
  const run = () =>
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        attempt += 1;
        if (attempt > max || !retryOn(err)) throw err;
        const delay = baseMs * attempt + Math.floor(Math.random() * jitterMs);
        try {
          onRetry(attempt, max, err, delay);
        } catch (_) {}
        return new Promise((res) => setTimeout(res, delay)).then(run);
      });
  return run();
}

// 青月角色元数据（与前端 QINGYUE 对齐）
const FIGURE_ID = "sys_qingyue";
const FIGURE_NAME = "青月";
const FIGURE_TITLE = "系统";
const FIGURE_AVATAR = "/images/qingyue.jpg";

const MAX_TEXT = 500;
const MAX_HISTORY = 20;
const MAX_SEARCH_RESULTS = 5;

function buildPromptWithHistory(text, history) {
  const pairs = (history || []).slice(-8);
  if (!pairs.length) return text;
  const historyText = pairs
    .map((m) => `${m.role === "user" ? "用户" : "青月"}：${m.content}`)
    .join("\n");
  return `【最近对话】\n${historyText}\n\n【用户当前问题】\n${text}`;
}

function shouldUseWebSearch(text) {
  const t = String(text || "").toLowerCase();
  const realtimeKeywords = [
    "今天",
    "明天",
    "后天",
    "现在",
    "当前",
    "最近",
    "最新",
    "实时",
    "天气",
    "气温",
    "下雨",
    "台风",
    "空气质量",
    "新闻",
    "热搜",
    "上映",
    "开放",
    "闭馆",
    "门票",
    "价格",
    "股价",
    "汇率",
    "赛事",
    "比分",
    "日程",
    "政策",
    "公告",
  ];
  return realtimeKeywords.some((keyword) => t.indexOf(keyword) >= 0);
}

function buildSearchQuery(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (
    raw.indexOf("天气") >= 0 &&
    !/[省市县区]|北京|上海|广州|深圳|杭州|南京|苏州|成都|重庆|武汉|西安|长沙|厦门|青岛|天津/.test(
      raw,
    )
  ) {
    return raw + " 上海";
  }
  return raw;
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: Object.assign(
          {
            "User-Agent": "Mozilla/5.0 qingyue-agent web-search",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          headers,
        ),
        timeout: 12000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`WEB_SEARCH_HTTP_${res.statusCode}`));
            return;
          }
          resolve(body);
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("WEB_SEARCH_TIMEOUT")));
    req.on("error", reject);
    req.end();
  });
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeDuckDuckGoUrl(url) {
  const raw = decodeHtml(url || "");
  try {
    const parsed = new URL(raw, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return parsed.href;
  } catch (e) {
    return raw;
  }
}

function normalizeSearchUrl(url, base) {
  const raw = decodeHtml(url || "");
  try {
    return new URL(raw, base).href;
  } catch (e) {
    return raw;
  }
}

function parseSoWeatherResult(html) {
  const raw = String(html || "");
  const weatherStart = raw.indexOf('id="mohe-weather"');
  if (weatherStart < 0) return null;

  const weatherEndCandidates = [
    raw.indexOf("mh-source-wrap", weatherStart),
    raw.indexOf("</li>", weatherStart),
  ].filter((i) => i > weatherStart);
  const weatherEnd = weatherEndCandidates.length
    ? Math.min(...weatherEndCandidates)
    : weatherStart + 30000;
  const snippet = stripHtml(raw.slice(weatherStart, weatherEnd)).slice(0, 1200);
  if (!snippet) return null;

  return {
    title: "360搜索天气卡片",
    url: "https://www.so.com/s",
    snippet,
  };
}

function parseSoSearchResults(html) {
  const results = [];
  const weather = parseSoWeatherResult(html);
  if (weather) results.push(weather);

  const blocks = String(html || "")
    .split(/<li[^>]+class="[^"]*res-list[^"]*"[^>]*>/i)
    .slice(1);
  blocks.forEach((block) => {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    if (block.indexOf('id="mohe-weather"') >= 0) return;

    const titleMatch =
      block.match(
        /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i,
      ) || block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>/i);
    if (!titleMatch) return;

    const snippetMatch =
      block.match(
        /<p[^>]+class="[^"]*(?:res-desc|content|summary|g-card-desc)[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      ) ||
      block.match(
        /<div[^>]+class="[^"]*(?:res-rich|res-desc|content|summary)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      );

    const title = stripHtml(titleMatch[2]);
    const url = normalizeSearchUrl(titleMatch[1], "https://www.so.com");
    const snippet =
      stripHtml(snippetMatch && snippetMatch[1]) ||
      stripHtml(block).slice(0, 260);
    if (!title || !url || title.length > 120) return;
    results.push({ title, url, snippet });
  });

  if (!results.length) {
    const fallback = stripHtml(html).slice(0, 1200);
    if (fallback) {
      results.push({
        title: "360搜索页面摘要",
        url: "https://www.so.com/s",
        snippet: fallback,
      });
    }
  }

  return results.slice(0, MAX_SEARCH_RESULTS);
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const blocks = String(html || "")
    .split(/<div class="result results_links[^"]*">/i)
    .slice(1);
  blocks.forEach((block) => {
    if (results.length >= MAX_SEARCH_RESULTS) return;
    const titleMatch = block.match(
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!titleMatch) return;
    const snippetMatch =
      block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const title = stripHtml(titleMatch[2]);
    const url = normalizeDuckDuckGoUrl(titleMatch[1]);
    const snippet = stripHtml(snippetMatch && snippetMatch[1]);
    if (!title || !url) return;
    results.push({ title, url, snippet });
  });
  return results;
}

async function webSearch(query) {
  const q = buildSearchQuery(query);
  if (!q) return [];
  const providers = [
    {
      name: "so",
      url: "https://www.so.com/s?q=" + encodeURIComponent(q),
      parse: parseSoSearchResults,
    },
    {
      name: "duckduckgo",
      url: "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q),
      parse: parseDuckDuckGoResults,
    },
  ];
  const errors = [];
  for (const provider of providers) {
    try {
      const html = await withRetry(() => httpGet(provider.url), {
        max: 1,
        baseMs: 600,
        jitterMs: 300,
        retryOn: (err) =>
          /443|EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|HTTP_443/i.test(
            (err && err.message) || "",
          ),
      });
      const results = provider.parse(html);
      if (results && results.length) {
        return results.map((item) =>
          Object.assign({ source: provider.name }, item),
        );
      }
      errors.push(`${provider.name}: EMPTY_RESULTS`);
    } catch (e) {
      errors.push(`${provider.name}: ${e && e.message ? e.message : e}`);
    }
  }
  throw new Error(`WEB_SEARCH_FAILED: ${errors.join("; ")}`);
}

function buildPromptWithWeb(text, history, searchResults) {
  const base = buildPromptWithHistory(text, history);
  if (!searchResults || !searchResults.length) return base;
  const now = new Date().toISOString();
  const webText = searchResults
    .map((r, i) => {
      return `${i + 1}. ${r.title}\n摘要：${r.snippet || "无摘要"}\n链接：${r.url}`;
    })
    .join("\n\n");
  return `${base}

【联网搜索结果】
检索时间：${now}
以下搜索结果可能包含实时信息。回答时请优先基于这些结果，不要编造；如果搜索结果不足以确认，请明确说明。

${webText}`;
}

// 从 chat_messages 查历史，组装为 history 参数
async function getHistoryForBot(OPENID) {
  try {
    const r = await db
      .collection("chat_messages")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .orderBy("createdAt", "desc")
      .limit(MAX_HISTORY)
      .get();
    return r.data.reverse().map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: String(m.content || "").slice(0, 1000),
    }));
  } catch (e) {
    return [];
  }
}

// ============ 内容安全 ============

// 模块级冷却：同一实例 5 分钟内最多尝试重置一次，避免把每月 10 次额度一次烧光
let _lastQuotaResetAt = 0;
const QUOTA_RESET_COOLDOWN_MS = 5 * 60 * 1000;

// 内容安全结果缓存：相同内容 10 分钟内不重复检测，大幅降低 msgSecCheck 调用量
const _secCache = new Map();
const SEC_CACHE_TTL = 10 * 60 * 1000;
const SEC_CACHE_MAX = 500;

function secCacheKey(text) {
  let h = 0;
  const s = String(text).slice(0, 500);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return "sec_" + h;
}
function getSecCache(text) {
  const k = secCacheKey(text);
  const v = _secCache.get(k);
  if (!v) return null;
  if (Date.now() > v.expireAt) {
    _secCache.delete(k);
    return null;
  }
  return v.result;
}
function setSecCache(text, result) {
  if (_secCache.size >= SEC_CACHE_MAX) {
    let i = 0;
    for (const key of _secCache.keys()) {
      _secCache.delete(key);
      if (++i >= 100) break;
    }
  }
  _secCache.set(secCacheKey(text), {
    result,
    expireAt: Date.now() + SEC_CACHE_TTL,
  });
}

/**
 * 通过 clearQuotaByAppSecret 重置全量 API 每日调用次数
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/server/API/openApi-mgnt/api_clearquotabyappsecret.html
 * 需要在云函数环境变量里配置 WX_APPSECRET
 */
function resetApiQuota(appid) {
  const appsecret = process.env.WX_APPSECRET;
  if (!appsecret) {
    console.warn("[quota] WX_APPSECRET env not set, skip auto-reset");
    return Promise.resolve(false);
  }
  const now = Date.now();
  if (now - _lastQuotaResetAt < QUOTA_RESET_COOLDOWN_MS) {
    console.warn("[quota] cooldown active, skip reset");
    return Promise.resolve(false);
  }
  _lastQuotaResetAt = now;
  return new Promise((resolve) => {
    try {
      const url = `https://api.weixin.qq.com/cgi-bin/clear_quota/v2?appid=${encodeURIComponent(appid)}&appsecret=${encodeURIComponent(appsecret)}`;
      const body = JSON.stringify({ appid });
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 8000,
        },
        (res) => {
          let resp = "";
          res.on("data", (chunk) => {
            resp += chunk;
          });
          res.on("end", () => {
            try {
              const r = JSON.parse(resp);
              if (r.errcode === 0) {
                console.log("[quota] quota reset ok");
                resolve(true);
              } else {
                console.warn("[quota] reset failed:", r);
                resolve(false);
              }
            } catch (e) {
              console.warn("[quota] parse err:", resp.slice(0, 200));
              resolve(false);
            }
          });
        },
      );
      req.on("error", (e) => {
        console.warn("[quota] req err:", e.message);
        resolve(false);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.write(body);
      req.end();
    } catch (e) {
      console.warn("[quota] unexpected err:", e.message);
      resolve(false);
    }
  });
}

// a ?? b 兼容写法（Node 10 不支持 ??）
function pick(val, fallback) {
  return val !== null && val !== undefined ? val : fallback;
}

async function checkText(text, openid) {
  if (!text) return { ok: true };
  const content = String(text).slice(0, 2000);
  const cached = getSecCache(content);
  if (cached) return cached;

  const { APPID } = cloud.getWXContext();
  const cacheIfDefinitive = function (result) {
    if (result && result.ok) setSecCache(content, { ok: true });
    else if (result && result.reason)
      setSecCache(content, { ok: false, reason: result.reason });
    return result;
  };

  const doCheck = async function () {
    const r = await cloud.openapi.security.msgSecCheck({
      openid: openid,
      version: 2,
      scene: 1,
      content: content,
    });
    const errCode = r && pick(r.errCode, r.errcode);
    const result = r && r.result;
    if (errCode !== undefined && errCode !== 0) {
      if (errCode === 87014) {
        return { ok: false, reason: "内容包含不当信息", definitive: true };
      }
      return {
        ok: false,
        errCode: errCode,
        needReset: errCode === 45009,
        errMsg: r.errMsg || r.errmsg,
      };
    }
    if (result && result.suggest && result.suggest !== "pass") {
      return {
        ok: false,
        reason: "内容包含不当信息：" + (result.label || ""),
        definitive: true,
      };
    }
    return { ok: true, definitive: true };
  };

  try {
    const res = await doCheck();
    if (res.definitive) return cacheIfDefinitive(res);
    if (res.needReset) {
      console.warn("[secCheck] 45009 quota exhausted, attempting reset...");
      const resetOk = await resetApiQuota(APPID);
      if (resetOk) {
        try {
          const retry = await doCheck();
          if (retry.definitive) return cacheIfDefinitive(retry);
        } catch (retryErr) {
          console.warn(
            "[secCheck] retry after reset failed:",
            extractErrCode(retryErr),
          );
        }
      }
    }
    console.warn("[secCheck] non-block err (fail-open):", {
      errCode: res.errCode,
      errMsg: res.errMsg,
    });
    return { ok: true };
  } catch (e) {
    const msg = e && (e.errMsg || e.errmsg || e.message || "");
    const codeMatch = String(msg).match(/errCode:\s*(-?\d+)/);
    const errCode = pick(
      e && pick(e.errCode, e.errcode),
      codeMatch ? Number(codeMatch[1]) : null,
    );
    if (errCode === 87014) {
      return cacheIfDefinitive({ ok: false, reason: "内容包含不当信息" });
    }
    if (errCode === 45009) {
      console.warn("[secCheck] 45009 in throw, attempting reset...");
      const resetOk = await resetApiQuota(APPID);
      if (resetOk) {
        try {
          const retry = await doCheck();
          if (retry.definitive) return cacheIfDefinitive(retry);
        } catch (retryErr) {
          console.warn(
            "[secCheck] retry after reset failed:",
            extractErrCode(retryErr),
          );
        }
      }
    }
    console.warn("[secCheck] throw (fail-open):", {
      errCode: errCode,
      errMsg: msg.slice(0, 300),
    });
    return { ok: true };
  }
}

function extractErrCode(e) {
  if (!e) return null;
  const msg = e.errMsg || e.errmsg || e.message || "";
  const m = String(msg).match(/errCode:\s*(-?\d+)/);
  const code = pick(pick(e.errCode, e.errcode), m ? Number(m[1]) : null);
  return { errCode: code, errMsg: msg.slice(0, 200) };
}

// ============ 落库 ============

async function saveMsg(doc) {
  await db.collection("chat_messages").add({ data: doc });
}

async function bumpSession(OPENID, lastMsg, patch) {
  const r = await db
    .collection("chat_sessions")
    .where({ _openid: OPENID, figureId: FIGURE_ID })
    .limit(1)
    .get();
  const now = db.serverDate();
  if (r.data.length) {
    await db
      .collection("chat_sessions")
      .doc(r.data[0]._id)
      .update({
        data: Object.assign(
          { lastMessage: lastMsg, lastTime: now, updatedAt: now },
          patch || {},
        ),
      });
  } else {
    await db.collection("chat_sessions").add({
      data: Object.assign(
        {
          _openid: OPENID,
          figureId: FIGURE_ID,
          figureName: FIGURE_NAME,
          figureTitle: FIGURE_TITLE,
          dynasty: "",
          avatar: FIGURE_AVATAR,
          lastMessage: lastMsg,
          lastTime: now,
          unreadCount: 0,
          isSystem: true,
          status: "done",
          agentSessionId: "",
          createdAt: now,
          updatedAt: now,
        },
        patch || {},
      ),
    });
  }
}

// ============ Actions ============

const DAILY_LIMIT = 100;

// 获取今天的日期字符串（Asia/Shanghai），格式 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const sh = new Date(utc + 8 * 3600000);
  const y = sh.getFullYear();
  const m = String(sh.getMonth() + 1).padStart(2, "0");
  const day = String(sh.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

async function checkDailyLimit(OPENID) {
  const day = todayStr();
  const _ = db.command;
  const start = new Date(day + "T00:00:00+08:00");
  const end = new Date(day + "T23:59:59+08:00");
  try {
    const c = await db
      .collection("chat_messages")
      .where({
        _openid: OPENID,
        role: "user",
        createdAt: _.gte(start).and(_.lte(end)),
      })
      .count();
    const used = (c && c.total) || 0;
    return { used: used, limit: DAILY_LIMIT, reached: used >= DAILY_LIMIT };
  } catch (e) {
    console.warn("[dailyLimit] count failed, fail-open:", e.message);
    return { used: 0, limit: DAILY_LIMIT, reached: false };
  }
}

async function handleSend(OPENID, data) {
  const { text, localMessageId } = data;
  if (!text) return { code: -1, message: "缺少 text" };
  if (String(text).length > MAX_TEXT)
    return { code: -1, message: "消息不能超过500字" };

  // 每日消息数限流（全局，不区分角色）
  const limitCheck = await checkDailyLimit(OPENID);
  if (limitCheck.reached) {
    return {
      code: 429,
      message: "已达到今日聊天次数上限，明天再来",
      data: { used: limitCheck.used, limit: DAILY_LIMIT },
    };
  }

  // 内容安全
  const sec = await checkText(text, OPENID);
  if (!sec.ok) return { code: 403, message: sec.reason };

  // 写 user message（先落库，再调 Agent，保证历史完整）
  const now = db.serverDate();
  const userMsgId =
    localMessageId ||
    "u_" + Date.now() + Math.random().toString(36).slice(2, 6);
  await saveMsg({
    _id: userMsgId,
    _openid: OPENID,
    figureId: FIGURE_ID,
    role: "user",
    content: text,
    mode: "agent",
    createdAt: now,
    updatedAt: now,
  });

  // 进入云函数即写 processing 状态（前端 onShow 时据此恢复 typing 标题）
  try {
    await bumpSession(OPENID, text, {
      status: "processing",
      pendingMessageId: userMsgId,
    });
  } catch (_) {}

  // 取历史（含刚写的 user message 之前的记录）
  const history = await getHistoryForBot(OPENID);
  // sendMessage 的 history 应为本次 msg 之前的对话，不含当前 msg
  // getHistoryForBot 已包含刚写入的 user message，需去掉最后一条
  const historyBefore = history.slice(0, -1);

  // 调用 CloudBase AI SDK bot.sendMessage（内网通道，避免 https.request 的 443 连通问题）
  const startedAt = Date.now();
  let finalContent = "";
  try {
    let searchResults = [];
    if (shouldUseWebSearch(text)) {
      try {
        searchResults = await webSearch(text);
      } catch (searchErr) {
        console.warn(
          "[qingyue-agent] web search failed:",
          searchErr && searchErr.message,
        );
      }
    }
    // bot.sendMessage 的 msg 必须是纯用户问题，不能包 buildPromptWithHistory/ buildPromptWithWeb
    // 否则会破坏 Agent 后台的工具路由（如"查询可对话人物名单"会被误触发）
    // 联网搜索结果作为前置参考信息拼到 msg 之前，用清晰分隔符隔开
    let finalMsg = text;
    if (searchResults && searchResults.length) {
      const now = new Date().toISOString();
      const webText = searchResults
        .map((r, i) => {
          return `${i + 1}. ${r.title}\n摘要：${r.snippet || "无摘要"}\n链接：${r.url}`;
        })
        .join("\n\n");
      finalMsg = `【联网搜索结果（检索时间 ${now}，仅供参考，不要编造）】\n${webText}\n\n【用户问题】\n${text}`;
    }

    // 构建 ACP prompt 数组：历史消息 + 当前用户消息
    // ACP one-shot 模式不需要 sessionId，历史直接拼在 prompt 里（简化实现，避免服务端会话维护问题）
    const promptBlocks = [];
    // 先加最近 6 条历史对话
    historyBefore
      .filter((m) => m && m.content)
      .slice(-6)
      .forEach((m) => {
        promptBlocks.push({
          type: "text",
          text:
            (m.role === "user" ? "用户：" : "青月：") +
            String(m.content).slice(0, 200),
        });
      });
    // 加当前用户问题
    promptBlocks.push({ type: "text", text: "用户：" + finalMsg });

    console.log(
      "[qingyue-agent] call ACP session/prompt botId=",
      AGENT_ID,
      "promptBlocks=",
      promptBlocks.length,
      "msgLen=",
      finalMsg.length,
    );
    const doSend = () =>
      acpRequest("session/prompt", {
        prompt: promptBlocks,
      });
    // 云函数容器冷启动时 DNS/TLS 偶发失败，带指数退避重试 2 次
    finalContent = await withRetry(doSend, {
      max: 2,
      baseMs: 800,
      jitterMs: 400,
      retryOn: (err) =>
        /status code 443|443|EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ACP_HTTP/i.test(
          (err && err.message) || "",
        ),
    });
    if (!finalContent) throw new Error("AGENT_EMPTY_RESPONSE");
  } catch (e) {
    console.error(
      "[qingyue-agent] ACP session/prompt failed:",
      e && e.message,
      e && e.stack,
    );
    // 失败：写 failed 状态 + 错误详情（便于排查，前端不展示该字段）
    try {
      await bumpSession(OPENID, "暂时无法回复，请稍后重试。", {
        status: "failed",
        pendingMessageId: "",
        lastError: String((e && e.message) || e || "").slice(0, 500),
        lastErrorAt: db.serverDate(),
      });
    } catch (_) {}
    throw e;
  }

  // AI 输出已由 Agent 服务端安全过滤，不再二次调用 msgSecCheck（节省额度，避免 45009 额度耗尽阻断对话）

  // 写 assistant message
  const aiMsgId = "a_" + Date.now() + Math.random().toString(36).slice(2, 6);
  await saveMsg({
    _id: aiMsgId,
    _openid: OPENID,
    figureId: FIGURE_ID,
    role: "assistant",
    content: finalContent,
    mode: "agent",
    type: "text",
    model: "agent",
    latencyMs: Date.now() - startedAt,
    status: "success",
    createdAt: now,
    updatedAt: now,
  });

  // 更新会话：done 状态（unread 由前端 promise 回调判断是否累加）
  try {
    await bumpSession(OPENID, finalContent, {
      status: "done",
      pendingMessageId: "",
    });
  } catch (_) {}

  return {
    code: 0,
    message: "ok",
    data: {
      figureId: FIGURE_ID,
      userMsg: {
        _id: userMsgId,
        role: "user",
        content: text,
        createdAt: Date.now(),
      },
      aiMsg: {
        _id: aiMsgId,
        role: "assistant",
        content: finalContent,
        type: "text",
        createdAt: Date.now(),
      },
    },
  };
}

async function handleHistory(OPENID, data) {
  const { limit = 50 } = data;
  try {
    const r = await db
      .collection("chat_messages")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .orderBy("createdAt", "desc")
      .limit(Math.min(limit, 100))
      .get();
    return { code: 0, message: "ok", data: r.data.reverse() };
  } catch (e) {
    return { code: 0, message: "ok(fallback)", data: [] };
  }
}

async function handleClearSession(OPENID) {
  // 删青月云端消息（会话延续改为 history 传入，无需删 Agent 端 session）
  try {
    await db
      .collection("chat_messages")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .remove();
  } catch (e) {}

  try {
    const r = await db
      .collection("chat_sessions")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .limit(1)
      .get();
    if (r.data.length) {
      await db
        .collection("chat_sessions")
        .doc(r.data[0]._id)
        .update({
          data: {
            lastMessage: "",
            lastTime: db.serverDate(),
            updatedAt: db.serverDate(),
            status: "done",
            pendingMessageId: "",
            unreadCount: 0,
          },
        });
    }
  } catch (e) {}

  return { code: 0, message: "ok" };
}

// 拉取比 since 更新的云端消息（用于 onShow 同步）
async function handleSyncMessages(OPENID, data) {
  const { since = 0 } = data;
  try {
    const r = await db
      .collection("chat_messages")
      .where({
        _openid: OPENID,
        figureId: FIGURE_ID,
        createdAt: _.gt(since),
      })
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    return { code: 0, message: "ok", data: r.data || [] };
  } catch (e) {
    return { code: 0, message: "ok(fallback)", data: [] };
  }
}

// 拉取青月会话状态（用于列表页 onShow 同步 processing/failed/unread）
async function handleSyncSessions(OPENID) {
  try {
    const r = await db
      .collection("chat_sessions")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .limit(1)
      .get();
    return { code: 0, message: "ok", data: r.data[0] || null };
  } catch (e) {
    return { code: 0, message: "ok(fallback)", data: null };
  }
}

// 标记已读（清 unreadCount）
async function handleMarkRead(OPENID) {
  try {
    const r = await db
      .collection("chat_sessions")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .limit(1)
      .get();
    if (r.data.length && r.data[0].unreadCount) {
      await db
        .collection("chat_sessions")
        .doc(r.data[0]._id)
        .update({
          data: { unreadCount: 0, updatedAt: db.serverDate() },
        });
    }
  } catch (e) {}
  return { code: 0, message: "ok" };
}

// 累加未读（前端 promise 完成时，若用户不在房间页则调用）
async function handleMarkUnread(OPENID) {
  try {
    const r = await db
      .collection("chat_sessions")
      .where({ _openid: OPENID, figureId: FIGURE_ID })
      .limit(1)
      .get();
    if (r.data.length) {
      await db
        .collection("chat_sessions")
        .doc(r.data[0]._id)
        .update({
          data: { unreadCount: _.inc(1), updatedAt: db.serverDate() },
        });
    }
  } catch (e) {}
  return { code: 0, message: "ok" };
}

// ============ 入口 ============

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, ...rest } = event || {};
  try {
    switch (action) {
      case "send":
        return await handleSend(OPENID, rest);
      case "webSearch":
        return {
          code: 0,
          message: "ok",
          data: await webSearch(rest.query || rest.text || ""),
        };
      case "history":
        return await handleHistory(OPENID, rest);
      case "dailyStatus": {
        const lc = await checkDailyLimit(OPENID);
        return { code: 0, message: "ok", data: lc };
      }
      case "clearSession":
        return await handleClearSession(OPENID);
      case "syncMessages":
        return await handleSyncMessages(OPENID, rest);
      case "syncSessions":
        return await handleSyncSessions(OPENID);
      case "markRead":
        return await handleMarkRead(OPENID);
      case "markUnread":
        return await handleMarkUnread(OPENID);
      default:
        return { code: -1, message: "未知 qingyue-agent action: " + action };
    }
  } catch (err) {
    console.error("qingyue-agent err:", (err && err.stack) || err);
    return { code: -1, message: "青月服务异常" };
  }
};
