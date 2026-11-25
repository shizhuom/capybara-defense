/**
 * Official WeChat Mini Game Open Data Context (开放数据域) — Free Friend Leaderboards.
 * Pure ES5/ES2015 JavaScript (zero imports, zero optional-chaining/nullish-coalescing, zero 8-digit hex) so it runs
 * natively inside WeChat's isolated openDataContext runtime without extra bundling.
 *
 * Supported messages from main domain:
 *  - { type: 'render', board: 'rank' | 'endless', lang: 'zh-CN' | 'en', force?: boolean, selfFallback?: {...} }
 *  - { type: 'scrollDelta', dy: number }
 *  - { type: 'clear' }
 */
(function () {
  if (typeof wx === 'undefined' || typeof wx.getSharedCanvas !== 'function') return;

  var KEY_RANK = 'capy_rank_stars';
  var KEY_ENDLESS = 'capy_endless_wave';
  var LOGICAL_W = 1140;
  var LOGICAL_H = 360;
  var UI_FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';

  var sharedCanvas = wx.getSharedCanvas();
  var ctx = sharedCanvas ? sharedCanvas.getContext('2d') : null;

  var state = {
    board: 'rank',
    lang: 'zh-CN',
    scrollY: 0,
    maxScroll: 0,
    loading: false,
    error: false,
    fetchedAt: 0,
    rawFriends: [],
    selfOpenId: '',
    selfNick: '',
    selfAvatar: '',
    selfFallback: null,
  };

  var avatarCache = {};

  function safeParse(str) {
    if (typeof str !== 'string' || !str) return null;
    try { return JSON.parse(str); } catch (_e) { return null; }
  }

  function findKv(kvList, key) {
    if (!Array.isArray(kvList)) return null;
    for (var i = 0; i < kvList.length; i++) {
      if (kvList[i] && kvList[i].key === key) {
        return safeParse(kvList[i].value);
      }
    }
    return null;
  }

  function formatClock(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function getAvatarImage(url) {
    if (!url || typeof url !== 'string' || typeof wx.createImage !== 'function') return null;
    var cached = avatarCache[url];
    if (cached) return cached.loaded ? cached.img : null;
    var img = wx.createImage();
    var entry = { img: img, loaded: false };
    avatarCache[url] = entry;
    img.onload = function () {
      entry.loaded = true;
      draw();
    };
    img.onerror = function () {
      entry.loaded = false;
    };
    img.src = url;
    return null;
  }

  function roundRectPath(c, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function drawSlab(c, x, y, w, h, r, topColor, botColor, strokeColor, lineW) {
    var grad = c.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);
    roundRectPath(c, x, y, w, h, r);
    c.fillStyle = grad;
    c.fill();
    if (strokeColor && lineW > 0) {
      c.lineWidth = lineW;
      c.strokeStyle = strokeColor;
      c.stroke();
    }
  }

  function drawText(c, text, x, y, size, color, align, weight) {
    c.font = (weight || 800) + ' ' + size + 'px ' + UI_FONT;
    c.fillStyle = color;
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillText(String(text), x, y);
  }

  function buildRows() {
    var rows = [];
    var zh = state.lang === 'zh-CN';
    var list = Array.isArray(state.rawFriends) ? state.rawFriends : [];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      var nick = item.nickname || (zh ? '水豚好友' : 'Friend');
      var avatar = item.avatarUrl || '';
      var isMe = Boolean(
        (state.selfOpenId && item.openid && item.openid === state.selfOpenId)
        || (!state.selfOpenId && state.selfAvatar && avatar && avatar === state.selfAvatar && nick === state.selfNick)
      );

      if (state.board === 'rank') {
        var rData = findKv(item.KVDataList, KEY_RANK);
        if (!rData) continue;
        var stars = Number(rData.stars !== undefined ? rData.stars : (rData.wxgame ? rData.wxgame.score : 0)) || 0;
        if (stars <= 0 && !isMe) continue;
        var wins = Number(rData.wins) || 0;
        var rankName = typeof rData.rankName === 'string' && rData.rankName ? rData.rankName : (zh ? '温泉守卫' : 'Keeper');
        rows.push({
          nick: nick,
          avatar: avatar,
          isMe: isMe,
          primary: stars,
          tie: wins,
          subtitle: rankName + (wins > 0 ? (zh ? ' · ' + wins + '胜' : ' · ' + wins + 'W') : ''),
          badge: '★ ' + stars,
          badgeBg: '#fff2cf',
          badgeBorder: '#c9881c',
          badgeColor: '#8c4b08',
        });
      } else {
        var eData = findKv(item.KVDataList, KEY_ENDLESS);
        if (!eData) continue;
        var wave = Number(eData.bestWave !== undefined ? eData.bestWave : (eData.wxgame ? eData.wxgame.score : 0)) || 0;
        if (wave < 11) continue;
        var elapsed = Number(eData.elapsed) || 0;
        var medTotal = Number(eData.medallionTotal) || 0;
        var subParts = [];
        if (medTotal > 0) subParts.push(zh ? '勋章总等级 ' + medTotal : 'Medallions ' + medTotal);
        if (elapsed > 0) subParts.push((zh ? '用时 ' : 'Time ') + formatClock(elapsed));
        rows.push({
          nick: nick,
          avatar: avatar,
          isMe: isMe,
          primary: wave,
          tie: elapsed > 0 ? -elapsed : 0,
          subtitle: subParts.length ? subParts.join(' · ') : (zh ? '无尽守护记录' : 'Endless Record'),
          badge: 'W' + wave,
          badgeBg: '#efe3fa',
          badgeBorder: '#7b4aa8',
          badgeColor: '#562180',
        });
      }
    }

    rows.sort(function (a, b) {
      if (b.primary !== a.primary) return b.primary - a.primary;
      return b.tie - a.tie;
    });

    // If friend storage returned nothing yet (e.g. solo testing), still render self fallback cleanly when available.
    if (rows.length === 0 && state.selfFallback) {
      var sf = state.selfFallback;
      if (state.board === 'rank' && sf.stars > 0) {
        rows.push({
          nick: state.selfNick || sf.nickname || (zh ? '我' : 'Me'),
          avatar: state.selfAvatar || '',
          isMe: true,
          primary: sf.stars,
          tie: sf.wins || 0,
          subtitle: (sf.rankName || (zh ? '温泉守卫' : 'Keeper')) + (sf.wins > 0 ? (zh ? ' · ' + sf.wins + '胜' : ' · ' + sf.wins + 'W') : ''),
          badge: '★ ' + sf.stars,
          badgeBg: '#fff2cf',
          badgeBorder: '#c9881c',
          badgeColor: '#8c4b08',
        });
      } else if (state.board === 'endless' && sf.bestWave >= 11) {
        rows.push({
          nick: state.selfNick || sf.nickname || (zh ? '我' : 'Me'),
          avatar: state.selfAvatar || '',
          isMe: true,
          primary: sf.bestWave,
          tie: 0,
          subtitle: zh ? '本机最高无尽记录' : 'Personal Endless Best',
          badge: 'W' + sf.bestWave,
          badgeBg: '#efe3fa',
          badgeBorder: '#7b4aa8',
          badgeColor: '#562180',
        });
      }
    }

    return rows;
  }

  function draw() {
    if (!ctx || !sharedCanvas) return;
    var cw = sharedCanvas.width || LOGICAL_W;
    var ch = sharedCanvas.height || LOGICAL_H;
    var sx = cw / LOGICAL_W;
    var sy = ch / LOGICAL_H;
    var zh = state.lang === 'zh-CN';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.scale(sx, sy);

    if (state.loading && state.rawFriends.length === 0) {
      drawSlab(ctx, 4, 8, LOGICAL_W - 8, 136, 20, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
      drawText(ctx, zh ? '正在同步微信好友排行…' : 'Loading WeChat friends…', LOGICAL_W / 2, 76, 26, '#5c3b1e', 'center', 900);
      ctx.restore();
      return;
    }

    var rows = buildRows();
    if (rows.length === 0) {
      state.maxScroll = 0;
      state.scrollY = 0;
      drawSlab(ctx, 4, 8, LOGICAL_W - 8, 176, 20, '#fffdf8', '#f6e8cb', '#7e5530', 2.4);
      drawText(
        ctx,
        state.board === 'endless'
          ? (zh ? '还没有好友解锁无尽第 11 波哦！' : 'No friends have reached Endless Wave 11 yet!')
          : (zh ? '还没有微信好友加入泡汤排行哦！' : 'No WeChat friends on the board yet!'),
        LOGICAL_W / 2,
        72,
        26,
        '#4a2b14',
        'center',
        900
      );
      drawText(
        ctx,
        zh ? '点击上方「分享」邀请好友一起来守卫卡皮巴拉浴池吧 🍊' : 'Tap Share above to invite friends to defend the bath! 🍊',
        LOGICAL_W / 2,
        122,
        21,
        '#7a5a3a',
        'center',
        800
      );
      ctx.restore();
      return;
    }

    var rowH = 92;
    var gap = 10;
    var padTop = 4;
    var hasInviteFooter = rows.length <= 2;
    var footerH = hasInviteFooter ? 74 : 0;
    var totalH = padTop + rows.length * (rowH + gap) + footerH + 6;
    state.maxScroll = Math.max(0, totalH - LOGICAL_H);
    if (state.scrollY < 0) state.scrollY = 0;
    if (state.scrollY > state.maxScroll) state.scrollY = state.maxScroll;

    var rowW = LOGICAL_W - 22;
    var y = padTop - state.scrollY;

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (y + rowH >= -10 && y <= LOGICAL_H + 10) {
        drawSlab(
          ctx,
          4,
          y,
          rowW,
          rowH,
          20,
          r.isMe ? '#fff4c4' : '#fffdf8',
          r.isMe ? '#f8da7a' : '#f6e8cb',
          r.isMe ? '#c26912' : '#7e5530',
          r.isMe ? 3.2 : 2.2
        );

        var place = i + 1;
        var medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : String(place);
        drawText(ctx, medal, 44, y + rowH / 2, place <= 3 ? 34 : 25, '#4a2b14', 'center', 900);

        // Rounded WeChat Friend Avatar
        var avX = 82;
        var avY = y + 12;
        var avS = 68;
        drawSlab(ctx, avX, avY, avS, avS, 16, '#fff3d6', '#f2d9a6', '#8a5d32', 2);
        var img = getAvatarImage(r.avatar);
        if (img) {
          ctx.save();
          roundRectPath(ctx, avX + 2, avY + 2, avS - 4, avS - 4, 14);
          ctx.clip();
          ctx.drawImage(img, avX + 2, avY + 2, avS - 4, avS - 4);
          ctx.restore();
        } else {
          drawText(ctx, '🍊', avX + avS / 2, avY + avS / 2 + 2, 30, '#8c4b10', 'center', 900);
        }

        // Nickname + "(我)" tag
        var displayName = r.nick.length > 14 ? r.nick.slice(0, 14) + '…' : r.nick;
        if (r.isMe) displayName += zh ? ' (我)' : ' (You)';
        drawText(ctx, displayName, 168, y + 32, 26, '#3e220f', 'left', 900);
        drawText(ctx, r.subtitle, 168, y + 66, 20, '#7a5a3a', 'left', 800);

        // Right Score Pill
        var pillW = 148;
        var pillH = 48;
        var pillX = 4 + rowW - pillW - 16;
        var pillY = y + (rowH - pillH) / 2;
        drawSlab(ctx, pillX, pillY, pillW, pillH, 24, r.badgeBg, r.badgeBg, r.badgeBorder, 2.2);
        drawText(ctx, r.badge, pillX + pillW / 2, pillY + pillH / 2 + 1, 25, r.badgeColor, 'center', 900);
      }
      y += rowH + gap;
    }

    if (hasInviteFooter && y <= LOGICAL_H + 10) {
      drawSlab(ctx, 4, y + 4, rowW, 58, 16, '#eef8e6', '#dff2d0', '#4a8c3c', 2);
      drawText(
        ctx,
        zh ? '✨ 点击上方「分享」邀请更多微信好友加入排行！' : '✨ Tap Share above to invite more WeChat friends!',
        4 + rowW / 2,
        y + 34,
        20,
        '#25591e',
        'center',
        900
      );
    }

    // Subtle vertical scrollbar when list overflows
    if (state.maxScroll > 0) {
      var trackX = LOGICAL_W - 10;
      var trackH = LOGICAL_H - 16;
      var thumbH = Math.max(44, Math.round((LOGICAL_H / totalH) * trackH));
      var thumbY = 8 + Math.round((state.scrollY / state.maxScroll) * (trackH - thumbH));
      roundRectPath(ctx, trackX, 8, 6, trackH, 3);
      ctx.fillStyle = 'rgba(92,59,30,0.18)';
      ctx.fill();
      roundRectPath(ctx, trackX, thumbY, 6, thumbH, 3);
      ctx.fillStyle = 'rgba(138,93,50,0.72)';
      ctx.fill();
    }

    ctx.restore();
  }

  function fetchSelfInfo() {
    if (state.selfOpenId || typeof wx.getUserInfo !== 'function') return;
    try {
      wx.getUserInfo({
        openIdList: ['selfOpenId'],
        success: function (res) {
          var info = res && Array.isArray(res.data) ? res.data[0] : null;
          if (info) {
            state.selfOpenId = info.openId || info.openid || '';
            state.selfNick = info.nickName || '';
            state.selfAvatar = info.avatarUrl || '';
            draw();
          }
        },
        fail: function () { /* optional */ },
      });
    } catch (_e) { /* ignore */ }
  }

  function fetchFriends(force) {
    var now = Date.now();
    if (!force && state.fetchedAt > 0 && now - state.fetchedAt < 20000) {
      draw();
      return;
    }
    if (typeof wx.getFriendCloudStorage !== 'function') {
      draw();
      return;
    }
    state.loading = true;
    state.error = false;
    draw();
    try {
      wx.getFriendCloudStorage({
        keyList: [KEY_RANK, KEY_ENDLESS],
        success: function (res) {
          state.loading = false;
          state.fetchedAt = Date.now();
          state.rawFriends = res && Array.isArray(res.data) ? res.data : [];
          draw();
        },
        fail: function () {
          state.loading = false;
          state.error = true;
          draw();
        },
      });
    } catch (_e) {
      state.loading = false;
      state.error = true;
      draw();
    }
  }

  wx.onMessage(function (msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'clear') {
      if (ctx && sharedCanvas) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, sharedCanvas.width || LOGICAL_W, sharedCanvas.height || LOGICAL_H);
      }
      return;
    }
    if (msg.type === 'scrollDelta') {
      var dy = Number(msg.dy) || 0;
      if (state.maxScroll > 0 && dy !== 0) {
        state.scrollY = Math.max(0, Math.min(state.maxScroll, state.scrollY + dy));
        draw();
      }
      return;
    }
    if (msg.type === 'render') {
      var nextBoard = msg.board === 'endless' ? 'endless' : 'rank';
      if (nextBoard !== state.board) state.scrollY = 0;
      state.board = nextBoard;
      state.lang = msg.lang === 'en' ? 'en' : 'zh-CN';
      if (msg.selfFallback) state.selfFallback = msg.selfFallback;
      fetchSelfInfo();
      fetchFriends(Boolean(msg.force));
    }
  });
})();
