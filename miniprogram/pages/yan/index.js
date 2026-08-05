const { requestCloud } = require("../../utils/cloudRequest");
const { storage } = require("../../utils/storage");
const loginGuard = require("../../utils/loginGuard");

const app = getApp();

// 本地兜底（云端拉取失败时使用）
const CARRIERS_CACHE_KEY = "yan_carriers_v3";
const CARRIERS_TTL = 3600;

const CLOUD_PREFIX =
  "cloud://cloud1-d8guq74iacc68352a.636c-cloud1-d8guq74iacc68352a-1464144866/mini-assets/yan/";
const FALLBACK_CARRIERS = [
  {
    key: "qinghong",
    name: "轻鸿",
    image: CLOUD_PREFIX + "qinghong.jpg",
    flyImage: CLOUD_PREFIX + "qinghong-fly.jpg",
    speed: 95,
    speedLabel: "4小时",
    accuracy: 80,
    accuracyLabel: "80%",
    load: 30,
    loadLabel: "轻薄",
    rarity: 25,
    rarityLabel: "普通",
    rarityType: "common",
    tags: ["载物轻薄", "偶有迷途"],
    desc: "羽翼轻盈，乘风疾行。气力有限，只能捎带轻巧风物，偶尔会迷失时空。",
    aura: "rgba(212,165,116,0.2)",
  },
  {
    key: "guiyan",
    name: "归雁",
    image: CLOUD_PREFIX + "guiyan.jpg",
    flyImage: CLOUD_PREFIX + "guiyan-fly.jpg",
    speed: 60,
    speedLabel: "12小时",
    accuracy: 100,
    accuracyLabel: "100%",
    load: 60,
    loadLabel: "中等",
    rarity: 55,
    rarityLabel: "精良",
    rarityType: "fine",
    tags: ["定向必达", "稳妥可靠"],
    desc: "循亘古航路而行，守信不误，定向投递万无一失。所携风物品相适中。",
    aura: "rgba(196,30,58,0.18)",
  },
  {
    key: "daocao",
    name: "大雕",
    image: CLOUD_PREFIX + "daocao.jpg",
    flyImage: CLOUD_PREFIX + "dadiao-fly.png",
    speed: 30,
    speedLabel: "24小时",
    accuracy: 90,
    accuracyLabel: "90%",
    load: 100,
    loadLabel: "厚重",
    rarity: 90,
    rarityLabel: "稀有",
    rarityType: "rare",
    tags: ["可负重宝", "偶会漂流"],
    desc: "翱翔云海，负重远行。运力超群，常带回厚重珍稀古物；偶有随风漂泊。",
    aura: "rgba(15,52,96,0.35)",
  },
  {
    key: "jingwei",
    name: "精卫",
    image: CLOUD_PREFIX + "jingwei.jpg",
    flyImage: CLOUD_PREFIX + "jingwei-fly.jpg",
    speed: 71,
    speedLabel: "7秒",
    accuracy: 100,
    accuracyLabel: "100%",
    load: 100,
    loadLabel: "厚重",
    rarity: 100,
    rarityLabel: "传说",
    rarityType: "legendary",
    tags: ["衔石填海", "万里必达"],
    desc: "炎帝之女化鸟，衔石填海，百折不挠。神鸟通灵，万里必达，携古之重宝如若等闲。",
    aura: "rgba(255,107,53,0.25)",
    adminOnly: true,
    locked: true,
  },
];

const MAX_LETTER_LEN = 150;
const FALLBACK_DYNASTIES = [{ key: "random", name: "随机漂流" }];

// 订阅消息模板ID（TODO：公众平台后台创建模板后替换）
const SUBSCRIBE_TEMPLATE_IDS = [
  // 示例：请将实际模板 tmplIds 填入下方数组
  // 'PLACEHOLDER_TEMPLATE_ID_REPLACE_ME'
];

