(function() {
  var Client, STATES, autoLauncher, exp, later, merge, ref, ref1, ref10, ref11, ref12, ref13, ref14, ref15, ref16, ref17, ref18, ref19, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, throttle, tryparse;

  Client = require('hangupsjs');

  merge = function(t, ...os) {
    var j, k, len, o, v;
    for (j = 0, len = os.length; j < len; j++) {
      o = os[j];
      for (k in o) {
        v = o[k];
        if (v !== null && v !== (void 0)) {
          t[k] = v;
        }
      }
    }
    return t;
  };

  ({throttle, later, tryparse, autoLauncher} = require('../util'));

  STATES = {
    STATE_STARTUP: 'startup',
    STATE_NORMAL: 'normal',
    STATE_ADD_CONVERSATION: 'add_conversation',
    STATE_ABOUT: 'about'
  };

  module.exports = exp = {
    state: null,
    attop: false, // tells whether message list is scrolled to top
    atbottom: true, // tells whether message list is scrolled to bottom
    selectedConv: localStorage.selectedConv,
    lastActivity: null,
    leftSize: (ref = tryparse(localStorage.leftSize)) != null ? ref : 240,
    size: tryparse((ref1 = localStorage.size) != null ? ref1 : "[940, 600]"),
    pos: tryparse((ref2 = localStorage.pos) != null ? ref2 : "[100, 100]"),
    showConvMin: (ref3 = tryparse(localStorage.showConvMin)) != null ? ref3 : false,
    showConvThumbs: (ref4 = tryparse(localStorage.showConvThumbs)) != null ? ref4 : true,
    showAnimatedThumbs: (ref5 = tryparse(localStorage.showAnimatedThumbs)) != null ? ref5 : true,
    showConvTime: (ref6 = tryparse(localStorage.showConvTime)) != null ? ref6 : true,
    showConvLast: (ref7 = tryparse(localStorage.showConvLast)) != null ? ref7 : true,
    showPopUpNotifications: (ref8 = tryparse(localStorage.showPopUpNotifications)) != null ? ref8 : true,
    showMessageInNotification: (ref9 = tryparse(localStorage.showMessageInNotification)) != null ? ref9 : true,
    showUsernameInNotification: (ref10 = tryparse(localStorage.showUsernameInNotification)) != null ? ref10 : true,
    convertEmoji: (ref11 = tryparse(localStorage.convertEmoji)) != null ? ref11 : true,
    suggestEmoji: (ref12 = tryparse(localStorage.suggestEmoji)) != null ? ref12 : true,
    showImagePreview: (ref13 = tryparse(localStorage.showImagePreview)) != null ? ref13 : true,
    colorScheme: localStorage.colorScheme || 'default',
    fontSize: localStorage.fontSize || 'medium',
    zoom: tryparse((ref14 = localStorage.zoom) != null ? ref14 : "1.0"),
    loggedin: false,
    escapeClearsInput: tryparse(localStorage.escapeClearsInput) || false,
    showtray: tryparse(localStorage.showtray) || false,
    hidedockicon: tryparse(localStorage.hidedockicon) || false,
    colorblind: tryparse(localStorage.colorblind) || false,
    startminimizedtotray: tryparse(localStorage.startminimizedtotray) || false,
    closetotray: tryparse(localStorage.closetotray) || false,
    showDockOnce: true,
    showIconNotification: (ref15 = tryparse(localStorage.showIconNotification)) != null ? ref15 : true,
    muteSoundNotification: (ref16 = tryparse(localStorage.muteSoundNotification)) != null ? ref16 : false,
    forceCustomSound: (ref17 = tryparse(localStorage.forceCustomSound)) != null ? ref17 : false,
    language: (ref18 = localStorage.language) != null ? ref18 : 'en',
    useSystemDateFormat: localStorage.useSystemDateFormat === "true",
    spellcheckLanguage: (ref19 = localStorage.spellcheckLanguage) != null ? ref19 : 'none',
    // non persistent!
    messageMemory: {}, // stores input when swithching conversations
    cachedInitialsCode: {}, // code used for colored initials, if no avatar
    // contacts are loaded
    loadedContacts: false,
    openOnSystemStartup: false,
    setUseSystemDateFormat: function(val) {
      this.useSystemDateFormat = val;
      localStorage.useSystemDateFormat = val;
      return updated('language');
    },
    setContacts: function(state) {
      if (state === this.loadedContacts) {
        return;
      }
      this.loadedContacts = state;
      return updated('viewstate');
    },
    setState: function(state) {
      if (this.state === state) {
        return;
      }
      this.state = state;
      if (state === STATES.STATE_STARTUP) {
        // set a first active timestamp to avoid requesting
        // syncallnewevents on startup
        require('./connection').setLastActive(Date.now(), true);
      }
      return updated('viewstate');
    },
    setSpellCheckLanguage: function(language, mainWindow) {
      if (this.language === language) {
        return;
      }
      if (language === 'none') {
        mainWindow.webContents.session.setSpellCheckerLanguages([]);
      } else {
        mainWindow.webContents.session.setSpellCheckerLanguages([language]);
      }
      this.spellcheckLanguage = localStorage.spellcheckLanguage = language;
      return updated('viewstate');
    },
    setLanguage: function(language) {
      if (this.language === language) {
        return;
      }
      i18n.locale = language;
      i18n.setLocale(language);
      this.language = localStorage.language = language;
      return updated('language');
    },
    switchInput: function(next_conversation_id) {
      var el;
      // if conversation is changing, save input
      el = document.getElementById('message-input');
      if (el == null) {
        console.log('Warning: could not retrieve message input to store.');
        return;
      }
      // save current input
      this.messageMemory[this.selectedConv] = el.value;
      // either reset or fetch previous input of the new conv
      if (this.messageMemory[next_conversation_id] != null) {
        el.value = this.messageMemory[next_conversation_id];
        // once old conversation is retrieved memory is wiped
        return this.messageMemory[next_conversation_id] = "";
      } else {
        return el.value = '';
      }
    },
    
    setSelectedConv: function(c) {
      var conv, conv_id, ref20, ref21, ref22, ref23, ref24, ref25;
      conv = require('./conv'); // circular
      conv_id = (ref20 = (ref21 = c != null ? (ref22 = c.conversation_id) != null ? ref22.id : void 0 : void 0) != null ? ref21 : c != null ? c.id : void 0) != null ? ref20 : c;
      if (!conv_id) {
        conv_id = (ref23 = conv.list()) != null ? (ref24 = ref23[0]) != null ? (ref25 = ref24.conversation_id) != null ? ref25.id : void 0 : void 0 : void 0;
      }
      if (this.selectedConv === conv_id) {
        return;
      }
      this.switchInput(conv_id);
      this.selectedConv = localStorage.selectedConv = conv_id;
      this.setLastKeyDown(0);
      updated('viewstate');
      return updated('switchConv');
    },
    selectNextConv: function(offset = 1) {
      var c, candidate, conv, i, id, index, j, len, list, results;
      conv = require('./conv');
      id = this.selectedConv;
      c = conv[id];
      list = (function() {
        var j, len, ref20, results;
        ref20 = conv.list();
        results = [];
        for (j = 0, len = ref20.length; j < len; j++) {
          i = ref20[j];
          if (!conv.isPureHangout(i)) {
            results.push(i);
          }
        }
        return results;
      })();
      results = [];
      for (index = j = 0, len = list.length; j < len; index = ++j) {
        c = list[index];
        if (id === c.conversation_id.id) {
          candidate = index + offset;
          if (list[candidate]) {
            results.push(this.setSelectedConv(list[candidate]));
          } else {
            results.push(void 0);
          }
        } else {
          results.push(void 0);
        }
      }
      return results;
    },
    selectConvIndex: function(index = 0) {
      var conv, i, list;
      conv = require('./conv');
      list = (function() {
        var j, len, ref20, results;
        ref20 = conv.list();
        results = [];
        for (j = 0, len = ref20.length; j < len; j++) {
          i = ref20[j];
          if (!conv.isPureHangout(i)) {
            results.push(i);
          }
        }
        return results;
      })();
      return this.setSelectedConv(list[index]);
    },
    updateAtTop: function(attop) {
      if (this.attop === attop) {
        return;
      }
      this.attop = attop;
      return updated('viewstate');
    },
    updateAtBottom: function(atbottom) {
      if (this.atbottom === atbottom) {
        return;
      }
      this.atbottom = atbottom;
      return this.updateActivity(Date.now());
    },
    updateActivity: function(time) {
      var c, conv, ur;
      conv = require('./conv'); // circular
      this.lastActivity = time;
      later(function() {
        return action('lastActivity');
      });
      if (!(document.hasFocus() && this.atbottom && this.state === STATES.STATE_NORMAL)) {
        return;
      }
      c = conv[this.selectedConv];
      if (!c) {
        return;
      }
      ur = conv.unread(c);
      if (ur > 0) {
        return later(function() {
          return action('updatewatermark');
        });
      }
    },
    setSize: function(size) {
      localStorage.size = JSON.stringify(size);
      return this.size = size;
    },
    // updated 'viewstate'
    setPosition: function(pos) {
      localStorage.pos = JSON.stringify(pos);
      return this.pos = pos;
    },
    // updated 'viewstate'
    setLeftSize: function(size) {
      if (this.leftSize === size || size < 180) {
        return;
      }
      this.leftSize = localStorage.leftSize = size;
      return updated('viewstate');
    },
    setZoom: function(zoom) {
      this.zoom = localStorage.zoom = document.body.style.zoom = zoom;
      return document.body.style.setProperty('--zoom', zoom);
    },
    setLoggedin: function(val) {
      this.loggedin = val;
      return updated('viewstate');
    },
    setShowSeenStatus: function(val) {
      this.showseenstatus = localStorage.showseenstatus = !!val;
      return updated('viewstate');
    },
    setLastKeyDown: (function() {
      var PAUSED, STOPPED, TYPING, lastEmitted, timeout, update;
      ({TYPING, PAUSED, STOPPED} = Client.TypingStatus);
      lastEmitted = 0;
      timeout = 0;
      return update = throttle(500, function(time) {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = null;
        if (!time) {
          return lastEmitted = 0;
        } else {
          if (time - lastEmitted > 5000) {
            later(function() {
              return action('settyping', TYPING);
            });
            lastEmitted = time;
          }
          return timeout = setTimeout(function() {
            // after 6 secods of no keyboard, we consider the
            // user took a break.
            lastEmitted = 0;
            action('settyping', PAUSED);
            return timeout = setTimeout(function() {
              // and after another 6 seconds (12 total), we
              // consider the typing stopped altogether.
              return action('settyping', STOPPED);
            }, 6000);
          }, 6000);
        }
      });
    })(),
    setShowConvMin: function(doshow) {
      if (this.showConvMin === doshow) {
        return;
      }
      this.showConvMin = localStorage.showConvMin = doshow;
      if (doshow) {
        this.setShowConvThumbs(true);
      }
      return updated('viewstate');
    },
    setShowConvThumbs: function(doshow) {
      if (this.showConvThumbs === doshow) {
        return;
      }
      this.showConvThumbs = localStorage.showConvThumbs = doshow;
      if (!doshow) {
        this.setShowConvMin(false);
      }
      return updated('viewstate');
    },
    setShowAnimatedThumbs: function(doshow) {
      if (this.showAnimatedThumbs === doshow) {
        return;
      }
      this.showAnimatedThumbs = localStorage.showAnimatedThumbs = doshow;
      return updated('viewstate');
    },
    setShowConvTime: function(doshow) {
      if (this.showConvTime === doshow) {
        return;
      }
      this.showConvTime = localStorage.showConvTime = doshow;
      return updated('viewstate');
    },
    setShowConvLast: function(doshow) {
      if (this.showConvLast === doshow) {
        return;
      }
      this.showConvLast = localStorage.showConvLast = doshow;
      return updated('viewstate');
    },
    setShowPopUpNotifications: function(doshow) {
      if (this.showPopUpNotifications === doshow) {
        return;
      }
      this.showPopUpNotifications = localStorage.showPopUpNotifications = doshow;
      return updated('viewstate');
    },
    setShowMessageInNotification: function(doshow) {
      if (this.showMessageInNotification === doshow) {
        return;
      }
      this.showMessageInNotification = localStorage.showMessageInNotification = doshow;
      return updated('viewstate');
    },
    setShowUsernameInNotification: function(doshow) {
      if (this.showUsernameInNotification === doshow) {
        return;
      }
      this.showUsernameInNotification = localStorage.showUsernameInNotification = doshow;
      return updated('viewstate');
    },
    setForceCustomSound: function(doshow) {
      if (localStorage.forceCustomSound === doshow) {
        return;
      }
      this.forceCustomSound = localStorage.forceCustomSound = doshow;
      return updated('viewstate');
    },
    setShowIconNotification: function(doshow) {
      if (localStorage.showIconNotification === doshow) {
        return;
      }
      this.showIconNotification = localStorage.showIconNotification = doshow;
      return updated('viewstate');
    },
    setMuteSoundNotification: function(doshow) {
      if (localStorage.muteSoundNotification === doshow) {
        return;
      }
      this.muteSoundNotification = localStorage.muteSoundNotification = doshow;
      return updated('viewstate');
    },
    setConvertEmoji: function(doshow) {
      if (this.convertEmoji === doshow) {
        return;
      }
      this.convertEmoji = localStorage.convertEmoji = doshow;
      return updated('viewstate');
    },
    setSuggestEmoji: function(doshow) {
      if (this.suggestEmoji === doshow) {
        return;
      }
      this.suggestEmoji = localStorage.suggestEmoji = doshow;
      return updated('viewstate');
    },
    setshowImagePreview: function(doshow) {
      if (this.showImagePreview === doshow) {
        return;
      }
      this.showImagePreview = localStorage.showImagePreview = doshow;
      return updated('viewstate');
    },
    setColorScheme: function(colorscheme) {
      this.colorScheme = localStorage.colorScheme = colorscheme;
      while (document.querySelector('html').classList.length > 0) {
        document.querySelector('html').classList.remove(document.querySelector('html').classList.item(0));
      }
      return document.querySelector('html').classList.add(colorscheme);
    },
    setFontSize: function(fontsize) {
      this.fontSize = localStorage.fontSize = fontsize;
      while (document.querySelector('html').classList.length > 0) {
        document.querySelector('html').classList.remove(document.querySelector('html').classList.item(0));
      }
      document.querySelector('html').classList.add(localStorage.colorScheme);
      return document.querySelector('html').classList.add(fontsize);
    },
    setEscapeClearsInput: function(value) {
      this.escapeClearsInput = localStorage.escapeClearsInput = value;
      return updated('viewstate');
    },
    setColorblind: function(value) {
      this.colorblind = localStorage.colorblind = value;
      return updated('viewstate');
    },
    setShowTray: function(value) {
      this.showtray = localStorage.showtray = value;
      if (!this.showtray) {
        this.setCloseToTray(false);
        return this.setStartMinimizedToTray(false);
      } else {
        return updated('viewstate');
      }
    },
    setHideDockIcon: function(value) {
      this.hidedockicon = localStorage.hidedockicon = value;
      return updated('viewstate');
    },
    setStartMinimizedToTray: function(value) {
      this.startminimizedtotray = localStorage.startminimizedtotray = value;
      return updated('viewstate');
    },
    setShowDockIconOnce: function(value) {
      return this.showDockIconOnce = value;
    },
    setCloseToTray: function(value) {
      this.closetotray = localStorage.closetotray = !!value;
      return updated('viewstate');
    },
    setOpenOnSystemStartup: function(open) {
      if (this.openOnSystemStartup === open) {
        return;
      }
      if (open) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
      this.openOnSystemStartup = open;
      return updated('viewstate');
    },
    initOpenOnSystemStartup: function(isEnabled) {
      this.openOnSystemStartup = isEnabled;
      return updated('viewstate');
    }
  };

  merge(exp, STATES);

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvbW9kZWxzL3ZpZXdzdGF0ZS5qcyIsInNvdXJjZXMiOlsidWkvbW9kZWxzL3ZpZXdzdGF0ZS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLE1BQUEsRUFBQSxNQUFBLEVBQUEsWUFBQSxFQUFBLEdBQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLEdBQUEsRUFBQSxJQUFBLEVBQUEsS0FBQSxFQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsUUFBQSxFQUFBOztFQUFBLE1BQUEsR0FBUyxPQUFBLENBQVEsV0FBUjs7RUFFVCxLQUFBLEdBQVUsUUFBQSxDQUFDLENBQUQsRUFBQSxHQUFJLEVBQUosQ0FBQTtBQUFhLFFBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxHQUFBLEVBQUEsQ0FBQSxFQUFBO0lBQUMsS0FBQSxvQ0FBQTs7TUFBQSxLQUFBLE1BQUE7O1lBQTJCLE1BQVUsUUFBVixNQUFnQjtVQUEzQyxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU87O01BQVA7SUFBQTtXQUFtRTtFQUFqRjs7RUFFVixDQUFBLENBQUMsUUFBRCxFQUFXLEtBQVgsRUFBa0IsUUFBbEIsRUFBNEIsWUFBNUIsQ0FBQSxHQUE0QyxPQUFBLENBQVEsU0FBUixDQUE1Qzs7RUFFQSxNQUFBLEdBQ0k7SUFBQSxhQUFBLEVBQWUsU0FBZjtJQUNBLFlBQUEsRUFBYyxRQURkO0lBRUEsc0JBQUEsRUFBd0Isa0JBRnhCO0lBR0EsV0FBQSxFQUFhO0VBSGI7O0VBS0osTUFBTSxDQUFDLE9BQVAsR0FBaUIsR0FBQSxHQUFNO0lBQ25CLEtBQUEsRUFBTyxJQURZO0lBRW5CLEtBQUEsRUFBTyxLQUZZ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WSxDQUFDLE1BQWIsQ0FBQSxFQURKO09BQUEsTUFBQTtRQUdJLFlBQVksQ0FBQyxPQUFiLENBQUEsRUFISjs7TUFLQSxJQUFDLENBQUEsbUJBQUQsR0FBdUI7YUFFdkIsT0FBQSxDQUFRLFdBQVI7SUFWb0IsQ0E1VEw7SUF3VW5CLHVCQUFBLEVBQXlCLFFBQUEsQ0FBQyxTQUFELENBQUE7TUFDckIsSUFBQyxDQUFBLG1CQUFELEdBQXVCO2FBRXZCLE9BQUEsQ0FBUSxXQUFSO0lBSHFCO0VBeFVOOztFQThVdkIsS0FBQSxDQUFNLEdBQU4sRUFBVyxNQUFYO0FBMVZBIiwic291cmNlc0NvbnRlbnQiOlsiQ2xpZW50ID0gcmVxdWlyZSAnaGFuZ3Vwc2pzJ1xuXG5tZXJnZSAgID0gKHQsIG9zLi4uKSAtPiB0W2tdID0gdiBmb3Igayx2IG9mIG8gd2hlbiB2IG5vdCBpbiBbbnVsbCwgdW5kZWZpbmVkXSBmb3IgbyBpbiBvczsgdFxuXG57dGhyb3R0bGUsIGxhdGVyLCB0cnlwYXJzZSwgYXV0b0xhdW5jaGVyfSA9IHJlcXVpcmUgJy4uL3V0aWwnXG5cblNUQVRFUyA9XG4gICAgU1RBVEVfU1RBUlRVUDogJ3N0YXJ0dXAnXG4gICAgU1RBVEVfTk9STUFMOiAnbm9ybWFsJ1xuICAgIFNUQVRFX0FERF9DT05WRVJTQVRJT046ICdhZGRfY29udmVyc2F0aW9uJ1xuICAgIFNUQVRFX0FCT1VUOiAnYWJvdXQnXG5cbm1vZHVsZS5leHBvcnRzID0gZXhwID0ge1xuICAgIHN0YXRlOiBudWxsXG4gICAgYXR0b3A6IGZhbHNlICAgIyB0ZWxscyB3aGV0aGVyIG1lc3NhZ2UgbGlzdCBpcyBzY3JvbGxlZCB0byB0b3BcbiAgICBhdGJvdHRvbTogdHJ1ZSAjIHRlbGxzIHdoZXRoZXIgbWVzc2FnZSBsaXN0IGlzIHNjcm9sbGVkIHRvIGJvdHRvbVxuICAgIHNlbGVjdGVkQ29udjogbG9jYWxTdG9yYWdlLnNlbGVjdGVkQ29udlxuICAgIGxhc3RBY3Rpdml0eTogbnVsbFxuICAgIGxlZnRTaXplOiB0cnlwYXJzZShsb2NhbFN0b3JhZ2UubGVmdFNpemUpID8gMjQwXG4gICAgc2l6ZTogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNpemUgPyBcIls5NDAsIDYwMF1cIilcbiAgICBwb3M6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5wb3MgPyBcIlsxMDAsIDEwMF1cIilcbiAgICBzaG93Q29udk1pbjogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dDb252TWluKSA/IGZhbHNlXG4gICAgc2hvd0NvbnZUaHVtYnM6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5zaG93Q29udlRodW1icykgPyB0cnVlXG4gICAgc2hvd0FuaW1hdGVkVGh1bWJzOiB0cnlwYXJzZShsb2NhbFN0b3JhZ2Uuc2hvd0FuaW1hdGVkVGh1bWJzKSA/IHRydWVcbiAgICBzaG93Q29udlRpbWU6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5zaG93Q29udlRpbWUpID8gdHJ1ZVxuICAgIHNob3dDb252TGFzdDogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dDb252TGFzdCkgPyB0cnVlXG4gICAgc2hvd1BvcFVwTm90aWZpY2F0aW9uczogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dQb3BVcE5vdGlmaWNhdGlvbnMpID8gdHJ1ZVxuICAgIHNob3dNZXNzYWdlSW5Ob3RpZmljYXRpb246IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5zaG93TWVzc2FnZUluTm90aWZpY2F0aW9uKSA/IHRydWVcbiAgICBzaG93VXNlcm5hbWVJbk5vdGlmaWNhdGlvbjogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dVc2VybmFtZUluTm90aWZpY2F0aW9uKSA/IHRydWVcbiAgICBjb252ZXJ0RW1vamk6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5jb252ZXJ0RW1vamkpID8gdHJ1ZVxuICAgIHN1Z2dlc3RFbW9qaTogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnN1Z2dlc3RFbW9qaSkgPyB0cnVlXG4gICAgc2hvd0ltYWdlUHJldmlldzogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dJbWFnZVByZXZpZXcpID8gdHJ1ZVxuICAgIGNvbG9yU2NoZW1lOiBsb2NhbFN0b3JhZ2UuY29sb3JTY2hlbWUgb3IgJ2RlZmF1bHQnXG4gICAgZm9udFNpemU6IGxvY2FsU3RvcmFnZS5mb250U2l6ZSBvciAnbWVkaXVtJ1xuICAgIHpvb206IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS56b29tID8gXCIxLjBcIilcbiAgICBsb2dnZWRpbjogZmFsc2VcbiAgICBlc2NhcGVDbGVhcnNJbnB1dDogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLmVzY2FwZUNsZWFyc0lucHV0KSBvciBmYWxzZVxuICAgIHNob3d0cmF5OiB0cnlwYXJzZShsb2NhbFN0b3JhZ2Uuc2hvd3RyYXkpIG9yIGZhbHNlXG4gICAgaGlkZWRvY2tpY29uOiB0cnlwYXJzZShsb2NhbFN0b3JhZ2UuaGlkZWRvY2tpY29uKSBvciBmYWxzZVxuICAgIGNvbG9yYmxpbmQ6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5jb2xvcmJsaW5kKSBvciBmYWxzZVxuICAgIHN0YXJ0bWluaW1pemVkdG90cmF5OiB0cnlwYXJzZShsb2NhbFN0b3JhZ2Uuc3RhcnRtaW5pbWl6ZWR0b3RyYXkpIG9yIGZhbHNlXG4gICAgY2xvc2V0b3RyYXk6IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5jbG9zZXRvdHJheSkgb3IgZmFsc2VcbiAgICBzaG93RG9ja09uY2U6IHRydWVcbiAgICBzaG93SWNvbk5vdGlmaWNhdGlvbjogdHJ5cGFyc2UobG9jYWxTdG9yYWdlLnNob3dJY29uTm90aWZpY2F0aW9uKSA/IHRydWVcbiAgICBtdXRlU291bmROb3RpZmljYXRpb246IHRyeXBhcnNlKGxvY2FsU3RvcmFnZS5tdXRlU291bmROb3RpZmljYXRpb24pID8gZmFsc2VcbiAgICBmb3JjZUN1c3RvbVNvdW5kOiB0cnlwYXJzZShsb2NhbFN0b3JhZ2UuZm9yY2VDdXN0b21Tb3VuZCkgPyBmYWxzZVxuICAgIGxhbmd1YWdlOiBsb2NhbFN0b3JhZ2UubGFuZ3VhZ2UgPyAnZW4nXG4gICAgdXNlU3lzdGVtRGF0ZUZvcm1hdDogbG9jYWxTdG9yYWdlLnVzZVN5c3RlbURhdGVGb3JtYXQgaXMgXCJ0cnVlXCJcbiAgICBzcGVsbGNoZWNrTGFuZ3VhZ2U6IGxvY2FsU3RvcmFnZS5zcGVsbGNoZWNrTGFuZ3VhZ2UgPyAnbm9uZSdcbiAgICAjIG5vbiBwZXJzaXN0ZW50IVxuICAgIG1lc3NhZ2VNZW1vcnk6IHt9ICAgICAgIyBzdG9yZXMgaW5wdXQgd2hlbiBzd2l0aGNoaW5nIGNvbnZlcnNhdGlvbnNcbiAgICBjYWNoZWRJbml0aWFsc0NvZGU6IHt9ICMgY29kZSB1c2VkIGZvciBjb2xvcmVkIGluaXRpYWxzLCBpZiBubyBhdmF0YXJcbiAgICAjIGNvbnRhY3RzIGFyZSBsb2FkZWRcbiAgICBsb2FkZWRDb250YWN0czogZmFsc2VcbiAgICBvcGVuT25TeXN0ZW1TdGFydHVwOiBmYWxzZVxuXG4gICAgc2V0VXNlU3lzdGVtRGF0ZUZvcm1hdDogKHZhbCkgLT5cbiAgICAgICAgQHVzZVN5c3RlbURhdGVGb3JtYXQgPSB2YWxcbiAgICAgICAgbG9jYWxTdG9yYWdlLnVzZVN5c3RlbURhdGVGb3JtYXQgPSB2YWxcbiAgICAgICAgdXBkYXRlZCAnbGFuZ3VhZ2UnXG5cbiAgICBzZXRDb250YWN0czogKHN0YXRlKSAtPlxuICAgICAgICByZXR1cm4gaWYgc3RhdGUgPT0gQGxvYWRlZENvbnRhY3RzXG4gICAgICAgIEBsb2FkZWRDb250YWN0cyA9IHN0YXRlXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFN0YXRlOiAoc3RhdGUpIC0+XG4gICAgICAgIHJldHVybiBpZiBAc3RhdGUgPT0gc3RhdGVcbiAgICAgICAgQHN0YXRlID0gc3RhdGVcbiAgICAgICAgaWYgc3RhdGUgPT0gU1RBVEVTLlNUQVRFX1NUQVJUVVBcbiAgICAgICAgICAgICMgc2V0IGEgZmlyc3QgYWN0aXZlIHRpbWVzdGFtcCB0byBhdm9pZCByZXF1ZXN0aW5nXG4gICAgICAgICAgICAjIHN5bmNhbGxuZXdldmVudHMgb24gc3RhcnR1cFxuICAgICAgICAgICAgcmVxdWlyZSgnLi9jb25uZWN0aW9uJykuc2V0TGFzdEFjdGl2ZShEYXRlLm5vdygpLCB0cnVlKVxuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRTcGVsbENoZWNrTGFuZ3VhZ2U6IChsYW5ndWFnZSwgbWFpbldpbmRvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIEBsYW5ndWFnZSA9PSBsYW5ndWFnZVxuXG4gICAgICAgIGlmIGxhbmd1YWdlID09ICdub25lJ1xuICAgICAgICAgICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5zZXNzaW9uLnNldFNwZWxsQ2hlY2tlckxhbmd1YWdlcyhbXSlcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5zZXNzaW9uLnNldFNwZWxsQ2hlY2tlckxhbmd1YWdlcyhbbGFuZ3VhZ2VdKVxuICAgICAgICBAc3BlbGxjaGVja0xhbmd1YWdlID0gbG9jYWxTdG9yYWdlLnNwZWxsY2hlY2tMYW5ndWFnZSA9IGxhbmd1YWdlXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldExhbmd1YWdlOiAobGFuZ3VhZ2UpIC0+XG4gICAgICAgIHJldHVybiBpZiBAbGFuZ3VhZ2UgPT0gbGFuZ3VhZ2VcbiAgICAgICAgaTE4bi5sb2NhbGUgPSBsYW5ndWFnZVxuICAgICAgICBpMThuLnNldExvY2FsZShsYW5ndWFnZSlcbiAgICAgICAgQGxhbmd1YWdlID0gbG9jYWxTdG9yYWdlLmxhbmd1YWdlID0gbGFuZ3VhZ2VcbiAgICAgICAgdXBkYXRlZCAnbGFuZ3VhZ2UnXG5cbiAgICBzd2l0Y2hJbnB1dDogKG5leHRfY29udmVyc2F0aW9uX2lkKSAtPlxuICAgICAgICAjIGlmIGNvbnZlcnNhdGlvbiBpcyBjaGFuZ2luZywgc2F2ZSBpbnB1dFxuICAgICAgICBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXNzYWdlLWlucHV0JylcbiAgICAgICAgaWYgIWVsP1xuICAgICAgICAgICAgY29uc29sZS5sb2cgJ1dhcm5pbmc6IGNvdWxkIG5vdCByZXRyaWV2ZSBtZXNzYWdlIGlucHV0IHRvIHN0b3JlLidcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAjIHNhdmUgY3VycmVudCBpbnB1dFxuICAgICAgICBAbWVzc2FnZU1lbW9yeVtAc2VsZWN0ZWRDb252XSA9IGVsLnZhbHVlXG4gICAgICAgICMgZWl0aGVyIHJlc2V0IG9yIGZldGNoIHByZXZpb3VzIGlucHV0IG9mIHRoZSBuZXcgY29udlxuICAgICAgICBpZiBAbWVzc2FnZU1lbW9yeVtuZXh0X2NvbnZlcnNhdGlvbl9pZF0/XG4gICAgICAgICAgICBlbC52YWx1ZSA9IEBtZXNzYWdlTWVtb3J5W25leHRfY29udmVyc2F0aW9uX2lkXVxuICAgICAgICAgICAgIyBvbmNlIG9sZCBjb252ZXJzYXRpb24gaXMgcmV0cmlldmVkIG1lbW9yeSBpcyB3aXBlZFxuICAgICAgICAgICAgQG1lc3NhZ2VNZW1vcnlbbmV4dF9jb252ZXJzYXRpb25faWRdID0gXCJcIlxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBlbC52YWx1ZSA9ICcnXG4gICAgICAgICNcblxuICAgIHNldFNlbGVjdGVkQ29udjogKGMpIC0+XG4gICAgICAgIGNvbnYgPSByZXF1aXJlICcuL2NvbnYnICMgY2lyY3VsYXJcbiAgICAgICAgY29udl9pZCA9IGM/LmNvbnZlcnNhdGlvbl9pZD8uaWQgPyBjPy5pZCA/IGNcbiAgICAgICAgdW5sZXNzIGNvbnZfaWRcbiAgICAgICAgICAgIGNvbnZfaWQgPSBjb252Lmxpc3QoKT9bMF0/LmNvbnZlcnNhdGlvbl9pZD8uaWRcbiAgICAgICAgcmV0dXJuIGlmIEBzZWxlY3RlZENvbnYgPT0gY29udl9pZFxuICAgICAgICBAc3dpdGNoSW5wdXQoY29udl9pZClcbiAgICAgICAgQHNlbGVjdGVkQ29udiA9IGxvY2FsU3RvcmFnZS5zZWxlY3RlZENvbnYgPSBjb252X2lkXG4gICAgICAgIEBzZXRMYXN0S2V5RG93biAwXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcbiAgICAgICAgdXBkYXRlZCAnc3dpdGNoQ29udidcblxuICAgIHNlbGVjdE5leHRDb252OiAob2Zmc2V0ID0gMSkgLT5cbiAgICAgICAgY29udiA9IHJlcXVpcmUgJy4vY29udidcbiAgICAgICAgaWQgPSBAc2VsZWN0ZWRDb252XG4gICAgICAgIGMgPSBjb252W2lkXVxuICAgICAgICBsaXN0ID0gKGkgZm9yIGkgaW4gY29udi5saXN0KCkgd2hlbiBub3QgY29udi5pc1B1cmVIYW5nb3V0KGkpKVxuICAgICAgICBmb3IgYywgaW5kZXggaW4gbGlzdFxuICAgICAgICAgICAgaWYgaWQgPT0gYy5jb252ZXJzYXRpb25faWQuaWRcbiAgICAgICAgICAgICAgICBjYW5kaWRhdGUgPSBpbmRleCArIG9mZnNldFxuICAgICAgICAgICAgICAgIEBzZXRTZWxlY3RlZENvbnYgbGlzdFtjYW5kaWRhdGVdIGlmIGxpc3RbY2FuZGlkYXRlXVxuXG4gICAgc2VsZWN0Q29udkluZGV4OiAoaW5kZXggPSAwKSAtPlxuICAgICAgICBjb252ID0gcmVxdWlyZSAnLi9jb252J1xuICAgICAgICBsaXN0ID0gKGkgZm9yIGkgaW4gY29udi5saXN0KCkgd2hlbiBub3QgY29udi5pc1B1cmVIYW5nb3V0KGkpKVxuICAgICAgICBAc2V0U2VsZWN0ZWRDb252IGxpc3RbaW5kZXhdXG5cbiAgICB1cGRhdGVBdFRvcDogKGF0dG9wKSAtPlxuICAgICAgICByZXR1cm4gaWYgQGF0dG9wID09IGF0dG9wXG4gICAgICAgIEBhdHRvcCA9IGF0dG9wXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHVwZGF0ZUF0Qm90dG9tOiAoYXRib3R0b20pIC0+XG4gICAgICAgIHJldHVybiBpZiBAYXRib3R0b20gPT0gYXRib3R0b21cbiAgICAgICAgQGF0Ym90dG9tID0gYXRib3R0b21cbiAgICAgICAgQHVwZGF0ZUFjdGl2aXR5IERhdGUubm93KClcblxuICAgIHVwZGF0ZUFjdGl2aXR5OiAodGltZSkgLT5cbiAgICAgICAgY29udiA9IHJlcXVpcmUgJy4vY29udicgIyBjaXJjdWxhclxuICAgICAgICBAbGFzdEFjdGl2aXR5ID0gdGltZVxuICAgICAgICBsYXRlciAtPiBhY3Rpb24gJ2xhc3RBY3Rpdml0eSdcbiAgICAgICAgcmV0dXJuIHVubGVzcyBkb2N1bWVudC5oYXNGb2N1cygpIGFuZCBAYXRib3R0b20gYW5kIEBzdGF0ZSA9PSBTVEFURVMuU1RBVEVfTk9STUFMXG4gICAgICAgIGMgPSBjb252W0BzZWxlY3RlZENvbnZdXG4gICAgICAgIHJldHVybiB1bmxlc3MgY1xuICAgICAgICB1ciA9IGNvbnYudW5yZWFkIGNcbiAgICAgICAgaWYgdXIgPiAwXG4gICAgICAgICAgICBsYXRlciAtPiBhY3Rpb24gJ3VwZGF0ZXdhdGVybWFyaydcblxuICAgIHNldFNpemU6IChzaXplKSAtPlxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2l6ZSA9IEpTT04uc3RyaW5naWZ5KHNpemUpXG4gICAgICAgIEBzaXplID0gc2l6ZVxuICAgICAgICAjIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFBvc2l0aW9uOiAocG9zKSAtPlxuICAgICAgICBsb2NhbFN0b3JhZ2UucG9zID0gSlNPTi5zdHJpbmdpZnkocG9zKVxuICAgICAgICBAcG9zID0gcG9zXG4gICAgICAgICMgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0TGVmdFNpemU6IChzaXplKSAtPlxuICAgICAgICByZXR1cm4gaWYgQGxlZnRTaXplID09IHNpemUgb3Igc2l6ZSA8IDE4MFxuICAgICAgICBAbGVmdFNpemUgPSBsb2NhbFN0b3JhZ2UubGVmdFNpemUgPSBzaXplXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFpvb206ICh6b29tKSAtPlxuICAgICAgICBAem9vbSA9IGxvY2FsU3RvcmFnZS56b29tID0gZG9jdW1lbnQuYm9keS5zdHlsZS56b29tID0gem9vbVxuICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnNldFByb3BlcnR5KCctLXpvb20nLCB6b29tKVxuXG4gICAgc2V0TG9nZ2VkaW46ICh2YWwpIC0+XG4gICAgICAgIEBsb2dnZWRpbiA9IHZhbFxuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRTaG93U2VlblN0YXR1czogKHZhbCkgLT5cbiAgICAgICAgQHNob3dzZWVuc3RhdHVzID0gbG9jYWxTdG9yYWdlLnNob3dzZWVuc3RhdHVzID0gISF2YWxcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0TGFzdEtleURvd246IGRvIC0+XG4gICAgICAgIHtUWVBJTkcsIFBBVVNFRCwgU1RPUFBFRH0gPSBDbGllbnQuVHlwaW5nU3RhdHVzXG4gICAgICAgIGxhc3RFbWl0dGVkID0gMFxuICAgICAgICB0aW1lb3V0ID0gMFxuICAgICAgICB1cGRhdGUgPSB0aHJvdHRsZSA1MDAsICh0aW1lKSAtPlxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0IHRpbWVvdXQgaWYgdGltZW91dFxuICAgICAgICAgICAgdGltZW91dCA9IG51bGxcbiAgICAgICAgICAgIHVubGVzcyB0aW1lXG4gICAgICAgICAgICAgICAgbGFzdEVtaXR0ZWQgPSAwXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgaWYgdGltZSAtIGxhc3RFbWl0dGVkID4gNTAwMFxuICAgICAgICAgICAgICAgICAgICBsYXRlciAtPiBhY3Rpb24gJ3NldHR5cGluZycsIFRZUElOR1xuICAgICAgICAgICAgICAgICAgICBsYXN0RW1pdHRlZCA9IHRpbWVcbiAgICAgICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dCAtPlxuICAgICAgICAgICAgICAgICAgICAjIGFmdGVyIDYgc2Vjb2RzIG9mIG5vIGtleWJvYXJkLCB3ZSBjb25zaWRlciB0aGVcbiAgICAgICAgICAgICAgICAgICAgIyB1c2VyIHRvb2sgYSBicmVhay5cbiAgICAgICAgICAgICAgICAgICAgbGFzdEVtaXR0ZWQgPSAwXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbiAnc2V0dHlwaW5nJywgUEFVU0VEXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0IC0+XG4gICAgICAgICAgICAgICAgICAgICAgICAjIGFuZCBhZnRlciBhbm90aGVyIDYgc2Vjb25kcyAoMTIgdG90YWwpLCB3ZVxuICAgICAgICAgICAgICAgICAgICAgICAgIyBjb25zaWRlciB0aGUgdHlwaW5nIHN0b3BwZWQgYWx0b2dldGhlci5cbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbiAnc2V0dHlwaW5nJywgU1RPUFBFRFxuICAgICAgICAgICAgICAgICAgICAsIDYwMDBcbiAgICAgICAgICAgICAgICAsIDYwMDBcblxuICAgIHNldFNob3dDb252TWluOiAoZG9zaG93KSAtPlxuICAgICAgICByZXR1cm4gaWYgQHNob3dDb252TWluID09IGRvc2hvd1xuICAgICAgICBAc2hvd0NvbnZNaW4gPSBsb2NhbFN0b3JhZ2Uuc2hvd0NvbnZNaW4gPSBkb3Nob3dcbiAgICAgICAgaWYgZG9zaG93XG4gICAgICAgICAgICB0aGlzLnNldFNob3dDb252VGh1bWJzKHRydWUpXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFNob3dDb252VGh1bWJzOiAoZG9zaG93KSAtPlxuICAgICAgICByZXR1cm4gaWYgQHNob3dDb252VGh1bWJzID09IGRvc2hvd1xuICAgICAgICBAc2hvd0NvbnZUaHVtYnMgPSBsb2NhbFN0b3JhZ2Uuc2hvd0NvbnZUaHVtYnMgPSBkb3Nob3dcbiAgICAgICAgdW5sZXNzIGRvc2hvd1xuICAgICAgICAgICAgdGhpcy5zZXRTaG93Q29udk1pbihmYWxzZSlcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U2hvd0FuaW1hdGVkVGh1bWJzOiAoZG9zaG93KSAtPlxuICAgICAgICByZXR1cm4gaWYgQHNob3dBbmltYXRlZFRodW1icyA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dBbmltYXRlZFRodW1icyA9IGxvY2FsU3RvcmFnZS5zaG93QW5pbWF0ZWRUaHVtYnMgPSBkb3Nob3dcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U2hvd0NvbnZUaW1lOiAoZG9zaG93KSAtPlxuICAgICAgICByZXR1cm4gaWYgQHNob3dDb252VGltZSA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dDb252VGltZSA9IGxvY2FsU3RvcmFnZS5zaG93Q29udlRpbWUgPSBkb3Nob3dcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U2hvd0NvbnZMYXN0OiAoZG9zaG93KSAtPlxuICAgICAgICByZXR1cm4gaWYgQHNob3dDb252TGFzdCA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dDb252TGFzdCA9IGxvY2FsU3RvcmFnZS5zaG93Q29udkxhc3QgPSBkb3Nob3dcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U2hvd1BvcFVwTm90aWZpY2F0aW9uczogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIEBzaG93UG9wVXBOb3RpZmljYXRpb25zID09IGRvc2hvd1xuICAgICAgICBAc2hvd1BvcFVwTm90aWZpY2F0aW9ucyA9IGxvY2FsU3RvcmFnZS5zaG93UG9wVXBOb3RpZmljYXRpb25zID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFNob3dNZXNzYWdlSW5Ob3RpZmljYXRpb246IChkb3Nob3cpIC0+XG4gICAgICAgIHJldHVybiBpZiBAc2hvd01lc3NhZ2VJbk5vdGlmaWNhdGlvbiA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dNZXNzYWdlSW5Ob3RpZmljYXRpb24gPSBsb2NhbFN0b3JhZ2Uuc2hvd01lc3NhZ2VJbk5vdGlmaWNhdGlvbiA9IGRvc2hvd1xuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRTaG93VXNlcm5hbWVJbk5vdGlmaWNhdGlvbjogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIEBzaG93VXNlcm5hbWVJbk5vdGlmaWNhdGlvbiA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dVc2VybmFtZUluTm90aWZpY2F0aW9uID0gbG9jYWxTdG9yYWdlLnNob3dVc2VybmFtZUluTm90aWZpY2F0aW9uID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldEZvcmNlQ3VzdG9tU291bmQ6IChkb3Nob3cpIC0+XG4gICAgICAgIHJldHVybiBpZiBsb2NhbFN0b3JhZ2UuZm9yY2VDdXN0b21Tb3VuZCA9PSBkb3Nob3dcbiAgICAgICAgQGZvcmNlQ3VzdG9tU291bmQgPSBsb2NhbFN0b3JhZ2UuZm9yY2VDdXN0b21Tb3VuZCA9IGRvc2hvd1xuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRTaG93SWNvbk5vdGlmaWNhdGlvbjogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIGxvY2FsU3RvcmFnZS5zaG93SWNvbk5vdGlmaWNhdGlvbiA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dJY29uTm90aWZpY2F0aW9uID0gbG9jYWxTdG9yYWdlLnNob3dJY29uTm90aWZpY2F0aW9uID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldE11dGVTb3VuZE5vdGlmaWNhdGlvbjogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIGxvY2FsU3RvcmFnZS5tdXRlU291bmROb3RpZmljYXRpb24gPT0gZG9zaG93XG4gICAgICAgIEBtdXRlU291bmROb3RpZmljYXRpb24gPSBsb2NhbFN0b3JhZ2UubXV0ZVNvdW5kTm90aWZpY2F0aW9uID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldENvbnZlcnRFbW9qaTogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIEBjb252ZXJ0RW1vamkgPT0gZG9zaG93XG4gICAgICAgIEBjb252ZXJ0RW1vamkgPSBsb2NhbFN0b3JhZ2UuY29udmVydEVtb2ppID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldFN1Z2dlc3RFbW9qaTogKGRvc2hvdykgLT5cbiAgICAgICAgcmV0dXJuIGlmIEBzdWdnZXN0RW1vamkgPT0gZG9zaG93XG4gICAgICAgIEBzdWdnZXN0RW1vamkgPSBsb2NhbFN0b3JhZ2Uuc3VnZ2VzdEVtb2ppID0gZG9zaG93XG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldHNob3dJbWFnZVByZXZpZXc6IChkb3Nob3cpIC0+XG4gICAgICAgIHJldHVybiBpZiBAc2hvd0ltYWdlUHJldmlldyA9PSBkb3Nob3dcbiAgICAgICAgQHNob3dJbWFnZVByZXZpZXcgPSBsb2NhbFN0b3JhZ2Uuc2hvd0ltYWdlUHJldmlldyA9IGRvc2hvd1xuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRDb2xvclNjaGVtZTogKGNvbG9yc2NoZW1lKSAtPlxuICAgICAgICBAY29sb3JTY2hlbWUgPSBsb2NhbFN0b3JhZ2UuY29sb3JTY2hlbWUgPSBjb2xvcnNjaGVtZVxuICAgICAgICB3aGlsZSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdodG1sJykuY2xhc3NMaXN0Lmxlbmd0aCA+IDBcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2h0bWwnKS5jbGFzc0xpc3QucmVtb3ZlIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2h0bWwnKS5jbGFzc0xpc3QuaXRlbSgwKVxuICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdodG1sJykuY2xhc3NMaXN0LmFkZChjb2xvcnNjaGVtZSlcblxuICAgIHNldEZvbnRTaXplOiAoZm9udHNpemUpIC0+XG4gICAgICAgIEBmb250U2l6ZSA9IGxvY2FsU3RvcmFnZS5mb250U2l6ZSA9IGZvbnRzaXplXG4gICAgICAgIHdoaWxlIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2h0bWwnKS5jbGFzc0xpc3QubGVuZ3RoID4gMFxuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaHRtbCcpLmNsYXNzTGlzdC5yZW1vdmUgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaHRtbCcpLmNsYXNzTGlzdC5pdGVtKDApXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2h0bWwnKS5jbGFzc0xpc3QuYWRkKGxvY2FsU3RvcmFnZS5jb2xvclNjaGVtZSlcbiAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaHRtbCcpLmNsYXNzTGlzdC5hZGQoZm9udHNpemUpXG5cbiAgICBzZXRFc2NhcGVDbGVhcnNJbnB1dDogKHZhbHVlKSAtPlxuICAgICAgICBAZXNjYXBlQ2xlYXJzSW5wdXQgPSBsb2NhbFN0b3JhZ2UuZXNjYXBlQ2xlYXJzSW5wdXQgPSB2YWx1ZVxuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRDb2xvcmJsaW5kOiAodmFsdWUpIC0+XG4gICAgICAgIEBjb2xvcmJsaW5kID0gbG9jYWxTdG9yYWdlLmNvbG9yYmxpbmQgPSB2YWx1ZVxuICAgICAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbiAgICBzZXRTaG93VHJheTogKHZhbHVlKSAtPlxuICAgICAgICBAc2hvd3RyYXkgPSBsb2NhbFN0b3JhZ2Uuc2hvd3RyYXkgPSB2YWx1ZVxuXG4gICAgICAgIGlmIG5vdCBAc2hvd3RyYXlcbiAgICAgICAgICAgIEBzZXRDbG9zZVRvVHJheShmYWxzZSlcbiAgICAgICAgICAgIEBzZXRTdGFydE1pbmltaXplZFRvVHJheShmYWxzZSlcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0SGlkZURvY2tJY29uOiAodmFsdWUpIC0+XG4gICAgICAgIEBoaWRlZG9ja2ljb24gPSBsb2NhbFN0b3JhZ2UuaGlkZWRvY2tpY29uID0gdmFsdWVcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U3RhcnRNaW5pbWl6ZWRUb1RyYXk6ICh2YWx1ZSkgLT5cbiAgICAgICAgQHN0YXJ0bWluaW1pemVkdG90cmF5ID0gbG9jYWxTdG9yYWdlLnN0YXJ0bWluaW1pemVkdG90cmF5ID0gdmFsdWVcbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgc2V0U2hvd0RvY2tJY29uT25jZTogKHZhbHVlKSAtPlxuICAgICAgICBAc2hvd0RvY2tJY29uT25jZSA9IHZhbHVlXG5cbiAgICBzZXRDbG9zZVRvVHJheTogKHZhbHVlKSAtPlxuICAgICAgICBAY2xvc2V0b3RyYXkgPSBsb2NhbFN0b3JhZ2UuY2xvc2V0b3RyYXkgPSAhIXZhbHVlXG4gICAgICAgIHVwZGF0ZWQgJ3ZpZXdzdGF0ZSdcblxuICAgIHNldE9wZW5PblN5c3RlbVN0YXJ0dXA6IChvcGVuKSAtPlxuICAgICAgICByZXR1cm4gaWYgQG9wZW5PblN5c3RlbVN0YXJ0dXAgPT0gb3BlblxuXG4gICAgICAgIGlmIG9wZW5cbiAgICAgICAgICAgIGF1dG9MYXVuY2hlci5lbmFibGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBhdXRvTGF1bmNoZXIuZGlzYWJsZSgpXG5cbiAgICAgICAgQG9wZW5PblN5c3RlbVN0YXJ0dXAgPSBvcGVuXG5cbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xuXG4gICAgaW5pdE9wZW5PblN5c3RlbVN0YXJ0dXA6IChpc0VuYWJsZWQpIC0+XG4gICAgICAgIEBvcGVuT25TeXN0ZW1TdGFydHVwID0gaXNFbmFibGVkXG5cbiAgICAgICAgdXBkYXRlZCAndmlld3N0YXRlJ1xufVxuXG5tZXJnZSBleHAsIFNUQVRFU1xuIl19
