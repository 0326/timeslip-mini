function setTabBar(pageInst, idx) {
  if (typeof pageInst.getTabBar === 'function' && pageInst.getTabBar()) {
    pageInst.getTabBar().setData({ selected: idx })
  }
}

module.exports = { setTabBar }