Page({
  data: {
    carrierIndex: 0,
    carriers: FALLBACK_CARRIERS,
    dynasties: FALLBACK_DYNASTIES,
    dynastyIndex: 0,
    selectedDynasty: "",
    selectedDynastyName: "随机漂流",
    figures: [],
    allFigures: [],
    figureIndex: 0,
    selectedFigureId: "",
    selectedFigureName: "",
    letterContent: "",
    canSend: false,
    sending: false,
    carrierBusy: {},
    carrierReturned: {},
    carrierTraveling: {},
    currentTraveling: null,
    showDetail: false,
    detailLetter: null,
    replyContent: '',
    // P1-5a 跳转参数
    jumpFigureId: "",
    jumpFigureName: "",
    // 弹窗选择
    pickerVisible: false,
    pickerType: "",
    pickerTitle: "",
    pickerList: [],
    pickerKeyField: "key",
  },

  onLoad(options) {
    // P1-5a：解析跳转参数（figureId + figureName + dynasty）
    const jumpFigureId =
      options && (options.figureId || options.figureid)
        ? String(options.figureId || options.figureid || "")
        : "";
    const jumpFigureName =
      options && options.figureName
        ? decodeURIComponent(options.figureName)
        : "";
    const jumpDynasty = options && options.dynasty ? options.dynasty : "";

    this.setData({ jumpFigureId, jumpFigureName });

    // P1-5a：若带 figureId 参数，优先选择对应人物/朝代
    if (jumpFigureId) {
      this._autoSelectFigureId = jumpFigureId;
      this._autoSelectFigureName = jumpFigureName;
      this._autoSelectDynasty = jumpDynasty;
    }

    // 必须先保存路由参数再读取缓存，否则缓存命中时会先选中同朝代的第一人
    this.loadStaticData();
  },

  onShow() {
    if (!loginGuard.checkLogin(this)) return;
    this.updateCarrierLockState();
    this.checkCarrierBusy();
    this.startCountdownLoop();
  },

  onHide() {
    this.clearCountdownLoop();
  },

  onUnload() {
    this.clearCountdownLoop();
  },

  // ====== 静态数据加载 ======
  async loadStaticData() {
    // 1. 先拉缓存的信使
    const cachedCarriers = storage.get(CARRIERS_CACHE_KEY);
    if (
      cachedCarriers &&
      Array.isArray(cachedCarriers) &&
      cachedCarriers.length
    ) {
      this.setData({ carriers: cachedCarriers });
    }
    // 2. 拉缓存的人物
    const cachedFigures = storage.get("yan_figures");
    if (
      cachedFigures &&
      Array.isArray(cachedFigures.figures) &&
      cachedFigures.figures.length
    ) {
      this.setData({
        allFigures: cachedFigures.figures,
        dynasties: cachedFigures.dynasties || FALLBACK_DYNASTIES,
      });
      this.applyInitialSelection(
        cachedFigures.dynasties || FALLBACK_DYNASTIES,
        cachedFigures.figures,
      );
    }
    // 3. 异步云端拉取信使 + 人物
    try {
      const [carriersRes, figuresRes] = await Promise.all([
        requestCloud("yan", "carriers", {}, { throwError: false }),
        requestCloud("yan", "figures", {}, { throwError: false }),
      ]);
      if (carriersRes && Array.isArray(carriersRes) && carriersRes.length) {
        this.setData({ carriers: carriersRes });
        storage.set(CARRIERS_CACHE_KEY, carriersRes, CARRIERS_TTL);
      }
      if (
        figuresRes &&
        Array.isArray(figuresRes.figures) &&
        figuresRes.figures.length
      ) {
        this.setData({
          allFigures: figuresRes.figures,
          dynasties: figuresRes.dynasties || FALLBACK_DYNASTIES,
        });
        storage.set("yan_figures", figuresRes, 3600);
        this.applyInitialSelection(
          figuresRes.dynasties || FALLBACK_DYNASTIES,
          figuresRes.figures,
        );
      }
    } catch (e) {}
  },

  applyInitialSelection(dynasties, figures) {
    let dynasty = this.data.selectedDynasty;
    let figureId = this.data.selectedFigureId;

    // 优先级：跳转参数 > 默认首个非 random 朝代
    if (this._autoSelectFigureId) {
      const targetId = String(this._autoSelectFigureId);
      const targetName = (this._autoSelectFigureName || "").trim();
      const fig = figures.find((f) => {
        if (String(f.figureId) === targetId) return true;
        if (String(f._dbId) === targetId) return true;
        // 兼容 fig- 前缀差异：shiji 用 f.id，yan 用 f.figureId，两者可能不同
        const stripped = targetId.startsWith("fig-")
          ? targetId.slice(4)
          : targetId;
        if (stripped && String(f.figureId) === "fig-" + stripped) return true;
        if (stripped && String(f._dbId) === stripped) return true;
        // 按名称兜底匹配
        if (targetName && f.name === targetName) return true;
        return false;
      });
      if (fig && fig.dynasty) {
        dynasty = fig.dynasty;
        figureId = fig.figureId;
      } else if (this._autoSelectDynasty) {
        dynasty = this._autoSelectDynasty;
      }
    }

    if (!dynasty || !dynasties.some((d) => d.key === dynasty)) {
      const firstNonRandom = dynasties.find((d) => d.key !== "random");
      dynasty = firstNonRandom ? firstNonRandom.key : "random";
    }

    this.setData({ selectedDynasty: dynasty });
    this.filterFigures(dynasty, figureId);
  },

  filterFigures(dynasty, forcedFigureId) {
    let figures;
    if (dynasty === "random" || !dynasty) {
      figures = [];
    } else {
      figures = this.data.allFigures.filter((f) => f.dynasty === dynasty);
    }
    let selectedFigureId = forcedFigureId || this.data.selectedFigureId;
    if (
      !selectedFigureId ||
      !figures.some((f) => f.figureId === selectedFigureId)
    ) {
      selectedFigureId = figures.length ? figures[0].figureId : "";
    }
    const fig = figures.find((f) => f.figureId === selectedFigureId);
    const dynasties = this.data.dynasties || FALLBACK_DYNASTIES;
    const dynastyIndex = Math.max(
      0,
      dynasties.findIndex((d) => d.key === dynasty),
    );
    const selectedFigure = dynasty === "random" ? null : fig || null;
    this.setData({
      figures,
      figureIndex: selectedFigure
        ? Math.max(
            0,
            figures.findIndex((f) => f.figureId === selectedFigure.figureId),
          )
        : 0,
      selectedFigureId: selectedFigure ? selectedFigure.figureId : "",
      selectedFigureName: selectedFigure
        ? selectedFigure.name
        : this._autoSelectFigureName || "",
      dynastyIndex,
      selectedDynastyName: dynasties[dynastyIndex]
        ? dynasties[dynastyIndex].name
        : "随机漂流",
    });
    this.updateCanSend();
  },

  // ====== 朝代/收信人 弹窗选择 ======
  openDynastyPicker() {
    const list = (this.data.dynasties || []).map((d) => ({
      key: d.key,
      figureId: "",
      name: d.name,
      active: d.key === this.data.selectedDynasty,
    }));
    this.setData({
      pickerVisible: true,
      pickerType: "dynasty",
      pickerTitle: "选择朝代",
      pickerList: list,
      pickerKeyField: "key",
    });
  },

  openFigurePicker() {
    if (this.data.selectedDynasty === "random") return;
    const list = (this.data.figures || []).map((f) => ({
      key: "",
      figureId: f.figureId,
      name: f.name,
      active: f.figureId === this.data.selectedFigureId,
    }));
    this.setData({
      pickerVisible: true,
      pickerType: "figure",
      pickerTitle: "选择收信人",
      pickerList: list,
      pickerKeyField: "figureId",
    });
  },

  closePicker() {
    this.setData({ pickerVisible: false });
  },

  onPickerTagTap(e) {
    const { key, id, name } = e.currentTarget.dataset;
    if (this.data.pickerType === "dynasty") {
      if (!key) return;
      this.setData({ selectedDynasty: key, pickerVisible: false });
      this.filterFigures(key);
    } else {
      if (!id) return;
      this.setData({
        selectedFigureId: id,
        selectedFigureName: name,
        pickerVisible: false,
      });
      this.updateCanSend();
    }
  },

  // ====== 信使锁定状态（管理员专属信使对非管理员显示锁定） ======
  updateCarrierLockState() {
    const isAdmin = loginGuard.isAdmin();
    const carriers = this.data.carriers.map(function (c) {
      var locked = c.adminOnly ? !isAdmin : false;
      return Object.assign({}, c, { locked: locked });
    });
    this.setData({ carriers: carriers });
    this.updateCanSend();
  },

  // ====== 鸿雁状态 ======
  async checkCarrierBusy() {
    try {
      const data = await requestCloud(
        "yan",
        "list",
        { tab: "traveling" },
        { throwError: false },
      );
      if (data && Array.isArray(data.letters)) {
        const carrierBusy = {};
        const travelingMap = {};
        const returnedMap = {};
        data.letters.forEach((l) => {
          if (l.status === "returned") {
            returnedMap[l.carrier] = l;
          } else if (l.status === "traveling" || l.status === "processing") {
            carrierBusy[l.carrier] = true;
            travelingMap[l.carrier] = l;
          }
        });
        this._returnedMap = returnedMap;
        this.setData({ carrierBusy, carrierReturned: returnedMap });
        this.updateCurrentTraveling({ ...travelingMap, ...returnedMap });
        this.updateCanSend();
      }
    } catch (e) {}
  },

  updateCurrentTraveling(travelingMap) {
    const map = travelingMap || this._travelingMap || {};
    if (travelingMap) this._travelingMap = travelingMap;
    const carriers = this.data.carriers || FALLBACK_CARRIERS;
    const carrierKey = carriers[this.data.carrierIndex]
      ? carriers[this.data.carrierIndex].key
      : "qinghong";
    const letter = map[carrierKey];

    // 为所有传送中信使计算剩余时间，供 swiper-item 左下角展示
    const carrierTraveling = {};
    Object.keys(map).forEach((k) => {
      const l = map[k];
      if (!l || !l.arriveAt) return;
      if (l.status === "returned") return;
      const arriveTs = Number(l.arriveAt) || 0;
      const arriveDate = arriveTs ? new Date(arriveTs) : null;
      let arriveAtText = "--";
      if (arriveDate && arriveDate.getTime()) {
        const pad = (n) => (n < 10 ? "0" + n : n);
        arriveAtText =
          arriveDate.getMonth() +
          1 +
          "月" +
          arriveDate.getDate() +
          "日 " +
          pad(arriveDate.getHours()) +
          ":" +
          pad(arriveDate.getMinutes());
      }
      carrierTraveling[k] = {
        remainText: this.formatCountdown(Math.max(0, arriveTs - Date.now())),
        figureName: l.figureName,
        dynastyName: l.dynastyName,
      };
    });
    this.setData({ carrierTraveling });

    if (letter) {
      const arriveTs = Number(letter.arriveAt) || 0;
      const arriveDate = arriveTs ? new Date(arriveTs) : null;
      let arriveAtText = "--";
      if (arriveDate && arriveDate.getTime()) {
        const pad = (n) => (n < 10 ? "0" + n : n);
        arriveAtText =
          arriveDate.getMonth() +
          1 +
          "月" +
          arriveDate.getDate() +
          "日 " +
          pad(arriveDate.getHours()) +
          ":" +
          pad(arriveDate.getMinutes());
      }
      this.setData({
        currentTraveling: {
          ...letter,
          remainText: this.formatCountdown(Math.max(0, arriveTs - Date.now())),
          progress: this.calcProgress(letter),
          sentAtText: this.formatTime(letter.sentAt),
          arriveAtText,
        },
      });
    } else {
      this.setData({ currentTraveling: null });
    }
  },

  async openCarrierLetter(e) {
    const key = e.currentTarget.dataset.key || (this.data.carriers[this.data.carrierIndex] || {}).key;
    const letter = (this._returnedMap || {})[key];
    if (!letter) return;
    try {
      const detail = await requestCloud("yan", "detail", { letterId: letter._id }, { throwError: false });
      if (!detail) return;
      var replyContent = '';
      if (detail.reply && detail.reply.content) {
        replyContent = this.trimReplyContent(detail.reply.content);
      }
      this.setData({ showDetail: true, detailLetter: detail, replyContent: replyContent });
      const received = await requestCloud("yan", "read", { letterId: letter._id }, { throwError: false });
      if (received) {
        this.setData({
          carrierReturned: { ...this.data.carrierReturned, [key]: null },
          currentTraveling: null,
          detailLetter: { ...detail, status: "arrived", read: true, claimed: !!detail.gift || detail.claimed }
        });
        await this.checkCarrierBusy();
      }
    } catch (e) {}
  },

  trimReplyContent(text) {
    if (!text) return '';
    var t = text.replace(/^[\s]*古代贤人启[：:]*[\s]*/, '');
    t = t.replace(/[\s]*古代贤人\s*顿首拜复[\s。]*$/, '');
    t = t.replace(/[\s]*古代贤人\s*拜复[\s。]*$/, '');
    t = t.replace(/[\s]*顿首拜复[\s。]*$/, '');
    t = t.replace(/[\s]*拜复[\s。]*$/, '');
    return t.trim();
  },

  closeDetail() {
    this.setData({ showDetail: false, detailLetter: null, replyContent: '' });
  },

  continueChat() {
    const detail = this.data.detailLetter;
    if (!detail) return;
    const figureId = encodeURIComponent(String(detail.figureId || ""));
    const figureName = encodeURIComponent(String(detail.figureName || ""));
    this.closeDetail();
    wx.redirectTo({ url: "/pages/yan/index?figureId=" + figureId + "&figureName=" + figureName });
  },

  goCollectionDetail() {
    this.closeDetail();
    wx.navigateTo({ url: "/pages/yan/collection" });
  },

  startCountdownLoop() {
    this.clearCountdownLoop();
    this._countdownTimer = setInterval(() => {
      const map = this._travelingMap || {};
      const now = Date.now();
      let needRefresh = false;
      const carrierTraveling = {};
      Object.keys(map).forEach((k) => {
        const l = map[k];
        if (!l || !l.arriveAt) return;
        if (l.status === "returned") return;
        const arriveTs = Number(l.arriveAt) || 0;
        const remain = Math.max(0, arriveTs - now);
        carrierTraveling[k] = {
          remainText: this.formatCountdown(remain),
          figureName: l.figureName,
          dynastyName: l.dynastyName,
        };
        if (remain <= 0) needRefresh = true;
      });
      this.setData({ carrierTraveling });

      // 同步更新 currentTraveling（兼容底部按钮状态判断）
      const ct = this.data.currentTraveling;
      if (ct && ct.arriveAt) {
        const remain = Math.max(0, ct.arriveAt - now);
        const progress =
          ct.arriveAt > ct.sentAt
            ? Math.min(
                100,
                ((now - ct.sentAt) / (ct.arriveAt - ct.sentAt)) * 100,
              )
            : 100;
        this.setData({
          currentTraveling: {
            ...ct,
            remainText: this.formatCountdown(remain),
            progress: Math.round(progress),
          },
        });
      }

      if (needRefresh) {
        this.checkCarrierBusy();
      }
    }, 1000);
  },

  clearCountdownLoop() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  },

  formatCountdown(ms) {
    if (ms <= 0) return "已到达";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
      return (
        h +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(sec).padStart(2, "0")
      );
    if (m > 0) return m + ":" + String(sec).padStart(2, "0");
    return sec + "秒";
  },

  formatTime(ts) {
    if (!ts) return "";
    const d = new Date(Number(ts));
    const pad = (n) => (n < 10 ? "0" + n : n);
    return (
      d.getMonth() +
      1 +
      "月" +
      d.getDate() +
      "日 " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  },

  calcProgress(l) {
    if (!l.arriveAt || !l.sentAt) return 0;
    const duration = l.arriveAt - l.sentAt;
    if (duration <= 0) return 100;
    const now = Date.now();
    return Math.max(
      0,
      Math.min(100, Math.round(((now - l.sentAt) / duration) * 100)),
    );
  },

  goRecords() {
    wx.navigateTo({ url: "/pages/yan/records" });
  },

  goCollection() {
    wx.navigateTo({ url: "/pages/yan/collection" });
  },

  switchCarrier(e) {
    const carriers = this.data.carriers || FALLBACK_CARRIERS;
    const dir = Number(e.currentTarget.dataset.dir);
    let idx = this.data.carrierIndex + dir;
    if (idx < 0) idx = carriers.length - 1;
    if (idx >= carriers.length) idx = 0;
    this.setData({ carrierIndex: idx });
    this.updateCurrentTraveling();
    this.updateCanSend();
  },

  onCarrierSwiperChange(e) {
    this.setData({ carrierIndex: e.detail.current });
    this.updateCurrentTraveling();
    this.updateCanSend();
  },

  goCarrier(e) {
    this.setData({ carrierIndex: Number(e.currentTarget.dataset.idx) });
    this.updateCurrentTraveling();
    this.updateCanSend();
  },

  onLetterInput(e) {
    const content = e.detail.value || "";
    this.setData({ letterContent: content });
    this.updateCanSend();
  },

  isCurrentCarrierBusy() {
    const carriers = this.data.carriers || FALLBACK_CARRIERS;
    const carrierKey = carriers[this.data.carrierIndex]
      ? carriers[this.data.carrierIndex].key
      : "qinghong";
    return !!this.data.carrierBusy[carrierKey];
  },

  updateCanSend() {
    const {
      letterContent,
      selectedFigureId,
      selectedDynasty,
      carriers,
      carrierIndex,
    } = this.data;
    const hasContent = letterContent.trim().length > 0;
    const hasFigure = selectedFigureId || selectedDynasty === "random";
    const notBusy = !this.isCurrentCarrierBusy();
    var currentCarrier = carriers[carrierIndex] || {};
    var notLocked = !currentCarrier.locked;
    this.setData({ canSend: hasContent && hasFigure && notBusy && notLocked });
  },

  // ====== 订阅消息（P1-4） ======
  async requestSubscribeBeforeSend() {
    const ids = (SUBSCRIBE_TEMPLATE_IDS || []).filter(Boolean);
    if (!ids.length) {
      // 未配置模板，视为不订阅
      return { subscribed: false };
    }
    return new Promise((resolve) => {
      try {
        wx.requestSubscribeMessage({
          tmplIds: ids,
          success: (res) => {
            let ok = false;
            ids.forEach((id) => {
              if (res[id] === "accept") ok = true;
            });
            resolve({ subscribed: ok });
          },
          fail: () => resolve({ subscribed: false }),
        });
      } catch (e) {
        resolve({ subscribed: false });
      }
    });
  },

  // ====== 发送雁书 ======
  async sendLetter() {
    const {
      canSend,
      carrierIndex,
      selectedDynasty,
      selectedFigureId,
      letterContent,
    } = this.data;
    if (!letterContent || !letterContent.trim()) {
      wx.showToast({ title: "请先书写信笺内容", icon: "none" });
      return;
    }
    if (selectedDynasty !== "random" && !selectedFigureId) {
      wx.showToast({ title: "请选择收信人", icon: "none" });
      return;
    }
    if (this.isCurrentCarrierBusy()) {
      wx.showToast({ title: "此鸿雁正在送信中，请切换其他鸿雁", icon: "none" });
      return;
    }
    var carriers = this.data.carriers || FALLBACK_CARRIERS;
    var currentCarrier = carriers[this.data.carrierIndex] || {};
    if (currentCarrier.locked) {
      wx.showToast({ title: "该信使尚未解锁", icon: "none" });
      return;
    }
    if (this.data.sending) return;

    // P1-4：先引导订阅（不阻塞发送，失败也放行）
    const subRes = await this.requestSubscribeBeforeSend();
    const subscribed = subRes.subscribed;

    const userInfo = (app.globalData && app.globalData.userInfo) || {};
    const fromName =
      (userInfo.nickName || "").trim().slice(0, 20) || "远方友人";

    this.setData({ sending: true });
    try {
      const data = await requestCloud(
        "yan",
        "send",
        {
          carrier: carriers[carrierIndex].key,
          dynasty: selectedDynasty,
          figureId: selectedFigureId || "random",
          content: letterContent,
          fromName,
          subscribed,
        },
        { showLoading: true, loadingText: "托付信使..." },
      );

      if (data) {
        wx.showToast({ title: "鸿雁已启程", icon: "success" });
        const carrierKey = carriers[carrierIndex].key;
        const carrierBusy = { ...this.data.carrierBusy, [carrierKey]: true };
        this.setData({
          letterContent: "",
          sending: false,
          carrierBusy,
        });
        this.updateCanSend();
        this.checkCarrierBusy();
      } else {
        this.setData({ sending: false });
      }
    } catch (e) {
      this.setData({ sending: false });
    }
  },

  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined) return;
    const figures = this.data.figures.slice();
    if (figures[index]) {
      figures[index] = Object.assign({}, figures[index], {
        avatar: "",
        avatarError: true,
      });
      this.setData({ figures });
    }
  },

  stopProp() {},
});
