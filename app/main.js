(function() {
  var BrowserWindow, Client, Menu, Q, Tray, app, client, debug, drive, fs, gotTheLock, ipc, loadAppWindow, log, login, logout, mainWindow, nativeImage, path, path_parts, paths, plug, quit, seqreq, session, tmp, tray, userData, wait;

  Client = require('hangupsjs');

  Q = require('q');

  login = require('./login');

  ipc = require('electron').ipcMain;

  fs = require('fs');

  path = require('path');

  tmp = require('tmp');

  session = require('electron').session;

  log = require('bog');

  [drive, ...path_parts] = path.normalize(__dirname).split(path.sep);

  global.YAKYAK_ROOT_DIR = [drive, ...path_parts.map(encodeURIComponent)].join('/');

  // test if flag debug is preset (other flags can be used via package args
  //  but requres node v6)
  debug = process.argv.includes('--debug');

  tmp.setGracefulCleanup();

  app = require('electron').app;

  console.log('Starting Yakyak v' + app.getVersion() + '...');

  if (Client.VERSION) {
    console.log('  using hangupsjs v' + Client.VERSION);
  }

  console.log('--------');

  app.disableHardwareAcceleration(); // was using a lot of resources needlessly

  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

  BrowserWindow = require('electron').BrowserWindow;

  // Moving out of UI into main process
  ({Menu, Tray, nativeImage} = require('electron'));

  tray = null; // set global tray

  
  // Path for configuration
  userData = path.normalize(app.getPath('userData'));

  if (!fs.existsSync(userData)) {
    // makedir if it doesn't exist
    fs.mkdirSync(userData);
  }

  // some default paths to store tokens needed for hangupsjs to reconnect
  paths = {
    rtokenpath: path.join(userData, 'refreshtoken.txt'),
    cookiespath: path.join(userData, 'cookies.json'),
    chromecookie: path.join(userData, 'Cookies'),
    configpath: path.join(userData, 'config.json')
  };

  client = new Client({
    rtokenpath: paths.rtokenpath,
    cookiespath: paths.cookiespath
  });

  plug = function(rs, rj) {
    return function(err, val) {
      if (err) {
        return rj(err);
      } else {
        return rs(val);
      }
    };
  };

  logout = function() {
    var promise;
    log.info('Logging out...');
    promise = client.logout();
    promise.then(function(res) {
      var argv, ref, ref1, spawn;
      argv = process.argv;
      spawn = require('child_process').spawn;
      // remove electron cookies
      if (typeof mainWindow !== "undefined" && mainWindow !== null) {
        if ((ref = mainWindow.webContents) != null) {
          if ((ref1 = ref.session) != null) {
            ref1.clearStorageData([], function(data) {
              return console.log(data);
            });
          }
        }
      }
      spawn(argv.shift(), argv, {
        cwd: process.cwd,
        env: process.env,
        detached: true,
        stdio: 'inherit'
      });
      return quit();
    });
    return promise; // like it matters
  };

  seqreq = require('./seqreq');

  mainWindow = null;

  // Only allow a single active instance
  gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return;
  }

  // If someone tries to run a second instance, we should focus our window.
  app.on('second-instance', function(event, commandLine, workingDirectory) {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      return mainWindow.focus();
    }
  });

  global.i18nOpts = {
    opts: null,
    locale: null
  };

  // No more minimizing to tray, just close it
  global.forceClose = false;

  quit = function() {
    global.forceClose = true;
    if (mainWindow != null) {
      // force all windows to close
      mainWindow.destroy();
    }
    console.log('--------\nGoodbye');
    app.quit();
  };

  app.on('before-quit', function() {
    global.forceClose = true;
    global.i18nOpts = null;
  });

  // For OSX show window main window if we've hidden it.
  // https://github.com/electron/electron/blob/master/docs/api/app.md#event-activate-os-x
  app.on('activate', function() {
    return mainWindow.show();
  });

  // Load the default html for the window
  //  if user sees this html then it's an error and it tells how to report it
  loadAppWindow = function() {
    mainWindow.loadURL('file://' + YAKYAK_ROOT_DIR + '/ui/index.html');
    // Only show window when it has some content
    return mainWindow.once('ready-to-show', function() {
      return mainWindow.webContents.send('ready-to-show');
    });
  };

  // helper wait promise
  wait = function(t) {
    return Q.Promise(function(rs) {
      return setTimeout(rs, t);
    });
  };

  //    ______ _           _
  //   |  ____| |         | |                       /\
  //   | |__  | | ___  ___| |_ _ __ ___  _ __      /  \   _ __  _ __
  //   |  __| | |/ _ \/ __| __| '__/ _ \| '_ \    / /\ \ | '_ \| '_ \
  //   | |____| |  __/ (__| |_| | | (_) | | | |  / ____ \| |_) | |_) |
  //   |______|_|\___|\___|\__|_|  \___/|_| |_| /_/    \_\ .__/| .__/
  //                                                     | |   | |
  //                                                     |_|   |_|
  app.on('ready', function() {
    var creds, icon_name, ipcsend, messageQueue, proxycheck, reconnect, reconnectCount, sendInit, syncrecent, updateConversation, windowOpts;
    proxycheck = function() {
      var todo;
      todo = [
        {
          url: 'http://plus.google.com',
          env: 'HTTP_PROXY'
        },
        {
          url: 'https://plus.google.com',
          env: 'HTTPS_PROXY'
        }
      ];
      return Q.all(todo.map(function(t) {
        return Q.Promise(function(rs) {
          console.log(`resolving proxy ${t.url}`);
          return session.defaultSession.resolveProxy(t.url).then(function(proxyURL) {
            var _, base, name1, purl;
            console.log(`resolved proxy ${proxyURL}`);
            // Format of proxyURL is either "DIRECT" or "PROXY 127.0.0.1:8888"
            [_, purl] = proxyURL.split(' ');
            if ((base = process.env)[name1 = t.env] == null) {
              base[name1] = purl ? `http://${purl}` : "";
            }
            return rs();
          });
        });
      }));
    };
    icon_name = process.platform === 'win32' ? 'icon@2.png' : 'icon@32.png';
    windowOpts = {
      width: 730,
      height: 590,
      "min-width": 620,
      "min-height": 420,
      icon: path.join(__dirname, 'icons', icon_name),
      show: false,
      spellcheck: true,
      autohideMenuBar: true,
      webPreferences: {
        nodeIntegration: true
      }
    };
    // autoHideMenuBar : true unless process.platform is 'darwin'
    // preload: path.join(app.getAppPath(), 'ui', 'app.js')
    if (process.platform === 'darwin') {
      windowOpts.titleBarStyle = 'hiddenInset';
    }
    if (process.platform === 'win32') {
      windowOpts.frame = false;
    }
    // Create the browser window.
    mainWindow = new BrowserWindow(windowOpts);
    // Launch fullscreen with DevTools open, usage: npm run debug
    if (debug) {
      mainWindow.webContents.openDevTools();
      mainWindow.maximize();
      mainWindow.show();
      // this will also show more debugging from hangupsjs client
      log.level('debug');
      client.loglevel('debug');
      try {
        require('devtron').install();
      } catch (error1) {

      }
    }
    // do nothing

    // and load the index.html of the app. this may however be yanked
    // away if we must do auth.
    loadAppWindow();
    
    // Handle uncaught exceptions from the main process
    process.on('uncaughtException', function(msg) {
      ipcsend('expcetioninmain', msg);
      
      return console.log(`Error on main process:\n${msg}\n` + "--- End of error message. More details:\n", msg);
    });
    
    // Handle crashes on the main window and show in console
    mainWindow.webContents.on('crashed', function(msg) {
      console.log('Crash event on main window!', msg);
      return ipc.send('expcetioninmain', {
        msg: 'Detected a crash event on the main window.',
        event: msg
      });
    });
    // short hand
    ipcsend = function(...as) {
      return mainWindow.webContents.send(...as);
    };
    // callback for credentials
    creds = function() {
      var loginWindow, prom;
      console.log("asking for login credentials");
      loginWindow = new BrowserWindow({
        width: 730,
        height: 590,
        "min-width": 620,
        "min-height": 420,
        icon: path.join(__dirname, 'icons', 'icon.png'),
        show: true,
        webPreferences: {
          nodeIntegration: false
        }
      });
      if (debug) {
        loginWindow.webContents.openDevTools();
      }
      loginWindow.on('closed', quit);
      global.windowHideWhileCred = true;
      mainWindow.hide();
      loginWindow.focus();
      // reinstate app window when login finishes
      prom = login(loginWindow).then(function(rs) {
        global.forceClose = true;
        loginWindow.removeAllListeners('closed');
        loginWindow.close();
        mainWindow.show();
        return rs;
      });
      return {
        auth: function() {
          return prom;
        }
      };
    };
    // sends the init structures to the client
    sendInit = function() {
      var ref;
      if (!(client != null ? (ref = client.init) != null ? ref.self_entity : void 0 : void 0)) {
        // we have no init data before the client has connected first
        // time.
        return false;
      }
      ipcsend('init', {
        init: client.init
      });
      return true;
    };
    // keeps trying to connec the hangupsjs and communicates those
    // attempts to the client.
    reconnect = function() {
      console.log('reconnecting', reconnectCount);
      return proxycheck().then(function() {
        return client.connect(creds).then(function() {
          console.log('connected', reconnectCount);
          // on first connect, send init, after that only resync
          if (reconnectCount === 0) {
            log.debug('Sending init...');
            sendInit();
          } else {
            log.debug('SyncRecent...');
            syncrecent();
          }
          return reconnectCount++;
        }).catch(function(e) {
          return console.log('error connecting', e);
        });
      });
    };
    // counter for reconnects
    reconnectCount = 0;
    // whether to connect is dictated by the client.
    ipc.on('hangupsConnect', function() {
      console.log('hangupsjs:: connecting');
      return reconnect();
    });
    ipc.on('hangupsDisconnect', function() {
      console.log('hangupsjs:: disconnect');
      reconnectCount = 0;
      return client.disconnect();
    });
    // client deals with window sizing
    mainWindow.on('resize', function(ev) {
      return ipcsend('resize', mainWindow.getSize());
    });
    mainWindow.on('move', function(ev) {
      return ipcsend('move', mainWindow.getPosition());
    });
    // whenever it fails, we try again
    client.on('connect_failed', function(e) {
      console.log('connect_failed', e);
      return wait(3000).then(function() {
        return reconnect();
      });
    });
    //    _      _     _                     _____ _____   _____
    //   | |    (_)   | |                   |_   _|  __ \ / ____|
    //   | |     _ ___| |_ ___ _ __           | | | |__) | |
    //   | |    | / __| __/ _ \ '_ \          | | |  ___/| |
    //   | |____| \__ \ ||  __/ | | |_ _ _   _| |_| |    | |____
    //   |______|_|___/\__\___|_| |_(_|_|_) |_____|_|     \_____|

    // Listen on events from main window

    // when client requests (re-)init since the first init
    // object is sent as soon as possible on startup
    ipc.on('reqinit', function() {
      if (sendInit()) {
        return syncrecent();
      }
    });
    ipc.on('togglefullscreen', function() {
      return mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
    // bye bye
    ipc.on('logout', logout);
    ipc.on('quit', quit);
    ipc.on('errorInWindow', function(ev, error, winName = 'YakYak') {
      if (!global.isReadyToShow) {
        mainWindow.show();
      }
      ipcsend('expcetioninmain', error);
      return console.log(`Error on ${winName} window:\n`, error, `\n--- End of error message in ${winName} window.`);
    });
    // sendchatmessage, executed sequentially and
    // retried if not sent successfully
    messageQueue = Q();
    ipc.on('sendchatmessage', function(ev, msg) {
      var client_generated_id, conv_id, delivery_medium, image_id, message_action_type, otr, segs, sendForSure;
      ({conv_id, segs, client_generated_id, image_id, otr, message_action_type, delivery_medium} = msg);
      sendForSure = function() {
        return Q.promise(function(resolve, reject, notify) {
          var attempt;
          attempt = function() {
            // console.log 'sendchatmessage', client_generated_id
            if (delivery_medium == null) {
              delivery_medium = null;
            }
            return client.sendchatmessage(conv_id, segs, image_id, otr, client_generated_id, delivery_medium, message_action_type).then(function(r) {
              // console.log 'sendchatmessage:result', r?.created_event?.self_event_state?.client_generated_id
              ipcsend('sendchatmessage:result', r);
              return resolve();
            });
          };
          return attempt();
        });
      };
      return messageQueue = messageQueue.then(function() {
        return sendForSure();
      });
    });
    // get locale for translations
    ipc.on('seti18n', function(ev, opts, language) {
      if (opts != null) {
        global.i18nOpts.opts = opts;
      }
      if (language != null) {
        return global.i18nOpts.locale = language;
      }
    });
    ipc.on('appfocus', function() {
      app.focus();
      if (mainWindow.isVisible()) {
        return mainWindow.focus();
      } else {
        return mainWindow.show();
      }
    });
    ipc.handle('tray-destroy', function(ev) {
      if (tray) {
        tray.destroy();
        if (tray.isDestroyed()) {
          return tray = null;
        }
      }
    });
    ipc.handle('tray', function(ev, menu, iconpath, toolTip) {
      var contextMenu;
      if (tray) { // create tray if it doesn't exist
        if (tray.currentImage !== iconpath) {
          tray.setImage(iconpath);
        }
      } else {
        tray = new Tray(iconpath);
      }
      tray.currentImage = iconpath;
      tray.setToolTip(toolTip);
      tray.on('click', function(ev) {
        return ipcsend('menuaction', 'togglewindow');
      });
      if (menu) {
        // build functions that cannot be sent via ipc
        contextMenu = menu.map(function(el) {
          el.click = function(r) {
            return ipcsend('menuaction', el.click_action);
          };
          // delete el.click_action
          return el;
        });
        return tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
      }
    });
    
    // Methods below use seqreq that returns a promise and allows for retry

    // sendchatmessage, executed sequentially and
    // retried if not sent successfully
    ipc.on('querypresence', seqreq(function(ev, id) {
      return client.querypresence(id).then(function(r) {
        return ipcsend('querypresence:result', r.presence_result[0]);
      }, false, function() {
        return 1;
      });
    }));
    ipc.on('initpresence', function(ev, l) {
      var i, j, len, p, results;
      results = [];
      for (i = j = 0, len = l.length; j < len; i = ++j) {
        p = l[i];
        if (p !== null) {
          results.push(client.querypresence(p.id).then(function(r) {
            return ipcsend('querypresence:result', r.presence_result[0]);
          }, false, function() {
            return 1;
          }));
        }
      }
      return results;
    });
    // no retry, only one outstanding call
    ipc.on('setpresence', seqreq(function(ev, status = true) {
      return client.setpresence(status);
    }, false, function() {
      return 1;
    }));
    // no retry, only one outstanding call
    ipc.on('setactiveclient', seqreq(function(ev, active, secs) {
      return client.setactiveclient(active, secs);
    }, false, function() {
      return 1;
    }));
    // watermarking is only interesting for the last of each conv_id
    // retry send and dedupe for each conv_id
    ipc.on('updatewatermark', seqreq(function(ev, conv_id, time) {
      return client.updatewatermark(conv_id, time);
    }, true, function(ev, conv_id, time) {
      return conv_id;
    }));
    // getentity is not super important, the client will try again when encountering
    // entities without photo_url. so no retry, but do execute all such reqs
    // ipc.on 'getentity', seqreq (ev, ids) ->
    //     client.getentitybyid(ids).then (r) -> ipcsend 'getentity:result', r
    // , false

    // we want to upload. in the order specified, with retry
    ipc.on('uploadimage', seqreq(function(ev, spec) {
      var client_generated_id, conv_id;
      ({path, conv_id, client_generated_id} = spec);
      ipcsend('uploadingimage', {conv_id, client_generated_id, path});
      return client.uploadimage(path).then(function(image_id) {
        var delivery_medium;
        delivery_medium = null;
        return client.sendchatmessage(conv_id, null, image_id, null, client_generated_id, delivery_medium);
      });
    }, true));
    // we want to upload. in the order specified, with retry
    ipc.on('uploadclipboardimage', seqreq(function(ev, spec) {
      var client_generated_id, conv_id, file, pngData;
      ({pngData, conv_id, client_generated_id} = spec);
      file = tmp.fileSync({
        postfix: ".png"
      });
      ipcsend('uploadingimage', {
        conv_id,
        client_generated_id,
        path: file.name
      });
      return Q.Promise(function(rs, rj) {
        return fs.writeFile(file.name, pngData, plug(rs, rj));
      }).then(function() {
        return client.uploadimage(file.name);
      }).then(function(image_id) {
        var delivery_medium;
        delivery_medium = null;
        return client.sendchatmessage(conv_id, null, image_id, null, client_generated_id, delivery_medium);
      }).then(function() {
        return file.removeCallback();
      });
    }, true));
    // retry only last per conv_id
    ipc.on('setconversationnotificationlevel', seqreq(function(ev, conv_id, level) {
      return client.setconversationnotificationlevel(conv_id, level);
    }, true, function(ev, conv_id, level) {
      return conv_id;
    }));
    // retry
    ipc.on('deleteconversation', seqreq(function(ev, conv_id) {
      if (debug) {
        console.log('deletingconversation', conv_id);
      }
      return client.deleteconversation(conv_id).then(function(r) {
        if (debug) {
          console.log('DEBUG: deleteconvsersation response: ', r);
        }
        if (r.response_header.status !== 'OK') {
          return ipcsend('message', i18n.__('conversation.delete_error:Error occured when deleting conversation'));
        }
      });
    }, true));
    ipc.on('removeuser', seqreq(function(ev, conv_id) {
      return client.removeuser(conv_id);
    }, true));
    // no retries, dedupe on conv_id
    ipc.on('setfocus', seqreq(function(ev, conv_id) {
      client.setfocus(conv_id);
      return updateConversation(conv_id);
    }, false, function(ev, conv_id) {
      return conv_id;
    }));
    // update conversation with metadata (for unread messages)
    updateConversation = function(conv_id) {
      return client.getconversation(conv_id, new Date(), 1, true).then(function(r) {
        return ipcsend('getconversationmetadata:response', r);
      });
    };
    ipc.on('updateConversation', seqreq(function(ev, conv_id) {
      return updateConversation(conv_id);
    }, false, function(ev, conv_id) {
      return conv_id;
    }));
    // no retries, dedupe on conv_id
    ipc.on('settyping', seqreq(function(ev, conv_id, v) {
      return client.settyping(conv_id, v);
    }, false, function(ev, conv_id) {
      return conv_id;
    }));
    ipc.on('updatebadge', function(ev, value) {
      if (app.dock) {
        return app.dock.setBadge(value);
      }
    });
    ipc.on('searchentities', function(ev, query, max_results) {
      var promise;
      promise = client.searchentities(query, max_results);
      return promise.then(function(res) {
        return ipcsend('searchentities:result', res);
      });
    });
    ipc.on('createconversation', function(ev, ids, name, forcegroup = false) {
      var conv, promise;
      promise = client.createconversation(ids, forcegroup);
      conv = null;
      promise.then(function(res) {
        var conv_id;
        conv = res.conversation;
        conv_id = conv.id.id;
        if (name) {
          return client.renameconversation(conv_id, name);
        }
      });
      return promise = promise.then(function(res) {
        return ipcsend('createconversation:result', conv, name);
      });
    });
    ipc.on('adduser', function(ev, conv_id, toadd) {
      return client.adduser(conv_id, toadd); // will automatically trigger membership_change
    });
    ipc.on('renameconversation', function(ev, conv_id, newname) {
      return client.renameconversation(conv_id, newname); // will trigger conversation_rename
    });
    
    // no retries, just dedupe on the ids
    ipc.on('getentity', seqreq(function(ev, ids, data) {
      return client.getentitybyid(ids).then(function(r) {
        return ipcsend('getentity:result', r, data);
      });
    }, false, function(ev, ids) {
      return ids.sort().join(',');
    }));
    // no retry, just one single request
    ipc.on('syncallnewevents', seqreq(function(ev, time) {
      console.log('syncallnewevents: Asking hangouts to sync new events');
      return client.syncallnewevents(time).then(function(r) {
        return ipcsend('syncallnewevents:response', r);
      });
    }, false, function(ev, time) {
      return 1;
    }));
    // no retry, just one single request
    ipc.on('syncrecentconversations', syncrecent = seqreq(function(ev) {
      console.log('syncrecentconversations: Asking hangouts to sync recent conversations');
      return client.syncrecentconversations().then(function(r) {
        ipcsend('syncrecentconversations:response', r);
        // this is because we use syncrecent on reqinit (dev-mode
        // refresh). if we succeeded getting a response, we call it
        // connected.
        return ipcsend('connected');
      });
    }, false, function(ev, time) {
      return 1;
    }));
    // retry, one single per conv_id
    ipc.on('getconversation', seqreq(function(ev, conv_id, timestamp, max) {
      return client.getconversation(conv_id, timestamp, max, true).then(function(r) {
        return ipcsend('getconversation:response', r);
      });
    }, false, function(ev, conv_id, timestamp, max) {
      return conv_id;
    }));
    ipc.on('ctrl+w__pressed', function() {
      return mainWindow.hide();
    });
    //    _      _     _                     _                                   _
    //   | |    (_)   | |                   | |                                 | |
    //   | |     _ ___| |_ ___ _ __         | |__   __ _ _ __   __ _  ___  _   _| |_ ___
    //   | |    | / __| __/ _ \ '_ \        | '_ \ / _` | '_ \ / _` |/ _ \| | | | __/ __|
    //   | |____| \__ \ ||  __/ | | |_ _ _  | | | | (_| | | | | (_| | (_) | |_| | |_\__ \
    //   |______|_|___/\__\___|_| |_(_|_|_) |_| |_|\__,_|_| |_|\__, |\___/ \__,_|\__|___/
    //                                                          __/ |
    //                                                         |___/
    // Listen on events from hangupsjs client.

    // propagate Hangout client events to the renderer
    return require('./ui/events').forEach(function(n) {
      return client.on(n, function(e) {
        log.debug('DEBUG: Received event', n);
        if (n === 'client_conversation') {
          // client_conversation comes without metadata by default.
          //  We need it for unread count
          updateConversation(e.conversation_id.id);
        }
        return ipcsend(n, e);
      });
    });
  });

  // Emitted when the window is about to close.
// Hides the window if we're not force closing.
//  IMPORTANT: moved to app.coffee

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLGFBQUEsRUFBQSxNQUFBLEVBQUEsSUFBQSxFQUFBLENBQUEsRUFBQSxJQUFBLEVBQUEsR0FBQSxFQUFBLE1BQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLEVBQUEsRUFBQSxVQUFBLEVBQUEsR0FBQSxFQUFBLGFBQUEsRUFBQSxHQUFBLEVBQUEsS0FBQSxFQUFBLE1BQUEsRUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBLElBQUEsRUFBQSxVQUFBLEVBQUEsS0FBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsTUFBQSxFQUFBLE9BQUEsRUFBQSxHQUFBLEVBQUEsSUFBQSxFQUFBLFFBQUEsRUFBQTs7RUFBQSxNQUFBLEdBQVksT0FBQSxDQUFRLFdBQVI7O0VBQ1osQ0FBQSxHQUFZLE9BQUEsQ0FBUSxHQUFSOztFQUNaLEtBQUEsR0FBWSxPQUFBLENBQVEsU0FBUjs7RUFDWixHQUFBLEdBQVksT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDaEMsRUFBQSxHQUFZLE9BQUEsQ0FBUSxJQUFSOztFQUNaLElBQUEsR0FBWSxPQUFBLENBQVEsTUFBUjs7RUFDWixHQUFBLEdBQVksT0FBQSxDQUFRLEtBQVI7O0VBQ1osT0FBQSxHQUFZLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQ2hDLEdBQUEsR0FBWSxPQUFBLENBQVEsS0FBUjs7RUFFWixDQUFDLEtBQUQsRUFBUSxHQUFBLFVBQVIsQ0FBQSxHQUF5QixJQUFJLENBQUMsU0FBTCxDQUFlLFNBQWYsQ0FBeUIsQ0FBQyxLQUExQixDQUFnQyxJQUFJLENBQUMsR0FBckM7O0VBQ3pCLE1BQU0sQ0FBQyxlQUFQLEdBQXlCLENBQUMsS0FBRCxFQUFRLEdBQUEsVUFBVSxDQUFDLEdBQVgsQ0FBZSxrQkFBZixDQUFSLENBQThDLENBQUMsSUFBL0MsQ0FBb0QsR0FBcEQsRUFYekI7Ozs7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LENBQTFCLEVBalpKOzs7Ozs7Ozs7Ozs7V0ErWkksT0FBQSxDQUFRLGFBQVIsQ0FBc0IsQ0FBQyxPQUF2QixDQUErQixRQUFBLENBQUMsQ0FBRCxDQUFBO2FBQzNCLE1BQU0sQ0FBQyxFQUFQLENBQVUsQ0FBVixFQUFhLFFBQUEsQ0FBQyxDQUFELENBQUE7UUFDVCxHQUFHLENBQUMsS0FBSixDQUFVLHVCQUFWLEVBQW1DLENBQW5DO1FBR0EsSUFBNEMsQ0FBQSxLQUFLLHFCQUFqRDs7O1VBQUEsa0JBQUEsQ0FBbUIsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxFQUFyQyxFQUFBOztlQUNBLE9BQUEsQ0FBUSxDQUFSLEVBQVcsQ0FBWDtNQUxTLENBQWI7SUFEMkIsQ0FBL0I7RUFoYVksQ0FBaEI7O0VBL0hBOzs7QUFBQSIsInNvdXJjZXNDb250ZW50IjpbIkNsaWVudCAgICA9IHJlcXVpcmUgJ2hhbmd1cHNqcydcblEgICAgICAgICA9IHJlcXVpcmUgJ3EnXG5sb2dpbiAgICAgPSByZXF1aXJlICcuL2xvZ2luJ1xuaXBjICAgICAgID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5pcGNNYWluXG5mcyAgICAgICAgPSByZXF1aXJlICdmcydcbnBhdGggICAgICA9IHJlcXVpcmUgJ3BhdGgnXG50bXAgICAgICAgPSByZXF1aXJlICd0bXAnXG5zZXNzaW9uICAgPSByZXF1aXJlKCdlbGVjdHJvbicpLnNlc3Npb25cbmxvZyAgICAgICA9IHJlcXVpcmUoJ2JvZycpO1xuXG5bZHJpdmUsIHBhdGhfcGFydHMuLi5dID0gcGF0aC5ub3JtYWxpemUoX19kaXJuYW1lKS5zcGxpdChwYXRoLnNlcClcbmdsb2JhbC5ZQUtZQUtfUk9PVF9ESVIgPSBbZHJpdmUsIHBhdGhfcGFydHMubWFwKGVuY29kZVVSSUNvbXBvbmVudCkuLi5dLmpvaW4oJy8nKVxuXG4jIHRlc3QgaWYgZmxhZyBkZWJ1ZyBpcyBwcmVzZXQgKG90aGVyIGZsYWdzIGNhbiBiZSB1c2VkIHZpYSBwYWNrYWdlIGFyZ3NcbiMgIGJ1dCByZXF1cmVzIG5vZGUgdjYpXG5kZWJ1ZyA9IHByb2Nlc3MuYXJndi5pbmNsdWRlcyAnLS1kZWJ1ZydcblxudG1wLnNldEdyYWNlZnVsQ2xlYW51cCgpXG5cbmFwcCA9IHJlcXVpcmUoJ2VsZWN0cm9uJykuYXBwXG5cbmNvbnNvbGUubG9nKCdTdGFydGluZyBZYWt5YWsgdicgKyBhcHAuZ2V0VmVyc2lvbigpICsgJy4uLicpXG5jb25zb2xlLmxvZygnICB1c2luZyBoYW5ndXBzanMgdicgKyBDbGllbnQuVkVSU0lPTikgaWYgQ2xpZW50LlZFUlNJT05cbmNvbnNvbGUubG9nKCctLS0tLS0tLScpXG5hcHAuZGlzYWJsZUhhcmR3YXJlQWNjZWxlcmF0aW9uKCkgIyB3YXMgdXNpbmcgYSBsb3Qgb2YgcmVzb3VyY2VzIG5lZWRsZXNzbHlcbmFwcC5jb21tYW5kTGluZS5hcHBlbmRTd2l0Y2goJ2F1dG9wbGF5LXBvbGljeScsICduby11c2VyLWdlc3R1cmUtcmVxdWlyZWQnKVxuXG5Ccm93c2VyV2luZG93ID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5Ccm93c2VyV2luZG93XG5cbiMgTW92aW5nIG91dCBvZiBVSSBpbnRvIG1haW4gcHJvY2Vzc1xueyBNZW51LCBUcmF5LCBuYXRpdmVJbWFnZSB9ID0gcmVxdWlyZSgnZWxlY3Ryb24nKVxudHJheSA9IG51bGwgIyBzZXQgZ2xvYmFsIHRyYXlcblxuIyBQYXRoIGZvciBjb25maWd1cmF0aW9uXG51c2VyRGF0YSA9IHBhdGgubm9ybWFsaXplKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpKVxuXG4jIG1ha2VkaXIgaWYgaXQgZG9lc24ndCBleGlzdFxuZnMubWtkaXJTeW5jKHVzZXJEYXRhKSBpZiBub3QgZnMuZXhpc3RzU3luYyB1c2VyRGF0YVxuXG4jIHNvbWUgZGVmYXVsdCBwYXRocyB0byBzdG9yZSB0b2tlbnMgbmVlZGVkIGZvciBoYW5ndXBzanMgdG8gcmVjb25uZWN0XG5wYXRocyA9XG4gICAgcnRva2VucGF0aDogcGF0aC5qb2luKHVzZXJEYXRhLCAncmVmcmVzaHRva2VuLnR4dCcpXG4gICAgY29va2llc3BhdGg6IHBhdGguam9pbih1c2VyRGF0YSwgJ2Nvb2tpZXMuanNvbicpXG4gICAgY2hyb21lY29va2llOiBwYXRoLmpvaW4odXNlckRhdGEsICdDb29raWVzJylcbiAgICBjb25maWdwYXRoOiBwYXRoLmpvaW4odXNlckRhdGEsICdjb25maWcuanNvbicpXG5cbmNsaWVudCA9IG5ldyBDbGllbnQoXG4gICAgcnRva2VucGF0aDogcGF0aHMucnRva2VucGF0aFxuICAgIGNvb2tpZXNwYXRoOiBwYXRocy5jb29raWVzcGF0aFxuKVxuXG5wbHVnID0gKHJzLCByaikgLT4gKGVyciwgdmFsKSAtPiBpZiBlcnIgdGhlbiByaihlcnIpIGVsc2UgcnModmFsKVxuXG5sb2dvdXQgPSAtPlxuICAgIGxvZy5pbmZvICdMb2dnaW5nIG91dC4uLidcbiAgICBwcm9taXNlID0gY2xpZW50LmxvZ291dCgpXG4gICAgcHJvbWlzZS50aGVuIChyZXMpIC0+XG4gICAgICAgIGFyZ3YgPSBwcm9jZXNzLmFyZ3ZcbiAgICAgICAgc3Bhd24gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJykuc3Bhd25cbiAgICAgICAgIyByZW1vdmUgZWxlY3Ryb24gY29va2llc1xuICAgICAgICBtYWluV2luZG93Py53ZWJDb250ZW50cz8uc2Vzc2lvbj8uY2xlYXJTdG9yYWdlRGF0YShbXSwgKGRhdGEpIC0+IGNvbnNvbGUubG9nKGRhdGEpKVxuICAgICAgICBzcGF3biBhcmd2LnNoaWZ0KCksIGFyZ3YsXG4gICAgICAgICAgICBjd2Q6IHByb2Nlc3MuY3dkXG4gICAgICAgICAgICBlbnY6IHByb2Nlc3MuZW52XG4gICAgICAgICAgICBkZXRhY2hlZDogdHJ1ZVxuICAgICAgICAgICAgc3RkaW86ICdpbmhlcml0J1xuICAgICAgICBxdWl0KClcbiAgICByZXR1cm4gcHJvbWlzZSAjIGxpa2UgaXQgbWF0dGVyc1xuXG5zZXFyZXEgPSByZXF1aXJlICcuL3NlcXJlcSdcblxubWFpbldpbmRvdyA9IG51bGxcblxuIyBPbmx5IGFsbG93IGEgc2luZ2xlIGFjdGl2ZSBpbnN0YW5jZVxuZ290VGhlTG9jayA9IGFwcC5yZXF1ZXN0U2luZ2xlSW5zdGFuY2VMb2NrKClcblxuaWYgIWdvdFRoZUxvY2tcbiAgICBhcHAucXVpdCgpXG4gICAgcmV0dXJuXG5cbiMgSWYgc29tZW9uZSB0cmllcyB0byBydW4gYSBzZWNvbmQgaW5zdGFuY2UsIHdlIHNob3VsZCBmb2N1cyBvdXIgd2luZG93LlxuYXBwLm9uICdzZWNvbmQtaW5zdGFuY2UnLCAoZXZlbnQsIGNvbW1hbmRMaW5lLCB3b3JraW5nRGlyZWN0b3J5KSAtPlxuICAgIGlmIG1haW5XaW5kb3dcbiAgICAgICAgbWFpbldpbmRvdy5yZXN0b3JlKCkgaWYgbWFpbldpbmRvdy5pc01pbmltaXplZCgpXG4gICAgICAgIG1haW5XaW5kb3cuZm9jdXMoKVxuXG5nbG9iYWwuaTE4bk9wdHMgPSB7IG9wdHM6IG51bGwsIGxvY2FsZTogbnVsbCB9XG5cbiMgTm8gbW9yZSBtaW5pbWl6aW5nIHRvIHRyYXksIGp1c3QgY2xvc2UgaXRcbmdsb2JhbC5mb3JjZUNsb3NlID0gZmFsc2VcbnF1aXQgPSAtPlxuICAgIGdsb2JhbC5mb3JjZUNsb3NlID0gdHJ1ZVxuICAgICMgZm9yY2UgYWxsIHdpbmRvd3MgdG8gY2xvc2VcbiAgICBtYWluV2luZG93LmRlc3Ryb3koKSBpZiBtYWluV2luZG93P1xuICAgIGNvbnNvbGUubG9nKCctLS0tLS0tLVxcbkdvb2RieWUnKVxuICAgIGFwcC5xdWl0KClcbiAgICByZXR1cm5cblxuYXBwLm9uICdiZWZvcmUtcXVpdCcsIC0+XG4gICAgZ2xvYmFsLmZvcmNlQ2xvc2UgPSB0cnVlXG4gICAgZ2xvYmFsLmkxOG5PcHRzID0gbnVsbFxuICAgIHJldHVyblxuXG4jIEZvciBPU1ggc2hvdyB3aW5kb3cgbWFpbiB3aW5kb3cgaWYgd2UndmUgaGlkZGVuIGl0LlxuIyBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vYmxvYi9tYXN0ZXIvZG9jcy9hcGkvYXBwLm1kI2V2ZW50LWFjdGl2YXRlLW9zLXhcbmFwcC5vbiAnYWN0aXZhdGUnLCAtPlxuICAgIG1haW5XaW5kb3cuc2hvdygpXG5cbiMgTG9hZCB0aGUgZGVmYXVsdCBodG1sIGZvciB0aGUgd2luZG93XG4jICBpZiB1c2VyIHNlZXMgdGhpcyBodG1sIHRoZW4gaXQncyBhbiBlcnJvciBhbmQgaXQgdGVsbHMgaG93IHRvIHJlcG9ydCBpdFxubG9hZEFwcFdpbmRvdyA9IC0+XG4gICAgbWFpbldpbmRvdy5sb2FkVVJMICdmaWxlOi8vJyArIFlBS1lBS19ST09UX0RJUiArICcvdWkvaW5kZXguaHRtbCdcbiAgICAjIE9ubHkgc2hvdyB3aW5kb3cgd2hlbiBpdCBoYXMgc29tZSBjb250ZW50XG4gICAgbWFpbldpbmRvdy5vbmNlICdyZWFkeS10by1zaG93JywgKCkgLT5cbiAgICAgICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5zZW5kICdyZWFkeS10by1zaG93J1xuXG4jIGhlbHBlciB3YWl0IHByb21pc2VcbndhaXQgPSAodCkgLT4gUS5Qcm9taXNlIChycykgLT4gc2V0VGltZW91dCBycywgdFxuXG4jICAgIF9fX19fXyBfICAgICAgICAgICBfXG4jICAgfCAgX19fX3wgfCAgICAgICAgIHwgfCAgICAgICAgICAgICAgICAgICAgICAgL1xcXG4jICAgfCB8X18gIHwgfCBfX18gIF9fX3wgfF8gXyBfXyBfX18gIF8gX18gICAgICAvICBcXCAgIF8gX18gIF8gX19cbiMgICB8ICBfX3wgfCB8LyBfIFxcLyBfX3wgX198ICdfXy8gXyBcXHwgJ18gXFwgICAgLyAvXFwgXFwgfCAnXyBcXHwgJ18gXFxcbiMgICB8IHxfX19ffCB8ICBfXy8gKF9ffCB8X3wgfCB8IChfKSB8IHwgfCB8ICAvIF9fX18gXFx8IHxfKSB8IHxfKSB8XG4jICAgfF9fX19fX3xffFxcX19ffFxcX19ffFxcX198X3wgIFxcX19fL3xffCB8X3wgL18vICAgIFxcX1xcIC5fXy98IC5fXy9cbiMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgfCAgIHwgfFxuIyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfF98ICAgfF98XG5hcHAub24gJ3JlYWR5JywgLT5cbiAgICBwcm94eWNoZWNrID0gLT5cbiAgICAgICAgdG9kbyA9IFtcbiAgICAgICAgICAge3VybDonaHR0cDovL3BsdXMuZ29vZ2xlLmNvbScsICBlbnY6J0hUVFBfUFJPWFknfVxuICAgICAgICAgICB7dXJsOidodHRwczovL3BsdXMuZ29vZ2xlLmNvbScsIGVudjonSFRUUFNfUFJPWFknfVxuICAgICAgICBdXG4gICAgICAgIFEuYWxsIHRvZG8ubWFwICh0KSAtPiBRLlByb21pc2UgKHJzKSAtPlxuICAgICAgICAgICAgY29uc29sZS5sb2cgXCJyZXNvbHZpbmcgcHJveHkgI3t0LnVybH1cIlxuICAgICAgICAgICAgc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5yZXNvbHZlUHJveHkodC51cmwpLnRoZW4gKHByb3h5VVJMKSAtPlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nIFwicmVzb2x2ZWQgcHJveHkgI3twcm94eVVSTH1cIlxuICAgICAgICAgICAgICAgICMgRm9ybWF0IG9mIHByb3h5VVJMIGlzIGVpdGhlciBcIkRJUkVDVFwiIG9yIFwiUFJPWFkgMTI3LjAuMC4xOjg4ODhcIlxuICAgICAgICAgICAgICAgIFtfLCBwdXJsXSA9IHByb3h5VVJMLnNwbGl0ICcgJ1xuICAgICAgICAgICAgICAgIHByb2Nlc3MuZW52W3QuZW52XSA/PSBpZiBwdXJsIHRoZW4gXCJodHRwOi8vI3twdXJsfVwiIGVsc2UgXCJcIlxuICAgICAgICAgICAgICAgIHJzKClcblxuICAgIGljb25fbmFtZSA9IGlmIHByb2Nlc3MucGxhdGZvcm0gaXMgJ3dpbjMyJyB0aGVuICdpY29uQDIucG5nJyBlbHNlICdpY29uQDMyLnBuZydcblxuICAgIHdpbmRvd09wdHMgPSB7XG4gICAgICAgIHdpZHRoOiA3MzBcbiAgICAgICAgaGVpZ2h0OiA1OTBcbiAgICAgICAgXCJtaW4td2lkdGhcIjogNjIwXG4gICAgICAgIFwibWluLWhlaWdodFwiOiA0MjBcbiAgICAgICAgaWNvbjogcGF0aC5qb2luIF9fZGlybmFtZSwgJ2ljb25zJywgaWNvbl9uYW1lXG4gICAgICAgIHNob3c6IGZhbHNlXG4gICAgICAgIHNwZWxsY2hlY2s6IHRydWVcbiAgICAgICAgYXV0b2hpZGVNZW51QmFyOiB0cnVlXG4gICAgICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICBub2RlSW50ZWdyYXRpb246IHRydWVcbiAgICAgICAgICAgICMgcHJlbG9hZDogcGF0aC5qb2luKGFwcC5nZXRBcHBQYXRoKCksICd1aScsICdhcHAuanMnKVxuICAgICAgICB9XG4gICAgICAgICMgYXV0b0hpZGVNZW51QmFyIDogdHJ1ZSB1bmxlc3MgcHJvY2Vzcy5wbGF0Zm9ybSBpcyAnZGFyd2luJ1xuICAgIH1cblxuICAgIGlmIHByb2Nlc3MucGxhdGZvcm0gaXMgJ2RhcndpbidcbiAgICAgICAgd2luZG93T3B0cy50aXRsZUJhclN0eWxlID0gJ2hpZGRlbkluc2V0J1xuXG4gICAgaWYgcHJvY2Vzcy5wbGF0Zm9ybSBpcyAnd2luMzInXG4gICAgICAgIHdpbmRvd09wdHMuZnJhbWUgPSBmYWxzZVxuXG4gICAgIyBDcmVhdGUgdGhlIGJyb3dzZXIgd2luZG93LlxuICAgIG1haW5XaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyB3aW5kb3dPcHRzXG5cbiAgICAjIExhdW5jaCBmdWxsc2NyZWVuIHdpdGggRGV2VG9vbHMgb3BlbiwgdXNhZ2U6IG5wbSBydW4gZGVidWdcbiAgICBpZiBkZWJ1Z1xuICAgICAgICBtYWluV2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpXG4gICAgICAgIG1haW5XaW5kb3cubWF4aW1pemUoKVxuICAgICAgICBtYWluV2luZG93LnNob3coKVxuICAgICAgICAjIHRoaXMgd2lsbCBhbHNvIHNob3cgbW9yZSBkZWJ1Z2dpbmcgZnJvbSBoYW5ndXBzanMgY2xpZW50XG4gICAgICAgIGxvZy5sZXZlbCAnZGVidWcnXG4gICAgICAgIGNsaWVudC5sb2dsZXZlbCAnZGVidWcnXG4gICAgICAgIHRyeVxuICAgICAgICAgICAgcmVxdWlyZSgnZGV2dHJvbicpLmluc3RhbGwoKVxuICAgICAgICBjYXRjaFxuICAgICAgICAgICAgIyBkbyBub3RoaW5nXG5cbiAgICAjIGFuZCBsb2FkIHRoZSBpbmRleC5odG1sIG9mIHRoZSBhcHAuIHRoaXMgbWF5IGhvd2V2ZXIgYmUgeWFua2VkXG4gICAgIyBhd2F5IGlmIHdlIG11c3QgZG8gYXV0aC5cbiAgICBsb2FkQXBwV2luZG93KClcblxuICAgICNcbiAgICAjXG4gICAgIyBIYW5kbGUgdW5jYXVnaHQgZXhjZXB0aW9ucyBmcm9tIHRoZSBtYWluIHByb2Nlc3NcbiAgICBwcm9jZXNzLm9uICd1bmNhdWdodEV4Y2VwdGlvbicsIChtc2cpIC0+XG4gICAgICAgIGlwY3NlbmQgJ2V4cGNldGlvbmlubWFpbicsIG1zZ1xuICAgICAgICAjXG4gICAgICAgIGNvbnNvbGUubG9nIFwiRXJyb3Igb24gbWFpbiBwcm9jZXNzOlxcbiN7bXNnfVxcblwiICtcbiAgICAgICAgICAgIFwiLS0tIEVuZCBvZiBlcnJvciBtZXNzYWdlLiBNb3JlIGRldGFpbHM6XFxuXCIsIG1zZ1xuXG4gICAgI1xuICAgICNcbiAgICAjIEhhbmRsZSBjcmFzaGVzIG9uIHRoZSBtYWluIHdpbmRvdyBhbmQgc2hvdyBpbiBjb25zb2xlXG4gICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5vbiAnY3Jhc2hlZCcsIChtc2cpIC0+XG4gICAgICAgIGNvbnNvbGUubG9nICdDcmFzaCBldmVudCBvbiBtYWluIHdpbmRvdyEnLCBtc2dcbiAgICAgICAgaXBjLnNlbmQgJ2V4cGNldGlvbmlubWFpbicsIHtcbiAgICAgICAgICAgIG1zZzogJ0RldGVjdGVkIGEgY3Jhc2ggZXZlbnQgb24gdGhlIG1haW4gd2luZG93LidcbiAgICAgICAgICAgIGV2ZW50OiBtc2dcbiAgICAgICAgfVxuXG4gICAgIyBzaG9ydCBoYW5kXG4gICAgaXBjc2VuZCA9IChhcy4uLikgLT4gIG1haW5XaW5kb3cud2ViQ29udGVudHMuc2VuZCBhcy4uLlxuXG4gICAgIyBjYWxsYmFjayBmb3IgY3JlZGVudGlhbHNcbiAgICBjcmVkcyA9IC0+XG4gICAgICAgIGNvbnNvbGUubG9nIFwiYXNraW5nIGZvciBsb2dpbiBjcmVkZW50aWFsc1wiXG4gICAgICAgIGxvZ2luV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3cge1xuICAgICAgICAgICAgd2lkdGg6IDczMFxuICAgICAgICAgICAgaGVpZ2h0OiA1OTBcbiAgICAgICAgICAgIFwibWluLXdpZHRoXCI6IDYyMFxuICAgICAgICAgICAgXCJtaW4taGVpZ2h0XCI6IDQyMFxuICAgICAgICAgICAgaWNvbjogcGF0aC5qb2luIF9fZGlybmFtZSwgJ2ljb25zJywgJ2ljb24ucG5nJ1xuICAgICAgICAgICAgc2hvdzogdHJ1ZVxuICAgICAgICAgICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgICAgICAgICAgICBub2RlSW50ZWdyYXRpb246IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbG9naW5XaW5kb3cud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCkgaWYgZGVidWdcbiAgICAgICAgbG9naW5XaW5kb3cub24gJ2Nsb3NlZCcsIHF1aXRcblxuICAgICAgICBnbG9iYWwud2luZG93SGlkZVdoaWxlQ3JlZCA9IHRydWVcbiAgICAgICAgbWFpbldpbmRvdy5oaWRlKClcbiAgICAgICAgbG9naW5XaW5kb3cuZm9jdXMoKVxuICAgICAgICAjIHJlaW5zdGF0ZSBhcHAgd2luZG93IHdoZW4gbG9naW4gZmluaXNoZXNcbiAgICAgICAgcHJvbSA9IGxvZ2luKGxvZ2luV2luZG93KVxuICAgICAgICAudGhlbiAocnMpIC0+XG4gICAgICAgICAgICBnbG9iYWwuZm9yY2VDbG9zZSA9IHRydWVcbiAgICAgICAgICAgIGxvZ2luV2luZG93LnJlbW92ZUFsbExpc3RlbmVycyAnY2xvc2VkJ1xuICAgICAgICAgICAgbG9naW5XaW5kb3cuY2xvc2UoKVxuICAgICAgICAgICAgbWFpbldpbmRvdy5zaG93KClcbiAgICAgICAgICAgIHJzXG4gICAgICAgIGF1dGg6IC0+IHByb21cblxuICAgICMgc2VuZHMgdGhlIGluaXQgc3RydWN0dXJlcyB0byB0aGUgY2xpZW50XG4gICAgc2VuZEluaXQgPSAtPlxuICAgICAgICAjIHdlIGhhdmUgbm8gaW5pdCBkYXRhIGJlZm9yZSB0aGUgY2xpZW50IGhhcyBjb25uZWN0ZWQgZmlyc3RcbiAgICAgICAgIyB0aW1lLlxuICAgICAgICByZXR1cm4gZmFsc2UgdW5sZXNzIGNsaWVudD8uaW5pdD8uc2VsZl9lbnRpdHlcbiAgICAgICAgaXBjc2VuZCAnaW5pdCcsIGluaXQ6IGNsaWVudC5pbml0XG4gICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAjIGtlZXBzIHRyeWluZyB0byBjb25uZWMgdGhlIGhhbmd1cHNqcyBhbmQgY29tbXVuaWNhdGVzIHRob3NlXG4gICAgIyBhdHRlbXB0cyB0byB0aGUgY2xpZW50LlxuICAgIHJlY29ubmVjdCA9IC0+XG4gICAgICAgIGNvbnNvbGUubG9nICdyZWNvbm5lY3RpbmcnLCByZWNvbm5lY3RDb3VudFxuICAgICAgICBwcm94eWNoZWNrKCkudGhlbiAtPlxuICAgICAgICAgICAgY2xpZW50LmNvbm5lY3QoY3JlZHMpXG4gICAgICAgICAgICAudGhlbiAtPlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nICdjb25uZWN0ZWQnLCByZWNvbm5lY3RDb3VudFxuICAgICAgICAgICAgICAgICMgb24gZmlyc3QgY29ubmVjdCwgc2VuZCBpbml0LCBhZnRlciB0aGF0IG9ubHkgcmVzeW5jXG4gICAgICAgICAgICAgICAgaWYgcmVjb25uZWN0Q291bnQgPT0gMFxuICAgICAgICAgICAgICAgICAgICBsb2cuZGVidWcgJ1NlbmRpbmcgaW5pdC4uLidcbiAgICAgICAgICAgICAgICAgICAgc2VuZEluaXQoKVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgbG9nLmRlYnVnICdTeW5jUmVjZW50Li4uJ1xuICAgICAgICAgICAgICAgICAgICBzeW5jcmVjZW50KClcbiAgICAgICAgICAgICAgICByZWNvbm5lY3RDb3VudCsrXG4gICAgICAgICAgICAuY2F0Y2ggKGUpIC0+IGNvbnNvbGUubG9nICdlcnJvciBjb25uZWN0aW5nJywgZVxuXG4gICAgIyBjb3VudGVyIGZvciByZWNvbm5lY3RzXG4gICAgcmVjb25uZWN0Q291bnQgPSAwXG5cbiAgICAjIHdoZXRoZXIgdG8gY29ubmVjdCBpcyBkaWN0YXRlZCBieSB0aGUgY2xpZW50LlxuICAgIGlwYy5vbiAnaGFuZ3Vwc0Nvbm5lY3QnLCAtPlxuICAgICAgICBjb25zb2xlLmxvZyAnaGFuZ3Vwc2pzOjogY29ubmVjdGluZydcbiAgICAgICAgcmVjb25uZWN0KClcblxuICAgIGlwYy5vbiAnaGFuZ3Vwc0Rpc2Nvbm5lY3QnLCAtPlxuICAgICAgICBjb25zb2xlLmxvZyAnaGFuZ3Vwc2pzOjogZGlzY29ubmVjdCdcbiAgICAgICAgcmVjb25uZWN0Q291bnQgPSAwXG4gICAgICAgIGNsaWVudC5kaXNjb25uZWN0KClcblxuICAgICMgY2xpZW50IGRlYWxzIHdpdGggd2luZG93IHNpemluZ1xuICAgIG1haW5XaW5kb3cub24gJ3Jlc2l6ZScsIChldikgLT4gaXBjc2VuZCAncmVzaXplJywgbWFpbldpbmRvdy5nZXRTaXplKClcbiAgICBtYWluV2luZG93Lm9uICdtb3ZlJywgIChldikgLT4gaXBjc2VuZCAnbW92ZScsIG1haW5XaW5kb3cuZ2V0UG9zaXRpb24oKVxuXG4gICAgIyB3aGVuZXZlciBpdCBmYWlscywgd2UgdHJ5IGFnYWluXG4gICAgY2xpZW50Lm9uICdjb25uZWN0X2ZhaWxlZCcsIChlKSAtPlxuICAgICAgICBjb25zb2xlLmxvZyAnY29ubmVjdF9mYWlsZWQnLCBlXG4gICAgICAgIHdhaXQoMzAwMCkudGhlbiAtPiByZWNvbm5lY3QoKVxuXG4gICAgIyAgICBfICAgICAgXyAgICAgXyAgICAgICAgICAgICAgICAgICAgIF9fX19fIF9fX19fICAgX19fX19cbiAgICAjICAgfCB8ICAgIChfKSAgIHwgfCAgICAgICAgICAgICAgICAgICB8XyAgIF98ICBfXyBcXCAvIF9fX198XG4gICAgIyAgIHwgfCAgICAgXyBfX198IHxfIF9fXyBfIF9fICAgICAgICAgICB8IHwgfCB8X18pIHwgfFxuICAgICMgICB8IHwgICAgfCAvIF9ffCBfXy8gXyBcXCAnXyBcXCAgICAgICAgICB8IHwgfCAgX19fL3wgfFxuICAgICMgICB8IHxfX19ffCBcXF9fIFxcIHx8ICBfXy8gfCB8IHxfIF8gXyAgIF98IHxffCB8ICAgIHwgfF9fX19cbiAgICAjICAgfF9fX19fX3xffF9fXy9cXF9fXFxfX198X3wgfF8oX3xffF8pIHxfX19fX3xffCAgICAgXFxfX19fX3xcbiAgICAjXG4gICAgI1xuICAgICMgTGlzdGVuIG9uIGV2ZW50cyBmcm9tIG1haW4gd2luZG93XG5cbiAgICAjIHdoZW4gY2xpZW50IHJlcXVlc3RzIChyZS0paW5pdCBzaW5jZSB0aGUgZmlyc3QgaW5pdFxuICAgICMgb2JqZWN0IGlzIHNlbnQgYXMgc29vbiBhcyBwb3NzaWJsZSBvbiBzdGFydHVwXG4gICAgaXBjLm9uICdyZXFpbml0JywgLT4gc3luY3JlY2VudCgpIGlmIHNlbmRJbml0KClcblxuICAgIGlwYy5vbiAndG9nZ2xlZnVsbHNjcmVlbicsIC0+XG4gICAgICAgIG1haW5XaW5kb3cuc2V0RnVsbFNjcmVlbiBub3QgbWFpbldpbmRvdy5pc0Z1bGxTY3JlZW4oKVxuXG4gICAgIyBieWUgYnllXG4gICAgaXBjLm9uICdsb2dvdXQnLCBsb2dvdXRcblxuICAgIGlwYy5vbiAncXVpdCcsIHF1aXRcblxuICAgIGlwYy5vbiAnZXJyb3JJbldpbmRvdycsIChldiwgZXJyb3IsIHdpbk5hbWUgPSAnWWFrWWFrJykgLT5cbiAgICAgICAgbWFpbldpbmRvdy5zaG93KCkgdW5sZXNzIGdsb2JhbC5pc1JlYWR5VG9TaG93XG4gICAgICAgIGlwY3NlbmQgJ2V4cGNldGlvbmlubWFpbicsIGVycm9yXG4gICAgICAgIGNvbnNvbGUubG9nIFwiRXJyb3Igb24gI3t3aW5OYW1lfSB3aW5kb3c6XFxuXCIsIGVycm9yLCBcIlxcbi0tLSBFbmQgb2YgZXJyb3IgbWVzc2FnZSBpbiAje3dpbk5hbWV9IHdpbmRvdy5cIlxuXG5cbiAgICAjIHNlbmRjaGF0bWVzc2FnZSwgZXhlY3V0ZWQgc2VxdWVudGlhbGx5IGFuZFxuICAgICMgcmV0cmllZCBpZiBub3Qgc2VudCBzdWNjZXNzZnVsbHlcbiAgICBtZXNzYWdlUXVldWUgPSBRKClcbiAgICBpcGMub24gJ3NlbmRjaGF0bWVzc2FnZScsIChldiwgbXNnKSAtPlxuICAgICAgICB7Y29udl9pZCwgc2VncywgY2xpZW50X2dlbmVyYXRlZF9pZCwgaW1hZ2VfaWQsIG90ciwgbWVzc2FnZV9hY3Rpb25fdHlwZSwgZGVsaXZlcnlfbWVkaXVtfSA9IG1zZ1xuICAgICAgICBzZW5kRm9yU3VyZSA9IC0+IFEucHJvbWlzZSAocmVzb2x2ZSwgcmVqZWN0LCBub3RpZnkpIC0+XG4gICAgICAgICAgICBhdHRlbXB0ID0gLT5cbiAgICAgICAgICAgICAgICAjIGNvbnNvbGUubG9nICdzZW5kY2hhdG1lc3NhZ2UnLCBjbGllbnRfZ2VuZXJhdGVkX2lkXG4gICAgICAgICAgICAgICAgaWYgbm90IGRlbGl2ZXJ5X21lZGl1bT9cbiAgICAgICAgICAgICAgICAgICAgZGVsaXZlcnlfbWVkaXVtID0gbnVsbFxuICAgICAgICAgICAgICAgIGNsaWVudC5zZW5kY2hhdG1lc3NhZ2UoY29udl9pZCwgc2VncywgaW1hZ2VfaWQsIG90ciwgY2xpZW50X2dlbmVyYXRlZF9pZCwgZGVsaXZlcnlfbWVkaXVtLCBtZXNzYWdlX2FjdGlvbl90eXBlKS50aGVuIChyKSAtPlxuICAgICAgICAgICAgICAgICAgICAgICMgY29uc29sZS5sb2cgJ3NlbmRjaGF0bWVzc2FnZTpyZXN1bHQnLCByPy5jcmVhdGVkX2V2ZW50Py5zZWxmX2V2ZW50X3N0YXRlPy5jbGllbnRfZ2VuZXJhdGVkX2lkXG4gICAgICAgICAgICAgICAgICAgIGlwY3NlbmQgJ3NlbmRjaGF0bWVzc2FnZTpyZXN1bHQnLCByXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgYXR0ZW1wdCgpXG4gICAgICAgIG1lc3NhZ2VRdWV1ZSA9IG1lc3NhZ2VRdWV1ZS50aGVuIC0+XG4gICAgICAgICAgICBzZW5kRm9yU3VyZSgpXG5cbiAgICAjIGdldCBsb2NhbGUgZm9yIHRyYW5zbGF0aW9uc1xuICAgIGlwYy5vbiAnc2V0aTE4bicsIChldiwgb3B0cywgbGFuZ3VhZ2UpLT5cbiAgICAgICAgaWYgb3B0cz9cbiAgICAgICAgICAgIGdsb2JhbC5pMThuT3B0cy5vcHRzID0gb3B0c1xuICAgICAgICBpZiBsYW5ndWFnZT9cbiAgICAgICAgICAgIGdsb2JhbC5pMThuT3B0cy5sb2NhbGUgPSBsYW5ndWFnZVxuXG4gICAgaXBjLm9uICdhcHBmb2N1cycsIC0+XG4gICAgICAgIGFwcC5mb2N1cygpXG4gICAgICAgIGlmIG1haW5XaW5kb3cuaXNWaXNpYmxlKClcbiAgICAgICAgICAgIG1haW5XaW5kb3cuZm9jdXMoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBtYWluV2luZG93LnNob3coKVxuXG4gICAgaXBjLmhhbmRsZSAndHJheS1kZXN0cm95JywgKGV2KSAtPlxuICAgICAgICBpZiB0cmF5XG4gICAgICAgICAgICB0cmF5LmRlc3Ryb3koKVxuICAgICAgICAgICAgdHJheSA9IG51bGwgaWYgdHJheS5pc0Rlc3Ryb3llZCgpXG5cbiAgICBpcGMuaGFuZGxlICd0cmF5JywgKGV2LCBtZW51LCBpY29ucGF0aCwgdG9vbFRpcCkgLT5cbiAgICAgICAgaWYgdHJheSAjIGNyZWF0ZSB0cmF5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICB0cmF5LnNldEltYWdlIGljb25wYXRoIHVubGVzcyB0cmF5LmN1cnJlbnRJbWFnZSA9PSBpY29ucGF0aFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdHJheSA9IG5ldyBUcmF5IGljb25wYXRoXG5cbiAgICAgICAgdHJheS5jdXJyZW50SW1hZ2UgPSBpY29ucGF0aFxuXG4gICAgICAgIHRyYXkuc2V0VG9vbFRpcCB0b29sVGlwXG4gICAgICAgIHRyYXkub24gJ2NsaWNrJywgKGV2KSAtPiBpcGNzZW5kICdtZW51YWN0aW9uJywgJ3RvZ2dsZXdpbmRvdydcblxuICAgICAgICBpZiBtZW51XG4gICAgICAgICAgICAjIGJ1aWxkIGZ1bmN0aW9ucyB0aGF0IGNhbm5vdCBiZSBzZW50IHZpYSBpcGNcbiAgICAgICAgICAgIGNvbnRleHRNZW51ID0gbWVudS5tYXAgKGVsKSAtPlxuICAgICAgICAgICAgICAgIGVsLmNsaWNrID0gKHIpLT5cbiAgICAgICAgICAgICAgICAgICAgaXBjc2VuZCAnbWVudWFjdGlvbicsIGVsLmNsaWNrX2FjdGlvblxuICAgICAgICAgICAgICAgICMgZGVsZXRlIGVsLmNsaWNrX2FjdGlvblxuICAgICAgICAgICAgICAgIGVsXG4gICAgICAgICAgICB0cmF5LnNldENvbnRleHRNZW51IE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUgY29udGV4dE1lbnVcblxuICAgICNcbiAgICAjXG4gICAgIyBNZXRob2RzIGJlbG93IHVzZSBzZXFyZXEgdGhhdCByZXR1cm5zIGEgcHJvbWlzZSBhbmQgYWxsb3dzIGZvciByZXRyeVxuICAgICNcblxuICAgICMgc2VuZGNoYXRtZXNzYWdlLCBleGVjdXRlZCBzZXF1ZW50aWFsbHkgYW5kXG4gICAgIyByZXRyaWVkIGlmIG5vdCBzZW50IHN1Y2Nlc3NmdWxseVxuICAgIGlwYy5vbiAncXVlcnlwcmVzZW5jZScsIHNlcXJlcSAoZXYsIGlkKSAtPlxuICAgICAgICBjbGllbnQucXVlcnlwcmVzZW5jZShpZCkudGhlbiAocikgLT5cbiAgICAgICAgICAgIGlwY3NlbmQgJ3F1ZXJ5cHJlc2VuY2U6cmVzdWx0Jywgci5wcmVzZW5jZV9yZXN1bHRbMF1cbiAgICAgICAgLCBmYWxzZSwgLT4gMVxuXG4gICAgaXBjLm9uICdpbml0cHJlc2VuY2UnLCAoZXYsIGwpIC0+XG4gICAgICAgIGZvciBwLCBpIGluIGwgd2hlbiBwICE9IG51bGxcbiAgICAgICAgICAgIGNsaWVudC5xdWVyeXByZXNlbmNlKHAuaWQpLnRoZW4gKHIpIC0+XG4gICAgICAgICAgICAgICAgaXBjc2VuZCAncXVlcnlwcmVzZW5jZTpyZXN1bHQnLCByLnByZXNlbmNlX3Jlc3VsdFswXVxuICAgICAgICAgICAgLCBmYWxzZSwgLT4gMVxuXG4gICAgIyBubyByZXRyeSwgb25seSBvbmUgb3V0c3RhbmRpbmcgY2FsbFxuICAgIGlwYy5vbiAnc2V0cHJlc2VuY2UnLCBzZXFyZXEgKGV2LCBzdGF0dXM9dHJ1ZSkgLT5cbiAgICAgICAgY2xpZW50LnNldHByZXNlbmNlKHN0YXR1cylcbiAgICAsIGZhbHNlLCAtPiAxXG5cbiAgICAjIG5vIHJldHJ5LCBvbmx5IG9uZSBvdXRzdGFuZGluZyBjYWxsXG4gICAgaXBjLm9uICdzZXRhY3RpdmVjbGllbnQnLCBzZXFyZXEgKGV2LCBhY3RpdmUsIHNlY3MpIC0+XG4gICAgICAgIGNsaWVudC5zZXRhY3RpdmVjbGllbnQgYWN0aXZlLCBzZWNzXG4gICAgLCBmYWxzZSwgLT4gMVxuXG4gICAgIyB3YXRlcm1hcmtpbmcgaXMgb25seSBpbnRlcmVzdGluZyBmb3IgdGhlIGxhc3Qgb2YgZWFjaCBjb252X2lkXG4gICAgIyByZXRyeSBzZW5kIGFuZCBkZWR1cGUgZm9yIGVhY2ggY29udl9pZFxuICAgIGlwYy5vbiAndXBkYXRld2F0ZXJtYXJrJywgc2VxcmVxIChldiwgY29udl9pZCwgdGltZSkgLT5cbiAgICAgICAgY2xpZW50LnVwZGF0ZXdhdGVybWFyayBjb252X2lkLCB0aW1lXG4gICAgLCB0cnVlLCAoZXYsIGNvbnZfaWQsIHRpbWUpIC0+IGNvbnZfaWRcblxuICAgICMgZ2V0ZW50aXR5IGlzIG5vdCBzdXBlciBpbXBvcnRhbnQsIHRoZSBjbGllbnQgd2lsbCB0cnkgYWdhaW4gd2hlbiBlbmNvdW50ZXJpbmdcbiAgICAjIGVudGl0aWVzIHdpdGhvdXQgcGhvdG9fdXJsLiBzbyBubyByZXRyeSwgYnV0IGRvIGV4ZWN1dGUgYWxsIHN1Y2ggcmVxc1xuICAgICMgaXBjLm9uICdnZXRlbnRpdHknLCBzZXFyZXEgKGV2LCBpZHMpIC0+XG4gICAgIyAgICAgY2xpZW50LmdldGVudGl0eWJ5aWQoaWRzKS50aGVuIChyKSAtPiBpcGNzZW5kICdnZXRlbnRpdHk6cmVzdWx0JywgclxuICAgICMgLCBmYWxzZVxuXG4gICAgIyB3ZSB3YW50IHRvIHVwbG9hZC4gaW4gdGhlIG9yZGVyIHNwZWNpZmllZCwgd2l0aCByZXRyeVxuICAgIGlwYy5vbiAndXBsb2FkaW1hZ2UnLCBzZXFyZXEgKGV2LCBzcGVjKSAtPlxuICAgICAgICB7cGF0aCwgY29udl9pZCwgY2xpZW50X2dlbmVyYXRlZF9pZH0gPSBzcGVjXG4gICAgICAgIGlwY3NlbmQgJ3VwbG9hZGluZ2ltYWdlJywge2NvbnZfaWQsIGNsaWVudF9nZW5lcmF0ZWRfaWQsIHBhdGh9XG4gICAgICAgIGNsaWVudC51cGxvYWRpbWFnZShwYXRoKS50aGVuIChpbWFnZV9pZCkgLT5cblxuICAgICAgICAgICAgZGVsaXZlcnlfbWVkaXVtID0gbnVsbFxuXG4gICAgICAgICAgICBjbGllbnQuc2VuZGNoYXRtZXNzYWdlIGNvbnZfaWQsIG51bGwsIGltYWdlX2lkLCBudWxsLCBjbGllbnRfZ2VuZXJhdGVkX2lkLCBkZWxpdmVyeV9tZWRpdW1cbiAgICAsIHRydWVcblxuICAgICMgd2Ugd2FudCB0byB1cGxvYWQuIGluIHRoZSBvcmRlciBzcGVjaWZpZWQsIHdpdGggcmV0cnlcbiAgICBpcGMub24gJ3VwbG9hZGNsaXBib2FyZGltYWdlJywgc2VxcmVxIChldiwgc3BlYykgLT5cbiAgICAgICAge3BuZ0RhdGEsIGNvbnZfaWQsIGNsaWVudF9nZW5lcmF0ZWRfaWR9ID0gc3BlY1xuICAgICAgICBmaWxlID0gdG1wLmZpbGVTeW5jIHBvc3RmaXg6IFwiLnBuZ1wiXG4gICAgICAgIGlwY3NlbmQgJ3VwbG9hZGluZ2ltYWdlJywge2NvbnZfaWQsIGNsaWVudF9nZW5lcmF0ZWRfaWQsIHBhdGg6ZmlsZS5uYW1lfVxuICAgICAgICBRLlByb21pc2UgKHJzLCByaikgLT5cbiAgICAgICAgICAgIGZzLndyaXRlRmlsZSBmaWxlLm5hbWUsIHBuZ0RhdGEsIHBsdWcocnMsIHJqKVxuICAgICAgICAudGhlbiAtPlxuICAgICAgICAgICAgY2xpZW50LnVwbG9hZGltYWdlKGZpbGUubmFtZSlcbiAgICAgICAgLnRoZW4gKGltYWdlX2lkKSAtPlxuICAgICAgICAgICAgZGVsaXZlcnlfbWVkaXVtID0gbnVsbFxuICAgICAgICAgICAgY2xpZW50LnNlbmRjaGF0bWVzc2FnZSBjb252X2lkLCBudWxsLCBpbWFnZV9pZCwgbnVsbCwgY2xpZW50X2dlbmVyYXRlZF9pZCwgZGVsaXZlcnlfbWVkaXVtXG4gICAgICAgIC50aGVuIC0+XG4gICAgICAgICAgICBmaWxlLnJlbW92ZUNhbGxiYWNrKClcbiAgICAsIHRydWVcblxuICAgICMgcmV0cnkgb25seSBsYXN0IHBlciBjb252X2lkXG4gICAgaXBjLm9uICdzZXRjb252ZXJzYXRpb25ub3RpZmljYXRpb25sZXZlbCcsIHNlcXJlcSAoZXYsIGNvbnZfaWQsIGxldmVsKSAtPlxuICAgICAgICBjbGllbnQuc2V0Y29udmVyc2F0aW9ubm90aWZpY2F0aW9ubGV2ZWwgY29udl9pZCwgbGV2ZWxcbiAgICAsIHRydWUsIChldiwgY29udl9pZCwgbGV2ZWwpIC0+IGNvbnZfaWRcblxuICAgICMgcmV0cnlcbiAgICBpcGMub24gJ2RlbGV0ZWNvbnZlcnNhdGlvbicsIHNlcXJlcSAoZXYsIGNvbnZfaWQpIC0+XG4gICAgICAgIGNvbnNvbGUubG9nICdkZWxldGluZ2NvbnZlcnNhdGlvbicsIGNvbnZfaWQgaWYgZGVidWdcbiAgICAgICAgY2xpZW50LmRlbGV0ZWNvbnZlcnNhdGlvbiBjb252X2lkXG4gICAgICAgIC50aGVuIChyKSAtPlxuICAgICAgICAgICAgY29uc29sZS5sb2cgJ0RFQlVHOiBkZWxldGVjb252c2Vyc2F0aW9uIHJlc3BvbnNlOiAnLCByIGlmIGRlYnVnXG4gICAgICAgICAgICBpZiByLnJlc3BvbnNlX2hlYWRlci5zdGF0dXMgIT0gJ09LJ1xuICAgICAgICAgICAgICAgIGlwY3NlbmQgJ21lc3NhZ2UnLCBpMThuLl9fKCdjb252ZXJzYXRpb24uZGVsZXRlX2Vycm9yOkVycm9yIG9jY3VyZWQgd2hlbiBkZWxldGluZyBjb252ZXJzYXRpb24nKVxuICAgICwgdHJ1ZVxuXG4gICAgaXBjLm9uICdyZW1vdmV1c2VyJywgc2VxcmVxIChldiwgY29udl9pZCkgLT5cbiAgICAgICAgY2xpZW50LnJlbW92ZXVzZXIgY29udl9pZFxuICAgICwgdHJ1ZVxuXG4gICAgIyBubyByZXRyaWVzLCBkZWR1cGUgb24gY29udl9pZFxuICAgIGlwYy5vbiAnc2V0Zm9jdXMnLCBzZXFyZXEgKGV2LCBjb252X2lkKSAtPlxuICAgICAgICBjbGllbnQuc2V0Zm9jdXMgY29udl9pZFxuICAgICAgICB1cGRhdGVDb252ZXJzYXRpb24oY29udl9pZClcbiAgICAsIGZhbHNlLCAoZXYsIGNvbnZfaWQpIC0+IGNvbnZfaWRcblxuICAgICMgdXBkYXRlIGNvbnZlcnNhdGlvbiB3aXRoIG1ldGFkYXRhIChmb3IgdW5yZWFkIG1lc3NhZ2VzKVxuICAgIHVwZGF0ZUNvbnZlcnNhdGlvbiA9IChjb252X2lkKSAtPlxuICAgICAgICBjbGllbnQuZ2V0Y29udmVyc2F0aW9uIGNvbnZfaWQsIG5ldyBEYXRlKCksIDEsIHRydWVcbiAgICAgICAgLnRoZW4gKHIpIC0+XG4gICAgICAgICAgICBpcGNzZW5kICdnZXRjb252ZXJzYXRpb25tZXRhZGF0YTpyZXNwb25zZScsIHJcblxuICAgIGlwYy5vbiAndXBkYXRlQ29udmVyc2F0aW9uJywgc2VxcmVxIChldiwgY29udl9pZCkgLT5cbiAgICAgICAgdXBkYXRlQ29udmVyc2F0aW9uIGNvbnZfaWRcbiAgICAsIGZhbHNlLCAoZXYsIGNvbnZfaWQpIC0+IGNvbnZfaWRcblxuICAgICMgbm8gcmV0cmllcywgZGVkdXBlIG9uIGNvbnZfaWRcbiAgICBpcGMub24gJ3NldHR5cGluZycsIHNlcXJlcSAoZXYsIGNvbnZfaWQsIHYpIC0+XG4gICAgICAgIGNsaWVudC5zZXR0eXBpbmcgY29udl9pZCwgdlxuICAgICwgZmFsc2UsIChldiwgY29udl9pZCkgLT4gY29udl9pZFxuXG4gICAgaXBjLm9uICd1cGRhdGViYWRnZScsIChldiwgdmFsdWUpIC0+XG4gICAgICAgIGFwcC5kb2NrLnNldEJhZGdlKHZhbHVlKSBpZiBhcHAuZG9ja1xuXG4gICAgaXBjLm9uICdzZWFyY2hlbnRpdGllcycsIChldiwgcXVlcnksIG1heF9yZXN1bHRzKSAtPlxuICAgICAgICBwcm9taXNlID0gY2xpZW50LnNlYXJjaGVudGl0aWVzIHF1ZXJ5LCBtYXhfcmVzdWx0c1xuICAgICAgICBwcm9taXNlLnRoZW4gKHJlcykgLT5cbiAgICAgICAgICAgIGlwY3NlbmQgJ3NlYXJjaGVudGl0aWVzOnJlc3VsdCcsIHJlc1xuICAgIGlwYy5vbiAnY3JlYXRlY29udmVyc2F0aW9uJywgKGV2LCBpZHMsIG5hbWUsIGZvcmNlZ3JvdXA9ZmFsc2UpIC0+XG4gICAgICAgIHByb21pc2UgPSBjbGllbnQuY3JlYXRlY29udmVyc2F0aW9uIGlkcywgZm9yY2Vncm91cFxuICAgICAgICBjb252ID0gbnVsbFxuICAgICAgICBwcm9taXNlLnRoZW4gKHJlcykgLT5cbiAgICAgICAgICAgIGNvbnYgPSByZXMuY29udmVyc2F0aW9uXG4gICAgICAgICAgICBjb252X2lkID0gY29udi5pZC5pZFxuICAgICAgICAgICAgY2xpZW50LnJlbmFtZWNvbnZlcnNhdGlvbiBjb252X2lkLCBuYW1lIGlmIG5hbWVcbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbiAocmVzKSAtPlxuICAgICAgICAgICAgaXBjc2VuZCAnY3JlYXRlY29udmVyc2F0aW9uOnJlc3VsdCcsIGNvbnYsIG5hbWVcbiAgICBpcGMub24gJ2FkZHVzZXInLCAoZXYsIGNvbnZfaWQsIHRvYWRkKSAtPlxuICAgICAgICBjbGllbnQuYWRkdXNlciBjb252X2lkLCB0b2FkZCAjwqB3aWxsIGF1dG9tYXRpY2FsbHkgdHJpZ2dlciBtZW1iZXJzaGlwX2NoYW5nZVxuICAgIGlwYy5vbiAncmVuYW1lY29udmVyc2F0aW9uJywgKGV2LCBjb252X2lkLCBuZXduYW1lKSAtPlxuICAgICAgICBjbGllbnQucmVuYW1lY29udmVyc2F0aW9uIGNvbnZfaWQsIG5ld25hbWUgIyB3aWxsIHRyaWdnZXIgY29udmVyc2F0aW9uX3JlbmFtZVxuXG4gICAgIyBubyByZXRyaWVzLCBqdXN0IGRlZHVwZSBvbiB0aGUgaWRzXG4gICAgaXBjLm9uICdnZXRlbnRpdHknLCBzZXFyZXEgKGV2LCBpZHMsIGRhdGEpIC0+XG4gICAgICAgIGNsaWVudC5nZXRlbnRpdHlieWlkKGlkcykudGhlbiAocikgLT5cbiAgICAgICAgICAgIGlwY3NlbmQgJ2dldGVudGl0eTpyZXN1bHQnLCByLCBkYXRhXG4gICAgLCBmYWxzZSwgKGV2LCBpZHMpIC0+IGlkcy5zb3J0KCkuam9pbignLCcpXG5cbiAgICAjIG5vIHJldHJ5LCBqdXN0IG9uZSBzaW5nbGUgcmVxdWVzdFxuICAgIGlwYy5vbiAnc3luY2FsbG5ld2V2ZW50cycsIHNlcXJlcSAoZXYsIHRpbWUpIC0+XG4gICAgICAgIGNvbnNvbGUubG9nICdzeW5jYWxsbmV3ZXZlbnRzOiBBc2tpbmcgaGFuZ291dHMgdG8gc3luYyBuZXcgZXZlbnRzJ1xuICAgICAgICBjbGllbnQuc3luY2FsbG5ld2V2ZW50cyh0aW1lKS50aGVuIChyKSAtPlxuICAgICAgICAgICAgaXBjc2VuZCAnc3luY2FsbG5ld2V2ZW50czpyZXNwb25zZScsIHJcbiAgICAsIGZhbHNlLCAoZXYsIHRpbWUpIC0+IDFcblxuICAgICMgbm8gcmV0cnksIGp1c3Qgb25lIHNpbmdsZSByZXF1ZXN0XG4gICAgaXBjLm9uICdzeW5jcmVjZW50Y29udmVyc2F0aW9ucycsIHN5bmNyZWNlbnQgPSBzZXFyZXEgKGV2KSAtPlxuICAgICAgICBjb25zb2xlLmxvZyAnc3luY3JlY2VudGNvbnZlcnNhdGlvbnM6IEFza2luZyBoYW5nb3V0cyB0byBzeW5jIHJlY2VudCBjb252ZXJzYXRpb25zJ1xuICAgICAgICBjbGllbnQuc3luY3JlY2VudGNvbnZlcnNhdGlvbnMoKS50aGVuIChyKSAtPlxuICAgICAgICAgICAgaXBjc2VuZCAnc3luY3JlY2VudGNvbnZlcnNhdGlvbnM6cmVzcG9uc2UnLCByXG4gICAgICAgICAgICAjIHRoaXMgaXMgYmVjYXVzZSB3ZSB1c2Ugc3luY3JlY2VudCBvbiByZXFpbml0IChkZXYtbW9kZVxuICAgICAgICAgICAgIyByZWZyZXNoKS4gaWYgd2Ugc3VjY2VlZGVkIGdldHRpbmcgYSByZXNwb25zZSwgd2UgY2FsbCBpdFxuICAgICAgICAgICAgIyBjb25uZWN0ZWQuXG4gICAgICAgICAgICBpcGNzZW5kICdjb25uZWN0ZWQnXG4gICAgLCBmYWxzZSwgKGV2LCB0aW1lKSAtPiAxXG5cbiAgICAjIHJldHJ5LCBvbmUgc2luZ2xlIHBlciBjb252X2lkXG4gICAgaXBjLm9uICdnZXRjb252ZXJzYXRpb24nLCBzZXFyZXEgKGV2LCBjb252X2lkLCB0aW1lc3RhbXAsIG1heCkgLT5cbiAgICAgICAgY2xpZW50LmdldGNvbnZlcnNhdGlvbihjb252X2lkLCB0aW1lc3RhbXAsIG1heCwgdHJ1ZSkudGhlbiAocikgLT5cbiAgICAgICAgICAgIGlwY3NlbmQgJ2dldGNvbnZlcnNhdGlvbjpyZXNwb25zZScsIHJcbiAgICAsIGZhbHNlLCAoZXYsIGNvbnZfaWQsIHRpbWVzdGFtcCwgbWF4KSAtPiBjb252X2lkXG5cbiAgICBpcGMub24gJ2N0cmwrd19fcHJlc3NlZCcsIC0+XG4gICAgICAgIG1haW5XaW5kb3cuaGlkZSgpXG5cbiAgICAjICAgIF8gICAgICBfICAgICBfICAgICAgICAgICAgICAgICAgICAgXyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX1xuICAgICMgICB8IHwgICAgKF8pICAgfCB8ICAgICAgICAgICAgICAgICAgIHwgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgfFxuICAgICMgICB8IHwgICAgIF8gX19ffCB8XyBfX18gXyBfXyAgICAgICAgIHwgfF9fICAgX18gXyBfIF9fICAgX18gXyAgX19fICBfICAgX3wgfF8gX19fXG4gICAgIyAgIHwgfCAgICB8IC8gX198IF9fLyBfIFxcICdfIFxcICAgICAgICB8ICdfIFxcIC8gX2AgfCAnXyBcXCAvIF9gIHwvIF8gXFx8IHwgfCB8IF9fLyBfX3xcbiAgICAjICAgfCB8X19fX3wgXFxfXyBcXCB8fCAgX18vIHwgfCB8XyBfIF8gIHwgfCB8IHwgKF98IHwgfCB8IHwgKF98IHwgKF8pIHwgfF98IHwgfF9cXF9fIFxcXG4gICAgIyAgIHxfX19fX198X3xfX18vXFxfX1xcX19ffF98IHxfKF98X3xfKSB8X3wgfF98XFxfXyxffF98IHxffFxcX18sIHxcXF9fXy8gXFxfXyxffFxcX198X19fL1xuICAgICMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX18vIHxcbiAgICAjICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfF9fXy9cbiAgICAjIExpc3RlbiBvbiBldmVudHMgZnJvbSBoYW5ndXBzanMgY2xpZW50LlxuXG4gICAgIyBwcm9wYWdhdGUgSGFuZ291dCBjbGllbnQgZXZlbnRzIHRvIHRoZSByZW5kZXJlclxuICAgIHJlcXVpcmUoJy4vdWkvZXZlbnRzJykuZm9yRWFjaCAobikgLT5cbiAgICAgICAgY2xpZW50Lm9uIG4sIChlKSAtPlxuICAgICAgICAgICAgbG9nLmRlYnVnICdERUJVRzogUmVjZWl2ZWQgZXZlbnQnLCBuXG4gICAgICAgICAgICAjIGNsaWVudF9jb252ZXJzYXRpb24gY29tZXMgd2l0aG91dCBtZXRhZGF0YSBieSBkZWZhdWx0LlxuICAgICAgICAgICAgIyAgV2UgbmVlZCBpdCBmb3IgdW5yZWFkIGNvdW50XG4gICAgICAgICAgICB1cGRhdGVDb252ZXJzYXRpb24gZS5jb252ZXJzYXRpb25faWQuaWQgaWYgKG4gPT0gJ2NsaWVudF9jb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgaXBjc2VuZCBuLCBlXG5cbiAgICAjIEVtaXR0ZWQgd2hlbiB0aGUgd2luZG93IGlzIGFib3V0IHRvIGNsb3NlLlxuICAgICMgSGlkZXMgdGhlIHdpbmRvdyBpZiB3ZSdyZSBub3QgZm9yY2UgY2xvc2luZy5cbiAgICAjICBJTVBPUlRBTlQ6IG1vdmVkIHRvIGFwcC5jb2ZmZWVcbiJdfQ==
