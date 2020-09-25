(function() {
  var applayout, autoLauncher, clipboard, contextmenu, conv, currentWindow, dispatcher, drive, i, i18nOpts, ipc, j, k, len, len1, path, path_parts, ref, ref1, remote, rule, stylesheet, trayicon, trifl, viewstate;

  ipc = require('electron').ipcRenderer;

  clipboard = require('electron').clipboard;

  path = require('path');

  autoLauncher = require('./util').autoLauncher;

  [drive, ...path_parts] = path.normalize(__dirname).split(path.sep);

  global.YAKYAK_ROOT_DIR = [drive, ...path_parts.map(encodeURIComponent)].join('/');

  // expose trifl in global scope
  trifl = require('trifl');

  trifl.expose(window);

  // in app notification system
  window.notr = require('notr');

  notr.defineStack('def', 'body', {
    top: '3px',
    right: '15px'
  });

  // init trifl dispatcher
  dispatcher = require('./dispatcher');

  remote = require('electron').remote;

  window.onerror = function(msg, url, lineNo, columnNo, error) {
    var hash;
    hash = {msg, url, lineNo, columnNo, error};
    return ipc.send('errorInWindow', hash);
  };

  // expose some selected tagg functions
  trifl.tagg.expose(window, ...('ul li div span a i b u s button p label input table thead tbody tr td th textarea br pass img h1 h2 h3 h4 hr em'.split(' ')));

  
  // Translation support
  window.i18n = require('i18n');

  // This had to be antecipated, as i18n requires viewstate
  //  and applayout requires i18n
  ({viewstate} = require('./models'));

  // see if auto launching is enabled at a system level
  autoLauncher.isEnabled().then(function(isEnabled) {
    return action('initopenonsystemstartup', isEnabled);
  });

  
  // Configuring supporting languages here
  i18nOpts = {
    directory: path.join(__dirname, '..', 'locales'),
    defaultLocale: 'en', // fallback
    objectNotation: true
  };

  
  i18n.configure(i18nOpts);

  
  // force initialize
  if (i18n.getLocales().includes(viewstate.language)) {
    i18n.setLocale(viewstate.language);
  }

  
  ipc.send('seti18n', i18nOpts, viewstate.language);

  // Set locale if exists, otherwise, keep 'en'
  action('changelanguage', viewstate.language);

  action('setspellchecklanguage', viewstate.spellcheckLanguage);

  // does not update viewstate -- why? because locale can be recovered later
  //   not the best reasoning :)
  ({applayout} = require('./views'));

  ({conv} = require('./models'));

  // show tray icon as soon as browser window appers
  ({trayicon} = require('./views/index'));

  contextmenu = require('./views/contextmenu');

  require('./views/menu')(viewstate);

  // tie layout to DOM
  currentWindow = remote.getCurrentWindow();

  document.body.appendChild(applayout.el);

  (function() {    // intercept every event we listen to
    // to make an 'alive' action to know
    // the server is alive
    var ipcon;
    ipcon = ipc.on.bind(ipc);
    return ipc.on = function(n, fn) {
      return ipcon(n, function(...as) {
        action('alive', Date.now());
        return fn(...as);
      });
    };
  })();

  // called when window is ready to show
  //  note: could not use event here, as it must be defined
  //  before
  ipc.on('ready-to-show', function() {
    var elToRemove, mainWindow;
    
    // remove initial error from DOM
    elToRemove = window.document.getElementById("error-b4-app");
    elToRemove.parentNode.removeChild(elToRemove);
    // get window object
    mainWindow = remote.getCurrentWindow();
    
    // when yakyak becomes active, focus is automatically given
    //  to textarea
    mainWindow.on('focus', function() {
      var el;
      if (viewstate.state === viewstate.STATE_NORMAL) {
        // focus on webContents
        mainWindow.webContents.focus();
        el = window.document.getElementById('message-input');
        // focus on specific element
        return el != null ? el.focus() : void 0;
      }
    });
    // hide menu bar in all platforms but darwin
    if (process.platform !== 'darwin') {
      // # Deprecated to BrowserWindow attribute
      // mainWindow.setAutoHideMenuBar(true)
      mainWindow.setMenuBarVisibility(false);
    }
    // handle the visibility of the window
    if (viewstate.startminimizedtotray) {
      mainWindow.hide();
    } else if ((remote.getGlobal('windowHideWhileCred') == null) || remote.getGlobal('windowHideWhileCred') !== true) {
      mainWindow.show();
    }
    
    return window.addEventListener('unload', function(ev) {
      var window;
      if (process.platform === 'darwin' && (typeof window !== "undefined" && window !== null)) {
        if (window.isFullScreen()) {
          window.setFullScreen(false);
        }
        if (!remote.getGlobal('forceClose')) {
          ev.preventDefault();
          if (typeof window !== "undefined" && window !== null) {
            window.hide();
          }
          return;
        }
      }
      window = null;
      return action('quit');
    });
  });

  
  // This can be removed once windows10 supports NotoColorEmoji
  //  (or the font supports Windows10)

  if (process.platform === 'win32') {
    ref = window.document.styleSheets;
    for (j = 0, len = ref.length; j < len; j++) {
      stylesheet = ref[j];
      if (stylesheet.href.match('app\.css') != null) {
        ref1 = stylesheet.cssRules;
        for (i = k = 0, len1 = ref1.length; k < len1; i = ++k) {
          rule = ref1[i];
          if (rule.type === 5 && (rule.cssText.match('font-family: NotoColorEmoji;') != null)) {
            stylesheet.deleteRule(i);
            break;
          }
        }
        break;
      }
    }
  }

  
  // Get information on exceptions in main process
  //  - Exceptions that were caught
  //  - Window crashes
  ipc.on('expcetioninmain', function(error) {
    var msg;
    console.log((msg = "Possible fatal error on main process" + ", YakYak could stop working as expected."), error);
    return notr(msg, {
      stay: 0
    });
  });

  ipc.on('message', function(msg) {
    console.log('Message from main process:', msg);
    return notr(msg);
  });

  // wire up stuff from server
  ipc.on('init', function(ev, data) {
    return dispatcher.init(data);
  });

  // events from hangupsjs
  require('./events').forEach(function(n) {
    return ipc.on(n, function(ev, data) {
      return action(n, data);
    });
  });

  // events from tray menu
  ipc.on('menuaction', function(ev, name) {
    console.log('menuaction from main process', name);
    return action(name);
  });

  // response from getentity
  ipc.on('getentity:result', function(ev, r, data) {
    return action('addentities', r.entities, data != null ? data.add_to_conv : void 0);
  });

  ipc.on('resize', function(ev, dim) {
    return action('resize', dim);
  });

  ipc.on('move', function(ev, pos) {
    return action('move', pos);
  });

  ipc.on('searchentities:result', function(ev, r) {
    return action('setsearchedentities', r.entity);
  });

  ipc.on('createconversation:result', function(ev, c, name) {
    c.conversation_id = c.id; // fix conversation payload
    if (name) {
      c.name = name;
    }
    action('createconversationdone', c);
    return action('setstate', viewstate.STATE_NORMAL);
  });

  ipc.on('syncallnewevents:response', function(ev, r) {
    return action('handlesyncedevents', r);
  });

  ipc.on('syncrecentconversations:response', function(ev, r) {
    return action('handlerecentconversations', r);
  });

  ipc.on('getconversation:response', function(ev, r) {
    return action('handlehistory', r);
  });

  
  // gets metadata from conversation after setting focus
  ipc.on('getconversationmetadata:response', function(ev, r) {
    return action('handleconversationmetadata', r);
  });

  ipc.on('uploadingimage', function(ev, spec) {
    return action('uploadingimage', spec);
  });

  ipc.on('querypresence:result', function(ev, r) {
    return action('setpresence', r);
  });

  // init dispatcher/controller
  require('./dispatcher');

  require('./views/controller');

  // request init this is not happening when
  // the server is just connecting, but for
  // dev mode when we reload the page
  action('reqinit');

  
  // Listen to paste event and paste to message textarea

  //  The only time when this event is not triggered, is when
  //   the event is triggered from the message-area itself

  document.addEventListener('paste', function(e) {
    var el, mainWindow;
    if (!clipboard.readImage().isEmpty() && !clipboard.readText()) {
      action('onpasteimage');
      e.preventDefault();
    }
    // focus on web contents
    mainWindow = remote.getCurrentWindow();
    mainWindow.webContents.focus();
    // focus on textarea
    el = window.document.getElementById('message-input');
    return el != null ? el.focus() : void 0;
  });

  // register event listeners for on/offline
  window.addEventListener('online', function() {
    return action('wonline', true);
  });

  window.addEventListener('offline', function() {
    return action('wonline', false);
  });

  
  // Catch unresponsive events
  remote.getCurrentWindow().on('unresponsive', function(error) {
    var msg;
    notr(msg = "Warning: YakYak is becoming unresponsive.", {
      id: 'unresponsive'
    });
    console.log('Unresponsive event', msg);
    return ipc.send('errorInWindow', 'Unresponsive window');
  });

  
  // Show a message
  remote.getCurrentWindow().on('responsive', function() {
    return notr("Back to normal again!", {
      id: 'unresponsive'
    });
  });

  // Listen to close and quit events
  window.addEventListener('beforeunload', function(e) {
    var hide;
    if (remote.getGlobal('forceClose')) {
      return;
    }
    // Mac os and the dock have a special relationship
    // Handle the close to tray action
    hide = (process.platform === 'darwin' && !viewstate.hidedockicon) || viewstate.closetotray;
    if (hide) {
      e.returnValue = false;
      remote.getCurrentWindow().hide();
    }
  });

  window.addEventListener('keypress', function(e) {
    if (e.keyCode === 23 && e.ctrlKey) {
      return ipc.send('ctrl+w__pressed', '');
    }
  });

  currentWindow.webContents.on('context-menu', function(e, params) {
    var canShow;
    console.log('context-menu', e, params);
    e.preventDefault();
    canShow = [viewstate.STATE_NORMAL, viewstate.STATE_ADD_CONVERSATION, viewstate.STATE_ABOUT].includes(viewstate.state);
    if (canShow) {
      return contextmenu(params, viewstate).popup(remote.getCurrentWindow());
    }
  });

  // tell the startup state
  action('wonline', window.navigator.onLine);

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvYXBwLmpzIiwic291cmNlcyI6WyJ1aS9hcHAuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQUEsTUFBQSxTQUFBLEVBQUEsWUFBQSxFQUFBLFNBQUEsRUFBQSxXQUFBLEVBQUEsSUFBQSxFQUFBLGFBQUEsRUFBQSxVQUFBLEVBQUEsS0FBQSxFQUFBLENBQUEsRUFBQSxRQUFBLEVBQUEsR0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsR0FBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsVUFBQSxFQUFBLEdBQUEsRUFBQSxJQUFBLEVBQUEsTUFBQSxFQUFBLElBQUEsRUFBQSxVQUFBLEVBQUEsUUFBQSxFQUFBLEtBQUEsRUFBQTs7RUFBQSxHQUFBLEdBQWUsT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDbkMsU0FBQSxHQUFlLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQ25DLElBQUEsR0FBZSxPQUFBLENBQVEsTUFBUjs7RUFDZixZQUFBLEdBQWUsT0FBQSxDQUFRLFFBQVIsQ0FBaUIsQ0FBQzs7RUFFakMsQ0FBQyxLQUFELEVBQVEsR0FBQSxVQUFSLENBQUEsR0FBeUIsSUFBSSxDQUFDLFNBQUwsQ0FBZSxTQUFmLENBQXlCLENBQUMsS0FBMUIsQ0FBZ0MsSUFBSSxDQUFDLEdBQXJDOztFQUN6QixNQUFNLENBQUMsZUFBUCxHQUF5QixDQUFDLEtBQUQsRUFBUSxHQUFBLFVBQVUsQ0FBQyxHQUFYLENBQWUsa0JBQWYsQ0FBUixDQUE4QyxDQUFDLElBQS9DLENBQW9ELEdBQXBELEVBTnpCOzs7RUFTQSxLQUFBLEdBQVEsT0FBQSxDQUFRLE9BQVI7O0VBQ1IsS0FBSyxDQUFDLE1BQU4sQ0FBYSxNQUFiLEVBVkE7OztFQWFBLE1BQU0sQ0FBQyxJQUFQLEdBQWMsT0FBQSxDQUFRLE1BQVI7O0VBQ2QsSUFBSSxDQUFDLFdBQUwsQ0FBaUIsS0FBakIsRUFBd0IsTUFBeEIsRUFBZ0M7SUFBQyxHQUFBLEVBQUksS0FBTDtJ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QUMsc0JBRFgsRUFFQyxTQUFTLENBQUMsV0FGWCxDQUV1QixDQUFDLFFBRnhCLENBRWlDLFNBQVMsQ0FBQyxLQUYzQztJQUdWLElBQUcsT0FBSDthQUNJLFdBQUEsQ0FBWSxNQUFaLEVBQW9CLFNBQXBCLENBQThCLENBQUMsS0FBL0IsQ0FBcUMsTUFBTSxDQUFDLGdCQUFQLENBQUEsQ0FBckMsRUFESjs7RUFOeUMsQ0FBN0MsRUF4UUE7OztFQW1SQSxNQUFBLENBQU8sU0FBUCxFQUFrQixNQUFNLENBQUMsU0FBUyxDQUFDLE1BQW5DO0FBblJBIiwic291cmNlc0NvbnRlbnQiOlsiaXBjICAgICAgICAgID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5pcGNSZW5kZXJlclxuY2xpcGJvYXJkICAgID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5jbGlwYm9hcmRcbnBhdGggICAgICAgICA9IHJlcXVpcmUoJ3BhdGgnKVxuYXV0b0xhdW5jaGVyID0gcmVxdWlyZSgnLi91dGlsJykuYXV0b0xhdW5jaGVyXG5cbltkcml2ZSwgcGF0aF9wYXJ0cy4uLl0gPSBwYXRoLm5vcm1hbGl6ZShfX2Rpcm5hbWUpLnNwbGl0KHBhdGguc2VwKVxuZ2xvYmFsLllBS1lBS19ST09UX0RJUiA9IFtkcml2ZSwgcGF0aF9wYXJ0cy5tYXAoZW5jb2RlVVJJQ29tcG9uZW50KS4uLl0uam9pbignLycpXG5cbiMgZXhwb3NlIHRyaWZsIGluIGdsb2JhbCBzY29wZVxudHJpZmwgPSByZXF1aXJlICd0cmlmbCdcbnRyaWZsLmV4cG9zZSB3aW5kb3dcblxuIyBpbiBhcHAgbm90aWZpY2F0aW9uIHN5c3RlbVxud2luZG93Lm5vdHIgPSByZXF1aXJlICdub3RyJ1xubm90ci5kZWZpbmVTdGFjayAnZGVmJywgJ2JvZHknLCB7dG9wOiczcHgnLCByaWdodDonMTVweCd9XG5cbiMgaW5pdCB0cmlmbCBkaXNwYXRjaGVyXG5kaXNwYXRjaGVyID0gcmVxdWlyZSAnLi9kaXNwYXRjaGVyJ1xuXG5yZW1vdGUgPSByZXF1aXJlKCdlbGVjdHJvbicpLnJlbW90ZVxuXG53aW5kb3cub25lcnJvciA9IChtc2csIHVybCwgbGluZU5vLCBjb2x1bW5ObywgZXJyb3IpIC0+XG4gICAgaGFzaCA9IHttc2csIHVybCwgbGluZU5vLCBjb2x1bW5ObywgZXJyb3J9XG4gICAgaXBjLnNlbmQgJ2Vycm9ySW5XaW5kb3cnLCBoYXNoXG5cbiMgZXhwb3NlIHNvbWUgc2VsZWN0ZWQgdGFnZyBmdW5jdGlvbnNcbnRyaWZsLnRhZ2cuZXhwb3NlIHdpbmRvdywgKCd1bCBsaSBkaXYgc3BhbiBhIGkgYiB1IHMgYnV0dG9uIHAgbGFiZWxcbmlucHV0IHRhYmxlIHRoZWFkIHRib2R5IHRyIHRkIHRoIHRleHRhcmVhIGJyIHBhc3MgaW1nIGgxIGgyIGgzIGg0XG5ociBlbScuc3BsaXQoJyAnKSkuLi5cblxuI1xuIyBUcmFuc2xhdGlvbiBzdXBwb3J0XG53aW5kb3cuaTE4biA9IHJlcXVpcmUoJ2kxOG4nKVxuIyBUaGlzIGhhZCB0byBiZSBhbnRlY2lwYXRlZCwgYXMgaTE4biByZXF1aXJlcyB2aWV3c3RhdGVcbiMgIGFuZCBhcHBsYXlvdXQgcmVxdWlyZXMgaTE4blxue3ZpZXdzdGF0ZX0gPSByZXF1aXJlICcuL21vZGVscydcblxuIyBzZWUgaWYgYXV0byBsYXVuY2hpbmcgaXMgZW5hYmxlZCBhdCBhIHN5c3RlbSBsZXZlbFxuYXV0b0xhdW5jaGVyLmlzRW5hYmxlZCgpLnRoZW4oKGlzRW5hYmxlZCkgLT5cbiAgICBhY3Rpb24gJ2luaXRvcGVub25zeXN0ZW1zdGFydHVwJywgaXNFbmFibGVkXG4pXG5cbiNcbiMgQ29uZmlndXJpbmcgc3VwcG9ydGluZyBsYW5ndWFnZXMgaGVyZVxuaTE4bk9wdHMgPSB7XG4gICAgZGlyZWN0b3J5OiBwYXRoLmpvaW4gX19kaXJuYW1lLCAnLi4nLCAnbG9jYWxlcydcbiAgICBkZWZhdWx0TG9jYWxlOiAnZW4nICMgZmFsbGJhY2tcbiAgICBvYmplY3ROb3RhdGlvbjogdHJ1ZVxufVxuI1xuaTE4bi5jb25maWd1cmUgaTE4bk9wdHNcbiNcbiMgZm9yY2UgaW5pdGlhbGl6ZVxuaWYgaTE4bi5nZXRMb2NhbGVzKCkuaW5jbHVkZXMgdmlld3N0YXRlLmxhbmd1YWdlXG4gICAgaTE4bi5zZXRMb2NhbGUodmlld3N0YXRlLmxhbmd1YWdlKVxuI1xuaXBjLnNlbmQgJ3NldGkxOG4nLCBpMThuT3B0cywgdmlld3N0YXRlLmxhbmd1YWdlXG5cbiMgU2V0IGxvY2FsZSBpZiBleGlzdHMsIG90aGVyd2lzZSwga2VlcCAnZW4nXG5hY3Rpb24gJ2NoYW5nZWxhbmd1YWdlJywgdmlld3N0YXRlLmxhbmd1YWdlXG5hY3Rpb24gJ3NldHNwZWxsY2hlY2tsYW5ndWFnZScsIHZpZXdzdGF0ZS5zcGVsbGNoZWNrTGFuZ3VhZ2VcblxuIyBkb2VzIG5vdCB1cGRhdGUgdmlld3N0YXRlIC0tIHdoeT8gYmVjYXVzZSBsb2NhbGUgY2FuIGJlIHJlY292ZXJlZCBsYXRlclxuIyAgIG5vdCB0aGUgYmVzdCByZWFzb25pbmcgOilcblxue2FwcGxheW91dH0gICAgICAgPSByZXF1aXJlICcuL3ZpZXdzJ1xuXG57Y29udn0gPSByZXF1aXJlICcuL21vZGVscydcblxuIyBzaG93IHRyYXkgaWNvbiBhcyBzb29uIGFzIGJyb3dzZXIgd2luZG93IGFwcGVyc1xueyB0cmF5aWNvbiB9ID0gcmVxdWlyZSAnLi92aWV3cy9pbmRleCdcblxuY29udGV4dG1lbnUgPSByZXF1aXJlKCcuL3ZpZXdzL2NvbnRleHRtZW51JylcbnJlcXVpcmUoJy4vdmlld3MvbWVudScpKHZpZXdzdGF0ZSlcblxuIyB0aWUgbGF5b3V0IHRvIERPTVxuY3VycmVudFdpbmRvdyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KClcblxuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCBhcHBsYXlvdXQuZWxcblxuIyBpbnRlcmNlcHQgZXZlcnkgZXZlbnQgd2UgbGlzdGVuIHRvXG4jIHRvIG1ha2UgYW4gJ2FsaXZlJyBhY3Rpb24gdG8ga25vd1xuIyB0aGUgc2VydmVyIGlzIGFsaXZlXG5kbyAtPlxuICAgIGlwY29uID0gaXBjLm9uLmJpbmQoaXBjKVxuICAgIGlwYy5vbiA9IChuLCBmbikgLT5cbiAgICAgICAgaXBjb24gbiwgKGFzLi4uKSAtPlxuICAgICAgICAgICAgYWN0aW9uICdhbGl2ZScsIERhdGUubm93KClcbiAgICAgICAgICAgIGZuIGFzLi4uXG5cbiMgY2FsbGVkIHdoZW4gd2luZG93IGlzIHJlYWR5IHRvIHNob3dcbiMgIG5vdGU6IGNvdWxkIG5vdCB1c2UgZXZlbnQgaGVyZSwgYXMgaXQgbXVzdCBiZSBkZWZpbmVkXG4jICBiZWZvcmVcbmlwYy5vbiAncmVhZHktdG8tc2hvdycsICgpIC0+XG4gICAgI1xuICAgICMgcmVtb3ZlIGluaXRpYWwgZXJyb3IgZnJvbSBET01cbiAgICBlbFRvUmVtb3ZlID0gd2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZXJyb3ItYjQtYXBwXCIpXG4gICAgZWxUb1JlbW92ZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsVG9SZW1vdmUpXG4gICAgIyBnZXQgd2luZG93IG9iamVjdFxuICAgIG1haW5XaW5kb3cgPSByZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpXG4gICAgI1xuICAgICMgd2hlbiB5YWt5YWsgYmVjb21lcyBhY3RpdmUsIGZvY3VzIGlzIGF1dG9tYXRpY2FsbHkgZ2l2ZW5cbiAgICAjICB0byB0ZXh0YXJlYVxuICAgIG1haW5XaW5kb3cub24gJ2ZvY3VzJywgKCkgLT5cbiAgICAgICAgaWYgdmlld3N0YXRlLnN0YXRlID09IHZpZXdzdGF0ZS5TVEFURV9OT1JNQUxcbiAgICAgICAgICAgICMgZm9jdXMgb24gd2ViQ29udGVudHNcbiAgICAgICAgICAgIG1haW5XaW5kb3cud2ViQ29udGVudHMuZm9jdXMoKVxuICAgICAgICAgICAgZWwgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2UtaW5wdXQnKVxuICAgICAgICAgICAgIyBmb2N1cyBvbiBzcGVjaWZpYyBlbGVtZW50XG4gICAgICAgICAgICBlbD8uZm9jdXMoKVxuXG4gICAgIyBoaWRlIG1lbnUgYmFyIGluIGFsbCBwbGF0Zm9ybXMgYnV0IGRhcndpblxuICAgIHVubGVzcyBwcm9jZXNzLnBsYXRmb3JtIGlzICdkYXJ3aW4nXG4gICAgICAgICMgIyBEZXByZWNhdGVkIHRvIEJyb3dzZXJXaW5kb3cgYXR0cmlidXRlXG4gICAgICAgICMgbWFpbldpbmRvdy5zZXRBdXRvSGlkZU1lbnVCYXIodHJ1ZSlcbiAgICAgICAgbWFpbldpbmRvdy5zZXRNZW51QmFyVmlzaWJpbGl0eShmYWxzZSlcbiAgICAjIGhhbmRsZSB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgd2luZG93XG4gICAgaWYgdmlld3N0YXRlLnN0YXJ0bWluaW1pemVkdG90cmF5XG4gICAgICAgIG1haW5XaW5kb3cuaGlkZSgpXG4gICAgZWxzZSBpZiAhcmVtb3RlLmdldEdsb2JhbCgnd2luZG93SGlkZVdoaWxlQ3JlZCcpPyB8fFxuICAgICAgICAgICAgIHJlbW90ZS5nZXRHbG9iYWwoJ3dpbmRvd0hpZGVXaGlsZUNyZWQnKSAhPSB0cnVlXG4gICAgICAgIG1haW5XaW5kb3cuc2hvdygpXG5cbiAgICAjXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgJ3VubG9hZCcsIChldikgLT5cbiAgICAgICAgaWYgcHJvY2Vzcy5wbGF0Zm9ybSA9PSAnZGFyd2luJyAmJiB3aW5kb3c/XG4gICAgICAgICAgICBpZiB3aW5kb3cuaXNGdWxsU2NyZWVuKClcbiAgICAgICAgICAgICAgICB3aW5kb3cuc2V0RnVsbFNjcmVlbiBmYWxzZVxuICAgICAgICAgICAgaWYgbm90IHJlbW90ZS5nZXRHbG9iYWwoJ2ZvcmNlQ2xvc2UnKVxuICAgICAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICB3aW5kb3c/LmhpZGUoKVxuICAgICAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgIHdpbmRvdyA9IG51bGxcbiAgICAgICAgYWN0aW9uICdxdWl0J1xuXG4jXG4jXG4jIFRoaXMgY2FuIGJlIHJlbW92ZWQgb25jZSB3aW5kb3dzMTAgc3VwcG9ydHMgTm90b0NvbG9yRW1vamlcbiMgIChvciB0aGUgZm9udCBzdXBwb3J0cyBXaW5kb3dzMTApXG4jXG5pZiBwcm9jZXNzLnBsYXRmb3JtID09ICd3aW4zMidcbiAgICBmb3Igc3R5bGVzaGVldCBpbiB3aW5kb3cuZG9jdW1lbnQuc3R5bGVTaGVldHNcbiAgICAgICAgaWYgc3R5bGVzaGVldC5ocmVmLm1hdGNoKCdhcHBcXC5jc3MnKT9cbiAgICAgICAgICAgIGZvciBydWxlLCBpIGluIHN0eWxlc2hlZXQuY3NzUnVsZXNcbiAgICAgICAgICAgICAgICBpZiBydWxlLnR5cGUgPT0gNSAmJiBydWxlLmNzc1RleHQubWF0Y2goJ2ZvbnQtZmFtaWx5OiBOb3RvQ29sb3JFbW9qaTsnKT9cbiAgICAgICAgICAgICAgICAgICAgc3R5bGVzaGVldC5kZWxldGVSdWxlKGkpXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICBicmVha1xuI1xuI1xuIyBHZXQgaW5mb3JtYXRpb24gb24gZXhjZXB0aW9ucyBpbiBtYWluIHByb2Nlc3NcbiMgIC0gRXhjZXB0aW9ucyB0aGF0IHdlcmUgY2F1Z2h0XG4jICAtIFdpbmRvdyBjcmFzaGVzXG5pcGMub24gJ2V4cGNldGlvbmlubWFpbicsIChlcnJvcikgLT5cbiAgICBjb25zb2xlLmxvZyAobXNnID0gXCJQb3NzaWJsZSBmYXRhbCBlcnJvciBvbiBtYWluIHByb2Nlc3NcIiArXG4gICAgICAgIFwiLCBZYWtZYWsgY291bGQgc3RvcCB3b3JraW5nIGFzIGV4cGVjdGVkLlwiKSwgZXJyb3JcbiAgICBub3RyIG1zZywge3N0YXk6IDB9XG5cbmlwYy5vbiAnbWVzc2FnZScsIChtc2cpIC0+XG4gICAgY29uc29sZS5sb2cgJ01lc3NhZ2UgZnJvbSBtYWluIHByb2Nlc3M6JywgbXNnXG4gICAgbm90ciBtc2dcblxuIyB3aXJlIHVwIHN0dWZmIGZyb20gc2VydmVyXG5pcGMub24gJ2luaXQnLCAoZXYsIGRhdGEpIC0+IGRpc3BhdGNoZXIuaW5pdCBkYXRhXG4jIGV2ZW50cyBmcm9tIGhhbmd1cHNqc1xucmVxdWlyZSgnLi9ldmVudHMnKS5mb3JFYWNoIChuKSAtPiBpcGMub24gbiwgKGV2LCBkYXRhKSAtPiBhY3Rpb24gbiwgZGF0YVxuXG4jIGV2ZW50cyBmcm9tIHRyYXkgbWVudVxuaXBjLm9uICdtZW51YWN0aW9uJywgKGV2LCBuYW1lKSAtPlxuICAgIGNvbnNvbGUubG9nKCdtZW51YWN0aW9uIGZyb20gbWFpbiBwcm9jZXNzJywgbmFtZSlcbiAgICBhY3Rpb24gbmFtZVxuXG4jIHJlc3BvbnNlIGZyb20gZ2V0ZW50aXR5XG5pcGMub24gJ2dldGVudGl0eTpyZXN1bHQnLCAoZXYsIHIsIGRhdGEpIC0+XG4gICAgYWN0aW9uICdhZGRlbnRpdGllcycsIHIuZW50aXRpZXMsIGRhdGE/LmFkZF90b19jb252XG5cbmlwYy5vbiAncmVzaXplJywgKGV2LCBkaW0pIC0+IGFjdGlvbiAncmVzaXplJywgZGltXG5cbmlwYy5vbiAnbW92ZScsIChldiwgcG9zKSAgLT4gYWN0aW9uICdtb3ZlJywgcG9zXG5pcGMub24gJ3NlYXJjaGVudGl0aWVzOnJlc3VsdCcsIChldiwgcikgLT5cbiAgICBhY3Rpb24gJ3NldHNlYXJjaGVkZW50aXRpZXMnLCByLmVudGl0eVxuaXBjLm9uICdjcmVhdGVjb252ZXJzYXRpb246cmVzdWx0JywgKGV2LCBjLCBuYW1lKSAtPlxuICAgIGMuY29udmVyc2F0aW9uX2lkID0gYy5pZCAjwqBmaXggY29udmVyc2F0aW9uIHBheWxvYWRcbiAgICBjLm5hbWUgPSBuYW1lIGlmIG5hbWVcbiAgICBhY3Rpb24gJ2NyZWF0ZWNvbnZlcnNhdGlvbmRvbmUnLCBjXG4gICAgYWN0aW9uICdzZXRzdGF0ZScsIHZpZXdzdGF0ZS5TVEFURV9OT1JNQUxcbmlwYy5vbiAnc3luY2FsbG5ld2V2ZW50czpyZXNwb25zZScsIChldiwgcikgLT4gYWN0aW9uICdoYW5kbGVzeW5jZWRldmVudHMnLCByXG5pcGMub24gJ3N5bmNyZWNlbnRjb252ZXJzYXRpb25zOnJlc3BvbnNlJywgKGV2LCByKSAtPiBhY3Rpb24gJ2hhbmRsZXJlY2VudGNvbnZlcnNhdGlvbnMnLCByXG5pcGMub24gJ2dldGNvbnZlcnNhdGlvbjpyZXNwb25zZScsIChldiwgcikgLT4gYWN0aW9uICdoYW5kbGVoaXN0b3J5JywgclxuI1xuIyBnZXRzIG1ldGFkYXRhIGZyb20gY29udmVyc2F0aW9uIGFmdGVyIHNldHRpbmcgZm9jdXNcbmlwYy5vbiAnZ2V0Y29udmVyc2F0aW9ubWV0YWRhdGE6cmVzcG9uc2UnLCAoZXYsIHIpIC0+XG4gICAgYWN0aW9uICdoYW5kbGVjb252ZXJzYXRpb25tZXRhZGF0YScsIHJcbmlwYy5vbiAndXBsb2FkaW5naW1hZ2UnLCAoZXYsIHNwZWMpIC0+IGFjdGlvbiAndXBsb2FkaW5naW1hZ2UnLCBzcGVjXG5pcGMub24gJ3F1ZXJ5cHJlc2VuY2U6cmVzdWx0JywgKGV2LCByKSAtPiBhY3Rpb24gJ3NldHByZXNlbmNlJywgclxuXG4jIGluaXQgZGlzcGF0Y2hlci9jb250cm9sbGVyXG5yZXF1aXJlICcuL2Rpc3BhdGNoZXInXG5yZXF1aXJlICcuL3ZpZXdzL2NvbnRyb2xsZXInXG5cbiMgcmVxdWVzdCBpbml0IHRoaXMgaXMgbm90IGhhcHBlbmluZyB3aGVuXG4jIHRoZSBzZXJ2ZXIgaXMganVzdCBjb25uZWN0aW5nLCBidXQgZm9yXG4jIGRldiBtb2RlIHdoZW4gd2UgcmVsb2FkIHRoZSBwYWdlXG5hY3Rpb24gJ3JlcWluaXQnXG5cbiNcbiNcbiMgTGlzdGVuIHRvIHBhc3RlIGV2ZW50IGFuZCBwYXN0ZSB0byBtZXNzYWdlIHRleHRhcmVhXG4jXG4jICBUaGUgb25seSB0aW1lIHdoZW4gdGhpcyBldmVudCBpcyBub3QgdHJpZ2dlcmVkLCBpcyB3aGVuXG4jICAgdGhlIGV2ZW50IGlzIHRyaWdnZXJlZCBmcm9tIHRoZSBtZXNzYWdlLWFyZWEgaXRzZWxmXG4jXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICdwYXN0ZScsIChlKSAtPlxuICAgIGlmIG5vdCBjbGlwYm9hcmQucmVhZEltYWdlKCkuaXNFbXB0eSgpIGFuZCBub3QgY2xpcGJvYXJkLnJlYWRUZXh0KClcbiAgICAgICAgYWN0aW9uICdvbnBhc3RlaW1hZ2UnXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICMgZm9jdXMgb24gd2ViIGNvbnRlbnRzXG4gICAgbWFpbldpbmRvdyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KClcbiAgICBtYWluV2luZG93LndlYkNvbnRlbnRzLmZvY3VzKClcbiAgICAjIGZvY3VzIG9uIHRleHRhcmVhXG4gICAgZWwgPSB3aW5kb3cuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2UtaW5wdXQnKVxuICAgIGVsPy5mb2N1cygpXG5cbiMgcmVnaXN0ZXIgZXZlbnQgbGlzdGVuZXJzIGZvciBvbi9vZmZsaW5lXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciAnb25saW5lJywgIC0+IGFjdGlvbiAnd29ubGluZScsIHRydWVcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyICdvZmZsaW5lJywgLT4gYWN0aW9uICd3b25saW5lJywgZmFsc2VcblxuI1xuI1xuIyBDYXRjaCB1bnJlc3BvbnNpdmUgZXZlbnRzXG5yZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpLm9uICd1bnJlc3BvbnNpdmUnLCAoZXJyb3IpIC0+XG4gICAgbm90ciBtc2cgPSBcIldhcm5pbmc6IFlha1lhayBpcyBiZWNvbWluZyB1bnJlc3BvbnNpdmUuXCIsXG4gICAgICAgIHsgaWQ6ICd1bnJlc3BvbnNpdmUnfVxuICAgIGNvbnNvbGUubG9nICdVbnJlc3BvbnNpdmUgZXZlbnQnLCBtc2dcbiAgICBpcGMuc2VuZCAnZXJyb3JJbldpbmRvdycsICdVbnJlc3BvbnNpdmUgd2luZG93J1xuXG4jXG4jXG4jIFNob3cgYSBtZXNzYWdlXG5yZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpLm9uICdyZXNwb25zaXZlJywgKCkgLT5cbiAgICBub3RyIFwiQmFjayB0byBub3JtYWwgYWdhaW4hXCIsIHsgaWQ6ICd1bnJlc3BvbnNpdmUnfVxuXG4jIExpc3RlbiB0byBjbG9zZSBhbmQgcXVpdCBldmVudHNcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyICdiZWZvcmV1bmxvYWQnLCAoZSkgLT5cbiAgICBpZiByZW1vdGUuZ2V0R2xvYmFsKCdmb3JjZUNsb3NlJylcbiAgICAgICAgcmV0dXJuXG5cbiAgICBoaWRlID0gKFxuICAgICAgICAjIE1hYyBvcyBhbmQgdGhlIGRvY2sgaGF2ZSBhIHNwZWNpYWwgcmVsYXRpb25zaGlwXG4gICAgICAgIChwcm9jZXNzLnBsYXRmb3JtID09ICdkYXJ3aW4nICYmICF2aWV3c3RhdGUuaGlkZWRvY2tpY29uKSB8fFxuICAgICAgICAjIEhhbmRsZSB0aGUgY2xvc2UgdG8gdHJheSBhY3Rpb25cbiAgICAgICAgdmlld3N0YXRlLmNsb3NldG90cmF5XG4gICAgKVxuXG4gICAgaWYgaGlkZVxuICAgICAgICBlLnJldHVyblZhbHVlID0gZmFsc2VcbiAgICAgICAgcmVtb3RlLmdldEN1cnJlbnRXaW5kb3coKS5oaWRlKClcbiAgICByZXR1cm5cblxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIgJ2tleXByZXNzJywgKGUpIC0+XG4gICAgaWYgZS5rZXlDb2RlID09IDIzIGFuZCBlLmN0cmxLZXlcbiAgICAgIGlwYy5zZW5kICdjdHJsK3dfX3ByZXNzZWQnLCAnJ1xuXG5jdXJyZW50V2luZG93LndlYkNvbnRlbnRzLm9uICdjb250ZXh0LW1lbnUnLCAoZSwgcGFyYW1zKSAtPlxuICAgIGNvbnNvbGUubG9nKCdjb250ZXh0LW1lbnUnLCBlLCBwYXJhbXMpXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY2FuU2hvdyA9IFt2aWV3c3RhdGUuU1RBVEVfTk9STUFMLFxuICAgICAgICAgICAgICAgdmlld3N0YXRlLlNUQVRFX0FERF9DT05WRVJTQVRJT04sXG4gICAgICAgICAgICAgICB2aWV3c3RhdGUuU1RBVEVfQUJPVVRdLmluY2x1ZGVzKHZpZXdzdGF0ZS5zdGF0ZSlcbiAgICBpZiBjYW5TaG93XG4gICAgICAgIGNvbnRleHRtZW51KHBhcmFtcywgdmlld3N0YXRlKS5wb3B1cCByZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpXG5cblxuIyB0ZWxsIHRoZSBzdGFydHVwIHN0YXRlXG5hY3Rpb24gJ3dvbmxpbmUnLCB3aW5kb3cubmF2aWdhdG9yLm9uTGluZVxuIl19
