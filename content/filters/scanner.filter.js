// 正则表达式缓存
const regexCache = {
  coordPattern: /^coord/,
  valuePattern: /^\/|true|false|register|signUp|basic|http/i,
  chinesePattern: /^[\u4e00-\u9fa5]+$/,
  camelCasePattern: /\b[_a-z]+(?:[A-Z][a-z]+)+\b/,
};

// 统一的扫描过滤器
const SCANNER_FILTER = {
  // API 过滤器
  api: (function() {
    return function(match, resultsSet) {
      match = match.slice(1, -1);

      //如果是css字体文件则丢弃
      if (SCANNER_CONFIG.API.FONT_PATTERN.test(match)) {
        return false;
      }
      
      // 检查是否是Vue文件
      if (match.endsWith('.vue')) {
        resultsSet?.vueFiles?.add(match);
        return true;
      }
      
      if (SCANNER_CONFIG.API.IMAGE_PATTERN.test(match)) {
        resultsSet?.imageFiles?.add(match);
        return true;
      }

      // 检查是否是JS文件
      if (SCANNER_CONFIG.API.JS_PATTERN.test(match)) {
        resultsSet?.jsFiles?.add(match);
        return true;
      }

      // 检查是否是文档文件
      if (SCANNER_CONFIG.API.DOC_PATTERN.test(match)) {
        resultsSet?.docFiles?.add(match);
        return true;
      }

      // 检查是否包含被过滤的内容类型
      const lcMatch = match.toLowerCase();
      const shouldFilter = SCANNER_CONFIG.API.FILTERED_CONTENT_TYPES.some(type => 
        lcMatch==type.toLowerCase()
      );

      // 如果是被过滤的内容类型，直接跳过
      if (shouldFilter) {
        return false;
      }
      // 检查是否是模块路径（以./开头）
      if (match.startsWith('./')) {
        resultsSet?.moduleFiles?.add(match);
        return true;
      }

      // 区分绝对路径和相对路径
      if (match.startsWith('/')) {
        // 绝对路径
        if(match.length<=4&&/[A-Z\.\/\#\+\?23]/.test(match.slice(1))) return false;
        resultsSet?.absoluteApis?.add(match);
      } else {
        // 相对路径
        if (/^(audio|blots|core|ace|icon|css|formats|image|js|modules|text|themes|ui|video|static|attributors|application)/.test(match)) return false;
        if(match.length<=4) return false;
        resultsSet?.apis?.add(match);
      }
      return true;
    };
  })(),

  // 域名过滤器
  domain: (function() {
    // URL解码缓存
    const decodeCache = new Map();
    
    const validate = {
      // 清理和标准化域名
      clean(domain) {
        try {
          // 1. 处理引号
          domain = domain.replace(/^['"]|['"]$/g, '');
          // 2. 转小写
          domain = domain.toLowerCase();
          // 3. URL解码（使用缓存）
          if (decodeCache.has(domain)) {
            domain = decodeCache.get(domain);
          } else {
            try {
              const decoded = decodeURIComponent(domain.replace(/\+/g, ' '));
              decodeCache.set(domain, decoded);
              domain = decoded;
            } catch {
              decodeCache.set(domain, domain);
            }
          }
          // 4. 使用过滤规则提取域名
          const filterMatch = domain.match(SCANNER_CONFIG.PATTERNS.DOMAIN_FILTER);
          if (/\b[a-z]+\.(?:top|bottom)-[a-z]+\.top\b/.test(filterMatch[0])) return false;
          if (filterMatch && filterMatch[0].split('.')[0]!="el" && filterMatch[0].split('.')[0]!="e") {
            domain = filterMatch[0];
          } else {
            return false;
          }
          
          return domain;
        } catch {
          return false;
        }
      },

      // 检查是否在黑名单中
      notInBlacklist(domain) {
        return !SCANNER_CONFIG.DOMAIN.BLACKLIST.some(blacklisted => 
          domain.includes(blacklisted)
        );
      }
    };

    return function(match, resultsSet) {
      // 清理和标准化域名
      match = validate.clean(match);
      if (!match) return false;

      // 检查是否在黑名单中
      if (!validate.notInBlacklist(match)) {
        return false;
      }

      // 添加到结果集
      resultsSet?.domains?.add(match);
      return true;
    };
  })(),

  // IP 过滤器
  ip: (function() {
    const validate = {
      notSpecial(ip) {
        return !SCANNER_CONFIG.IP.SPECIAL_RANGES.some(range => range.test(ip));
      }
    };

    return function(match, resultsSet) {
      // 提取纯IP地址（带端口）
      match = match.replace(/^[`'"]|[`'"]$/g, '');
      const ipMatch = match.match(SCANNER_CONFIG.PATTERNS.IP);
      if (ipMatch) {
        const extractedIp = ipMatch[0];
        if (!validate.notSpecial(extractedIp)) return false;
        resultsSet?.ips?.add(extractedIp);
      }
      return true;
    };
  })(),

  // 其他敏感信息过滤器
  phone: (match, resultsSet) => {
    resultsSet?.phones?.add(match);
    return true;
  },

  email: (match, resultsSet) => {
    resultsSet?.emails?.add(match);
    return true;
  },

  idcard: (match, resultsSet) => {
    resultsSet?.idcards?.add(match);
    return true;
  },

  url: (match, resultsSet) => {
    try {
      // 检查是否是GitHub URL
      if (match.toLowerCase().includes('github.com/')) {
        resultsSet?.githubUrls?.add(match);
        return true;
      }
      resultsSet?.urls?.add(match);
      // 解析URL
      const url = new URL(match);
      const currentHost = window.location.host;
      // 检查是否是当前域名或IP
      if (url.host === currentHost) {
        // 获取路径部分
        const path = url.pathname;
      
        //如果是css字体文件则丢弃
        if (SCANNER_CONFIG.API.FONT_PATTERN.test(path)) {
          return false;
        }
        // 检查是否是图片文件
        if (SCANNER_CONFIG.API.IMAGE_PATTERN.test(path)) {
          resultsSet?.imageFiles?.add(path);
          return true;
        }
        
        // 检查是否是JS文件
        if (SCANNER_CONFIG.API.JS_PATTERN.test(path)) {
          resultsSet?.jsFiles?.add(path);
          return true;
        }
        
        // 检查是否是文档文件
        if (SCANNER_CONFIG.API.DOC_PATTERN.test(path)) {
          resultsSet?.docFiles?.add(path);
          return true;
        }
        
        // 如果不是特定类型文件，则当作API处理
        if (!path.match(/\.[a-zA-Z0-9]+$/)) {
          // 区分绝对路径和相对路径
          if (path.startsWith('/')) {
            resultsSet?.absoluteApis?.add(path);
          } else {
            resultsSet?.apis?.add(path);
          }
          return true;
        }
      }
    } catch (e) {
      console.error('Error processing URL:', e);
    }
    
    return true;
  },

  jwt: (match, resultsSet) => {
    resultsSet?.jwts?.add(match);
    return true;
  },

  aws_key: (match, resultsSet) => {
    resultsSet?.awsKeys?.add(match);
    return true;
  },

  company: (match, resultsSet) => {
    if(/[（）]/.test(match)&&!match.match(/（\S*）/)) return false;
    if (Array.from(SCANNER_CONFIG.BLACKLIST.CHINESE_BLACKLIST).some(blackWord=>match.includes(blackWord))) return false;
    resultsSet?.companies?.add(match);
    return true;
  },

  credentials: (match, resultsSet) => {
    // 检查是否是空值
    const valueMatch = match.replace(/\s+/g,'').split(/[:=]/);
    var key = valueMatch[0].replace(/['"]/g,'').toLowerCase();
    var value = valueMatch[1].replace(/['"\{\}\[\]\，\：\。\？\、\?\!\>\<]/g,'').toLowerCase();
    if (!value.length) {
      return false; 
    }
    if (regexCache.coordPattern.test(key) || regexCache.valuePattern.test(value) || value.length<=1) return false;
    if (regexCache.chinesePattern.test(value)) return false;
    
    resultsSet?.credentials?.add(match);
    return true;
  },

  cookie: (match, resultsSet) => {
    // 检查是否是空值
    const valueMatch = match.replace(/\s+/g,'').split(/[:=]/);
    if (valueMatch[1].replace(/['"]/g,'').length<4) {
      return false;
    }
    var key = valueMatch[0].replace(/['"<>]/g,'').toLowerCase();
    var value = valueMatch[1].replace(/['"<>]/g,'').toLowerCase();
    if (!value.length||key==value) {
      return false; 
    }
    if (value.length<12){
      if(Array.from(SCANNER_CONFIG.BLACKLIST.SHORT_VALUES).some(blackWord=>value.includes(blackWord))){
        return false;
      }
    }else{
      if(Array.from(SCANNER_CONFIG.BLACKLIST.MEDIUM_VALUES).some(blackWord=>value.includes(blackWord))){
        return false;
      }
    }
    resultsSet?.cookies?.add(match);
    return true;
  },

  id_key: (match, resultsSet) => {
    // 先检查是否包含分隔符
    const hasDelimiter = match.match(/[:=]/);
    
    if (hasDelimiter || match.length >= 32) {
      // 只有在有分隔符的情况下才进行分割
      if (hasDelimiter) {
        const valueMatch = match.replace(/\s+/g,'').split(/[:=]/);
        var key = valueMatch[0].replace(/['"<>]/g,'');
        var value = valueMatch[1].replace(/['"><]/g,'');
        const keyLower = key.toLowerCase();
        const valueLower = value.toLowerCase();
        
        if (!value.length || keyLower === valueLower) {
          return false;
        }
        // 检查key是否在黑名单中
        if(Array.from(SCANNER_CONFIG.ID_KEY.KEY_BLACKLIST).some(blackWord=>keyLower.includes(blackWord))){
          return false;
        }
        // 检查value是否在统一黑名单中
        if(value.length<16){
          if(Array.from(SCANNER_CONFIG.BLACKLIST.SHORT_VALUES).some(blackWord=>valueLower.includes(blackWord))){
            return false;
          }
          if(Array.from(SCANNER_CONFIG.BLACKLIST.MEDIUM_VALUES).some(blackWord=>valueLower.includes(blackWord))){
            return false;
          }
        }else{
          if(Array.from(SCANNER_CONFIG.BLACKLIST.MEDIUM_VALUES).some(blackWord=>valueLower.includes(blackWord))){
            return false;
          }
          if(Array.from(SCANNER_CONFIG.BLACKLIST.LONG_VALUES).some(blackWord=>valueLower.includes(blackWord))){
            return false;
          }
        }
        // 其他检查
        if (key === "key" && (value.length <= 8 || regexCache.camelCasePattern.test(value))) {
          return false;
        }
        if (value.length <= 3) {
          return false;
        }
      } else {
        // 处理长度大于等于32的情况
        if (/^[a-zA-Z]+$/.test(match.slice(1,-1))) {
          return false;
        }
        // 检查value是否在统一黑名单中
        if(Array.from(SCANNER_CONFIG.BLACKLIST.MEDIUM_VALUES).some(blackWord=>match.includes(blackWord))){
          return false;
        }
        if(Array.from(SCANNER_CONFIG.BLACKLIST.LONG_VALUES).some(blackWord=>match.includes(blackWord))){
          return false;
        }
      }
      resultsSet?.idKeys?.add(match);
      return true;
    }
    return false;
  },

  // 构建工具检测过滤器
  finger: (fingerName, fingerClass, fingerType, fingerDescription, resultsSet, fingerExtType, fingerExtName) => {
    var fingerprint = {};
    fingerprint.type = fingerType;
    fingerprint.name = fingerClass;
    fingerprint.description = `通过${fingerName}识别到${fingerClass}${fingerDescription}`;
    fingerprint.version = fingerClass;
    if(fingerExtType){
      fingerprint.extType = fingerExtType;
      fingerprint.extName = fingerExtName;
    }
    chrome.runtime.sendMessage({
      type: 'UPDATE_BUILDER',
      finger: fingerprint
    });
    resultsSet?.fingers?.add(fingerClass);
    return true;
  }
};

// 导出过滤器
window.SCANNER_FILTER = SCANNER_FILTER;
window.apiFilter = SCANNER_FILTER.api;
window.domainFilter = SCANNER_FILTER.domain;
window.ipFilter = SCANNER_FILTER.ip; 