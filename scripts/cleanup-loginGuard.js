const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'miniprogram', 'pages');
const EXCLUDE_FILES = ['login/index.js'];
const EXCLUDE_DIRS = ['admin'];

const modifiedFiles = [];

function shouldProcessFile(filePath) {
  const relativePath = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
  for (const exclude of EXCLUDE_FILES) {
    if (relativePath === exclude) return false;
  }
  const parts = relativePath.split('/');
  for (const excludeDir of EXCLUDE_DIRS) {
    if (parts.includes(excludeDir)) return false;
  }
  return true;
}

function getAllJsFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      if (shouldProcessFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function lineContainsCheckLoginOrRequireLogin(line) {
  return /\bcheckLogin\b/.test(line) || /\brequireLogin\b/.test(line);
}

function isRequireLoginGuardLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.includes("require('../../../utils/loginGuard')") ||
    trimmed.includes('require("../../../utils/loginGuard")') ||
    trimmed.includes("require('../../utils/loginGuard')") ||
    trimmed.includes('require("../../utils/loginGuard")')
  );
}

function isDestructureCheckLoginLine(line) {
  const trimmed = line.trim();
  return (
    /^const\s*\{[^}]*\bcheckLogin\b/.test(trimmed) ||
    /^const\s*\{[^}]*\brequireLogin\b/.test(trimmed) ||
    /^let\s*\{[^}]*\bcheckLogin\b/.test(trimmed) ||
    /^let\s*\{[^}]*\brequireLogin\b/.test(trimmed) ||
    /^var\s*\{[^}]*\bcheckLogin\b/.test(trimmed) ||
    /^var\s*\{[^}]*\brequireLogin\b/.test(trimmed)
  );
}

function isIfReturnWithCheckLogin(line) {
  // 判断这行是否是 if (...) return 的形式，且条件中含 checkLogin 或 requireLogin
  // 先做简单匹配：包含 if 包含 checkLogin/requireLogin 且包含 return
  if (!/\bif\s*\(/.test(line)) return false;
  if (!lineContainsCheckLoginOrRequireLogin(line)) return false;
  if (!/\breturn\b/.test(line)) return false;
  
  // 进一步判断：return 应该在 if 的语句体中（简单判断：整行包含 if(...)return 形式）
  // 匹配模式：任意 if 开头（或缩进），任意字符包含 checkLogin/requireLogin，然后 return
  return true;
}

function isStandaloneCheckLoginCall(line) {
  // 这一行主要是 checkLogin() 或 requireLogin() 调用，没有其他复杂逻辑
  const trimmed = line.trim();
  
  // 去掉末尾的分号和注释
  const clean = trimmed.replace(/;?\s*(\/\/.*)?$/, '').trim();
  
  // 检查是否匹配：[loginGuard.]checkLogin([this]) 或 [loginGuard.]requireLogin()
  const pattern = /^(?:loginGuard\.)?(?:checkLogin|requireLogin)\s*\(\s*(?:this)?\s*\)$/;
  return pattern.test(clean);
}

function processFile(filePath) {
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const originalLines = originalContent.split('\n');
  let lines = originalLines.slice();
  let hasChanges = false;
  
  // 第 1 步：标记并删除解构行
  lines = lines.filter(line => {
    if (isDestructureCheckLoginLine(line)) {
      hasChanges = true;
      return false;
    }
    return true;
  });
  
  // 第 2 步：删除 onLoad/onShow 中相关的调用行
  // 我们需要识别 onLoad 和 onShow 的作用域，但简单起见，直接删除所有相关行
  lines = lines.filter(line => {
    // 删除 if (...) return 形式且包含 checkLogin/requireLogin
    if (isIfReturnWithCheckLogin(line)) {
      hasChanges = true;
      return false;
    }
    // 删除独立的 checkLogin()/requireLogin() 调用
    if (isStandaloneCheckLoginCall(line)) {
      hasChanges = true;
      return false;
    }
    return true;
  });
  
  // 第 3 步：现在重新检查剩余内容中 loginGuard 除了 checkLogin/requireLogin 外是否还有其他使用
  const remainingContent = lines.join('\n');
  const hasOtherLoginGuardUsage = /loginGuard\.(?!checkLogin|requireLogin)/.test(remainingContent);
  
  if (!hasOtherLoginGuardUsage) {
    // 没有其他用法，删除 require loginGuard 的行
    lines = lines.filter(line => {
      // 删除直接的 loginGuard = require(...)
      if (isRequireLoginGuardLine(line)) {
        // 同时要确认这一行不是解构赋值形式的 require（如果是也要删）
        hasChanges = true;
        return false;
      }
      // 处理解构形式：const { checkLogin } = require('...loginGuard...')
      const trimmed = line.trim();
      if (
        /^[ \t]*(?:const|let|var)\s*\{[^}]*\}\s*=\s*require\s*\(/.test(line) &&
        /loginGuard/.test(trimmed)
      ) {
        hasChanges = true;
        return false;
      }
      return true;
    });
  }
  
  // 第 4 步：清理过多空行（连续 3 个及以上空行压缩为 2 个）
  const cleanedLines = [];
  let emptyStreak = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      emptyStreak++;
      if (emptyStreak <= 2) {
        cleanedLines.push(line);
      } else {
        hasChanges = true;
      }
    } else {
      emptyStreak = 0;
      cleanedLines.push(line);
    }
  }
  
  const finalContent = cleanedLines.join('\n');
  
  if (hasChanges && finalContent !== originalContent) {
    fs.writeFileSync(filePath, finalContent, 'utf8');
    modifiedFiles.push(path.relative(PAGES_DIR, filePath).replace(/\\/g, '/'));
    return true;
  }
  return false;
}

function main() {
  const jsFiles = getAllJsFiles(PAGES_DIR);
  console.log(`找到 ${jsFiles.length} 个待处理文件`);
  
  for (const file of jsFiles) {
    const relative = path.relative(PAGES_DIR, file).replace(/\\/g, '/');
    process.stdout.write(`处理: ${relative} ... `);
    const changed = processFile(file);
    console.log(changed ? '✓ 已修改' : '- 无变化');
  }
  
  console.log('\n========================================');
  console.log(`修改完成！共修改 ${modifiedFiles.length} 个文件：`);
  console.log('========================================');
  for (const f of modifiedFiles) {
    console.log('  - ' + f);
  }
}

main();
