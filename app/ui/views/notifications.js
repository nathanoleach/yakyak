(function() {
  var audioEl, audioFile, callNeedAnswer, fixlink, getProxiedName, i18n, nameof, notificationCenterSupportsSound, notifier, notifierSupportsSound, openHangout, path, remote, shell, textMessage;

  notifier = require('node-notifier');

  shell = require('electron').shell;

  path = require('path');

  remote = require('electron').remote;

  i18n = require('i18n');

  ({nameof, getProxiedName, fixlink, notificationCenterSupportsSound} = require('../util'));

  // conv_id markers for call notifications
  callNeedAnswer = {};

  notifierSupportsSound = notificationCenterSupportsSound();

  // Custom sound for new message notifications
  audioFile = path.join(YAKYAK_ROOT_DIR, '..', 'media', 'new_message.ogg');

  audioEl = new Audio(audioFile);

  audioEl.volume = .4;

  module.exports = function(models) {
    var conv, entity, mainWindow, notify, quietIf, tonot, viewstate;
    ({conv, notify, entity, viewstate} = models);
    tonot = notify.popToNotify();
    // And we hope we don't get another 'currentWindow' ;)
    mainWindow = remote.getCurrentWindow();
    quietIf = function(c, chat_id) {
      return (mainWindow.isVisible() && mainWindow.isFocused()) || conv.isQuiet(c) || entity.isSelf(chat_id);
    };
    return tonot.forEach(function(msg) {
      var c, chat_id, cid, contentImage, conv_id, icon, isNotificationCenter, proxied, ref, ref1, ref2, ref3, ref4, ref5, ref6, sender, text;
      conv_id = msg != null ? (ref = msg.conversation_id) != null ? ref.id : void 0 : void 0;
      c = conv[conv_id];
      chat_id = msg != null ? (ref1 = msg.sender_id) != null ? ref1.chat_id : void 0 : void 0;
      proxied = getProxiedName(msg);
      cid = proxied ? proxied : msg != null ? (ref2 = msg.sender_id) != null ? ref2.chat_id : void 0 : void 0;
      sender = nameof(entity[cid]);
      text = null;
      if (msg.chat_message != null) {
        if (((ref3 = msg.chat_message) != null ? ref3.message_content : void 0) == null) {
          return;
        }
        text = textMessage(msg.chat_message.message_content, proxied, viewstate.showMessageInNotification);
      } else if (((ref4 = msg.hangout_event) != null ? ref4.event_type : void 0) === 'START_HANGOUT') {
        text = i18n.__("call.incoming:Incoming call");
        callNeedAnswer[conv_id] = true;
        notr({
          html: `${i18n.__('call.incoming_from:Incoming call from %s', sender)}. ` + `<a href=\"#\" class=\"accept\">${i18n.__('call.accept:Accept')}</a> / ` + `<a href=\"#\" class=\"reject\">${i18n.__('call.reject:Reject')}</a>`,
          stay: 0,
          id: `hang${conv_id}`,
          onclick: function(e) {
            var ref5;
            delete callNeedAnswer[conv_id];
            if ((e != null ? (ref5 = e.target) != null ? ref5.className : void 0 : void 0) === 'accept') {
              notr({
                html: i18n.__('calls.accepted:Accepted'),
                stay: 1000,
                id: `hang${conv_id}`
              });
              return openHangout(conv_id);
            } else {
              return notr({
                html: i18n.__('calls.rejected:Rejected'),
                stay: 1000,
                id: `hang${conv_id}`
              });
            }
          }
        });
      } else if (((ref5 = msg.hangout_event) != null ? ref5.event_type : void 0) === 'END_HANGOUT') {
        if (callNeedAnswer[conv_id]) {
          delete callNeedAnswer[conv_id];
          notr({
            html: `${i18n.__('calls.missed:Missed call from %s', sender)}. ` + `<a href=\"#\">${i18n.__('actions.ok: Ok')}</a>`,
            id: `hang${conv_id}`,
            stay: 0
          });
        }
      } else {
        return;
      }
      if (!text || quietIf(c, chat_id)) {
        return;
      }
      if (viewstate.showPopUpNotifications && !(mainWindow.isVisible() && mainWindow.isFocused())) {
        isNotificationCenter = notifier.constructor.name === 'NotificationCenter';
        
        icon = path.join(__dirname, '..', '..', 'icons', 'icon@8.png');
        // Only for NotificationCenter (darwin)
        if (isNotificationCenter && viewstate.showIconNotification) {
          contentImage = fixlink((ref6 = entity[cid]) != null ? ref6.photo_url : void 0);
        } else {
          contentImage = void 0;
        }
        
        notifier.notify({
          title: viewstate.showUsernameInNotification ? !isNotificationCenter && !viewstate.showIconNotification ? `${sender} (YakYak)` : sender : 'YakYak',
          message: text,
          wait: true,
          hint: "int:transient:1",
          category: 'im.received',
          sender: 'com.github.yakyak',
          sound: !viewstate.muteSoundNotification && (notifierSupportsSound && !viewstate.forceCustomSound),
          icon: !isNotificationCenter && viewstate.showIconNotification ? icon : void 0,
          contentImage: contentImage
        }, function(err, res) {
          if (res != null ? res.trim().match(/Activate/i) : void 0) {
            action('appfocus');
            return action('selectConv', c);
          }
        });
        if ((!notifierSupportsSound || viewstate.forceCustomSound) && !viewstate.muteSoundNotification && audioEl.paused) {
          audioEl.play();
        }
      }
      // if not mainWindow.isVisible()
      //    mainWindow.showInactive()
      //    mainWindow.minimize()
      return mainWindow.flashFrame(true); // uncommented in #1206
    });
  };

  textMessage = function(cont, proxied, showMessage = true) {
    var i, seg, segs;
    if ((cont != null ? cont.segment : void 0) != null) {
      if (!showMessage) {
        return i18n.__('conversation.new_message:New message received');
      } else {
        segs = (function() {
          var j, len, ref, ref1, results;
          ref1 = (ref = cont != null ? cont.segment : void 0) != null ? ref : [];
          results = [];
          for (i = j = 0, len = ref1.length; j < len; i = ++j) {
            seg = ref1[i];
            if (proxied && i < 2) {
              continue;
            }
            if (!seg.text) {
              continue;
            }
            results.push(seg.text);
          }
          return results;
        })();
        return segs.join('');
      }
    } else if ((cont != null ? cont.attachment : void 0) != null) {
      return i18n.__('conversation.new_attachment:New message received (image or video)');
    }
  };

  openHangout = function(conv_id) {
    return shell.openExternal(`https://plus.google.com/hangouts/_/CONVERSATION/${conv_id}`);
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3Mvbm90aWZpY2F0aW9ucy5qcyIsInNvdXJjZXMiOlsidWkvdmlld3Mvbm90aWZpY2F0aW9ucy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLE9BQUEsRUFBQSxTQUFBLEVBQUEsY0FBQSxFQUFBLE9BQUEsRUFBQSxjQUFBLEVBQUEsSUFBQSxFQUFBLE1BQUEsRUFBQSwrQkFBQSxFQUFBLFFBQUEsRUFBQSxxQkFBQSxFQUFBLFdBQUEsRUFBQSxJQUFBLEVBQUEsTUFBQSxFQUFBLEtBQUEsRUFBQTs7RUFBQSxRQUFBLEdBQVcsT0FBQSxDQUFRLGVBQVI7O0VBQ1gsS0FBQSxHQUFXLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQy9CLElBQUEsR0FBVyxPQUFBLENBQVEsTUFBUjs7RUFDWCxNQUFBLEdBQVcsT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDL0IsSUFBQSxHQUFXLE9BQUEsQ0FBUSxNQUFSOztFQUVYLENBQUEsQ0FBQyxNQUFELEVBQVMsY0FBVCxFQUF5QixPQUF6QixFQUFrQywrQkFBbEMsQ0FBQSxHQUFxRSxPQUFBLENBQVEsU0FBUixDQUFyRSxFQU5BOzs7RUFTQSxjQUFBLEdBQWlCLENBQUE7O0VBRWpCLHFCQUFBLEdBQXdCLCtCQUFBLENBQUEsRUFYeEI7OztFQWNBLFNBQUEsR0FBWSxJQUFJLENBQUMsSUFBTCxDQUFVLGVBQVYsRUFBMkIsSUFBM0IsRUFBaUMsT0FBakMsRUFDWixpQkFEWTs7RUFFWixPQUFBLEdBQVUsSUFBSSxLQUFKLENBQVUsU0FBVjs7RUFDVixPQUFPLENBQUMsTUFBUixHQUFpQjs7RUFHakIsTUFBTSxDQUFDLE9BQVAsR0FBaUIsUUFBQSxDQUFDLE1BQUQsQ0FBQTtBQUNqQixRQUFBLElBQUEsRUFBQSxNQUFBLEVBQUEsVUFBQSxFQUFBLE1BQUEsRUFBQSxPQUFBLEVBQUEsS0FBQSxFQUFBO0lBQUksQ0FBQSxDQUFDLElBQUQsRUFBTyxNQUFQLEVBQWUsTUFB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SCxJQUFZLE9BQUEsSUFBWSxDQUFBLEdBQUksQ0FBNUI7QUFBQSx1QkFBQTs7WUFDQSxLQUFnQixHQUFHLENBQUMsSUFBcEI7QUFBQSx1QkFBQTs7eUJBQ0EsR0FBRyxDQUFDO1VBSEQsQ0FBQTs7O2VBSVAsSUFBSSxDQUFDLElBQUwsQ0FBVSxFQUFWLEVBUEo7T0FERjtLQUFBLE1BU0ssSUFBRyxpREFBSDthQUNILElBQUksQ0FBQyxFQUFMLENBQVEsbUVBQVIsRUFERzs7RUFWSzs7RUFhZCxXQUFBLEdBQWMsUUFBQSxDQUFDLE9BQUQsQ0FBQTtXQUNWLEtBQUssQ0FBQyxZQUFOLENBQW1CLENBQUEsZ0RBQUEsQ0FBQSxDQUFtRCxPQUFuRCxDQUFBLENBQW5CO0VBRFU7QUE5SGQiLCJzb3VyY2VzQ29udGVudCI6WyJub3RpZmllciA9IHJlcXVpcmUgJ25vZGUtbm90aWZpZXInXG5zaGVsbCAgICA9IHJlcXVpcmUoJ2VsZWN0cm9uJykuc2hlbGxcbnBhdGggICAgID0gcmVxdWlyZSAncGF0aCdcbnJlbW90ZSAgID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5yZW1vdGVcbmkxOG4gICAgID0gcmVxdWlyZSAnaTE4bidcblxue25hbWVvZiwgZ2V0UHJveGllZE5hbWUsIGZpeGxpbmssIG5vdGlmaWNhdGlvbkNlbnRlclN1cHBvcnRzU291bmR9ID0gcmVxdWlyZSAnLi4vdXRpbCdcblxuIyBjb252X2lkIG1hcmtlcnMgZm9yIGNhbGwgbm90aWZpY2F0aW9uc1xuY2FsbE5lZWRBbnN3ZXIgPSB7fVxuXG5ub3RpZmllclN1cHBvcnRzU291bmQgPSBub3RpZmljYXRpb25DZW50ZXJTdXBwb3J0c1NvdW5kKClcblxuIyBDdXN0b20gc291bmQgZm9yIG5ldyBtZXNzYWdlIG5vdGlmaWNhdGlvbnNcbmF1ZGlvRmlsZSA9IHBhdGguam9pbiBZQUtZQUtfUk9PVF9ESVIsICcuLicsICdtZWRpYScsXG4nbmV3X21lc3NhZ2Uub2dnJ1xuYXVkaW9FbCA9IG5ldyBBdWRpbyhhdWRpb0ZpbGUpXG5hdWRpb0VsLnZvbHVtZSA9IC40XG5cblxubW9kdWxlLmV4cG9ydHMgPSAobW9kZWxzKSAtPlxuICAgIHtjb252LCBub3RpZnksIGVudGl0eSwgdmlld3N0YXRlfSA9IG1vZGVsc1xuICAgIHRvbm90ID0gbm90aWZ5LnBvcFRvTm90aWZ5KClcblxuICAgICMgQW5kIHdlIGhvcGUgd2UgZG9uJ3QgZ2V0IGFub3RoZXIgJ2N1cnJlbnRXaW5kb3cnIDspXG4gICAgbWFpbldpbmRvdyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KClcblxuICAgIHF1aWV0SWYgPSAoYywgY2hhdF9pZCkgLT4gKG1haW5XaW5kb3cuaXNWaXNpYmxlKCkgYW5kIG1haW5XaW5kb3cuaXNGb2N1c2VkKCkpIG9yIGNvbnYuaXNRdWlldChjKSBvciBlbnRpdHkuaXNTZWxmKGNoYXRfaWQpXG5cbiAgICB0b25vdC5mb3JFYWNoIChtc2cpIC0+XG4gICAgICAgIGNvbnZfaWQgPSBtc2c/LmNvbnZlcnNhdGlvbl9pZD8uaWRcbiAgICAgICAgYyA9IGNvbnZbY29udl9pZF1cbiAgICAgICAgY2hhdF9pZCA9IG1zZz8uc2VuZGVyX2lkPy5jaGF0X2lkXG5cbiAgICAgICAgcHJveGllZCA9IGdldFByb3hpZWROYW1lKG1zZylcbiAgICAgICAgY2lkID0gaWYgcHJveGllZCB0aGVuIHByb3hpZWQgZWxzZSBtc2c/LnNlbmRlcl9pZD8uY2hhdF9pZFxuICAgICAgICBzZW5kZXIgPSBuYW1lb2YgZW50aXR5W2NpZF1cbiAgICAgICAgdGV4dCA9IG51bGxcblxuICAgICAgICBpZiBtc2cuY2hhdF9tZXNzYWdlP1xuICAgICAgICAgICAgcmV0dXJuIHVubGVzcyBtc2cuY2hhdF9tZXNzYWdlPy5tZXNzYWdlX2NvbnRlbnQ/XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dE1lc3NhZ2UgbXNnLmNoYXRfbWVzc2FnZS5tZXNzYWdlX2NvbnRlbnQsIHByb3hpZWQsIHZpZXdzdGF0ZS5zaG93TWVzc2FnZUluTm90aWZpY2F0aW9uXG4gICAgICAgIGVsc2UgaWYgbXNnLmhhbmdvdXRfZXZlbnQ/LmV2ZW50X3R5cGUgPT0gJ1NUQVJUX0hBTkdPVVQnXG4gICAgICAgICAgICB0ZXh0ID0gaTE4bi5fXyBcImNhbGwuaW5jb21pbmc6SW5jb21pbmcgY2FsbFwiXG4gICAgICAgICAgICBjYWxsTmVlZEFuc3dlcltjb252X2lkXSA9IHRydWVcbiAgICAgICAgICAgIG5vdHJcbiAgICAgICAgICAgICAgICBodG1sOiBcIiN7aTE4bi5fXygnY2FsbC5pbmNvbWluZ19mcm9tOkluY29taW5nIGNhbGwgZnJvbSAlcycsIHNlbmRlcil9LiBcIiArXG4gICAgICAgICAgICAgICAgXCI8YSBocmVmPVxcXCIjXFxcIiBjbGFzcz1cXFwiYWNjZXB0XFxcIj4je2kxOG4uX18gJ2NhbGwuYWNjZXB0OkFjY2VwdCd9PC9hPiAvIFwiICtcbiAgICAgICAgICAgICAgICBcIjxhIGhyZWY9XFxcIiNcXFwiIGNsYXNzPVxcXCJyZWplY3RcXFwiPiN7aTE4bi5fXyAnY2FsbC5yZWplY3Q6UmVqZWN0J308L2E+XCJcbiAgICAgICAgICAgICAgICBzdGF5OiAwXG4gICAgICAgICAgICAgICAgaWQ6IFwiaGFuZyN7Y29udl9pZH1cIlxuICAgICAgICAgICAgICAgIG9uY2xpY2s6IChlKSAtPlxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgY2FsbE5lZWRBbnN3ZXJbY29udl9pZF1cbiAgICAgICAgICAgICAgICAgICAgaWYgZT8udGFyZ2V0Py5jbGFzc05hbWUgPT0gJ2FjY2VwdCdcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdHIoe2h0bWw6aTE4bi5fXygnY2FsbHMuYWNjZXB0ZWQ6QWNjZXB0ZWQnKSwgc3RheToxMDAwLCBpZDpcImhhbmcje2NvbnZfaWR9XCJ9KVxuICAgICAgICAgICAgICAgICAgICAgICAgb3BlbkhhbmdvdXQgY29udl9pZFxuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICBub3RyKHtodG1sOiBpMThuLl9fKCdjYWxscy5yZWplY3RlZDpSZWplY3RlZCcpLCBzdGF5OjEwMDAsIGlkOlwiaGFuZyN7Y29udl9pZH1cIn0pXG4gICAgICAgIGVsc2UgaWYgbXNnLmhhbmdvdXRfZXZlbnQ/LmV2ZW50X3R5cGUgPT0gJ0VORF9IQU5HT1VUJ1xuICAgICAgICAgICAgaWYgY2FsbE5lZWRBbnN3ZXJbY29udl9pZF1cbiAgICAgICAgICAgICAgICBkZWxldGUgY2FsbE5lZWRBbnN3ZXJbY29udl9pZF1cbiAgICAgICAgICAgICAgICBub3RyXG4gICAgICAgICAgICAgICAgICAgIGh0bWw6IFwiI3tpMThuLl9fKCdjYWxscy5taXNzZWQ6TWlzc2VkIGNhbGwgZnJvbSAlcycsIHNlbmRlcil9LiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICBcIjxhIGhyZWY9XFxcIiNcXFwiPiN7aTE4bi5fXygnYWN0aW9ucy5vazogT2snKX08L2E+XCJcbiAgICAgICAgICAgICAgICAgICAgaWQ6IFwiaGFuZyN7Y29udl9pZH1cIlxuICAgICAgICAgICAgICAgICAgICBzdGF5OiAwXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgICMgbWF5YmUgdHJpZ2dlciBPUyBub3RpZmljYXRpb25cbiAgICAgICAgcmV0dXJuIGlmICF0ZXh0IG9yIHF1aWV0SWYoYywgY2hhdF9pZClcblxuICAgICAgICBpZiB2aWV3c3RhdGUuc2hvd1BvcFVwTm90aWZpY2F0aW9ucyBhbmQgbm90IChtYWluV2luZG93LmlzVmlzaWJsZSgpIGFuZCBtYWluV2luZG93LmlzRm9jdXNlZCgpKVxuICAgICAgICAgICAgaXNOb3RpZmljYXRpb25DZW50ZXIgPSBub3RpZmllci5jb25zdHJ1Y3Rvci5uYW1lID09ICdOb3RpZmljYXRpb25DZW50ZXInXG4gICAgICAgICAgICAjXG4gICAgICAgICAgICBpY29uID0gcGF0aC5qb2luIF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ2ljb25zJywgJ2ljb25AOC5wbmcnXG4gICAgICAgICAgICAjIE9ubHkgZm9yIE5vdGlmaWNhdGlvbkNlbnRlciAoZGFyd2luKVxuICAgICAgICAgICAgaWYgaXNOb3RpZmljYXRpb25DZW50ZXIgJiYgdmlld3N0YXRlLnNob3dJY29uTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgY29udGVudEltYWdlID0gZml4bGluayBlbnRpdHlbY2lkXT8ucGhvdG9fdXJsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgY29udGVudEltYWdlID0gdW5kZWZpbmVkXG4gICAgICAgICAgICAjXG4gICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICB0aXRsZTogaWYgdmlld3N0YXRlLnNob3dVc2VybmFtZUluTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAhaXNOb3RpZmljYXRpb25DZW50ZXIgJiYgIXZpZXdzdGF0ZS5zaG93SWNvbk5vdGlmaWNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiI3tzZW5kZXJ9IChZYWtZYWspXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXJcbiAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1lha1lhaydcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiB0ZXh0XG4gICAgICAgICAgICAgICAgd2FpdDogdHJ1ZVxuICAgICAgICAgICAgICAgIGhpbnQ6IFwiaW50OnRyYW5zaWVudDoxXCJcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ2ltLnJlY2VpdmVkJ1xuICAgICAgICAgICAgICAgIHNlbmRlcjogJ2NvbS5naXRodWIueWFreWFrJ1xuICAgICAgICAgICAgICAgIHNvdW5kOiAhdmlld3N0YXRlLm11dGVTb3VuZE5vdGlmaWNhdGlvbiAmJiAobm90aWZpZXJTdXBwb3J0c1NvdW5kICYmICF2aWV3c3RhdGUuZm9yY2VDdXN0b21Tb3VuZClcbiAgICAgICAgICAgICAgICBpY29uOiBpY29uIGlmICFpc05vdGlmaWNhdGlvbkNlbnRlciAmJiB2aWV3c3RhdGUuc2hvd0ljb25Ob3RpZmljYXRpb25cbiAgICAgICAgICAgICAgICBjb250ZW50SW1hZ2U6IGNvbnRlbnRJbWFnZVxuICAgICAgICAgICAgLCAoZXJyLCByZXMpIC0+XG4gICAgICAgICAgICAgIGlmIHJlcz8udHJpbSgpLm1hdGNoKC9BY3RpdmF0ZS9pKVxuICAgICAgICAgICAgICAgIGFjdGlvbiAnYXBwZm9jdXMnXG4gICAgICAgICAgICAgICAgYWN0aW9uICdzZWxlY3RDb252JywgY1xuXG4gICAgICAgICAgICAjIG9ubHkgcGxheSBpZiBpdCBpcyBub3QgcGxheWluZyBhbHJlYWR5XG4gICAgICAgICAgICAjICBhbmQgbm90aWZpZXIgZG9lcyBub3Qgc3VwcG9ydCBzb3VuZCBvciBmb3JjZSBjdXN0b20gc291bmQgaXMgc2V0XG4gICAgICAgICAgICAjICBhbmQgbXV0ZSBvcHRpb24gaXMgbm90IHNldFxuICAgICAgICAgICAgaWYgKCFub3RpZmllclN1cHBvcnRzU291bmQgfHwgdmlld3N0YXRlLmZvcmNlQ3VzdG9tU291bmQpICYmICF2aWV3c3RhdGUubXV0ZVNvdW5kTm90aWZpY2F0aW9uICYmIGF1ZGlvRWwucGF1c2VkXG4gICAgICAgICAgICAgICAgYXVkaW9FbC5wbGF5KClcbiAgICAgICAgIyBpZiBub3QgbWFpbldpbmRvdy5pc1Zpc2libGUoKVxuICAgICAgICAjICAgIG1haW5XaW5kb3cuc2hvd0luYWN0aXZlKClcbiAgICAgICAgIyAgICBtYWluV2luZG93Lm1pbmltaXplKClcbiAgICAgICAgbWFpbldpbmRvdy5mbGFzaEZyYW1lKHRydWUpICMgdW5jb21tZW50ZWQgaW4gIzEyMDZcblxudGV4dE1lc3NhZ2UgPSAoY29udCwgcHJveGllZCwgc2hvd01lc3NhZ2UgPSB0cnVlKSAtPlxuICAgIGlmIGNvbnQ/LnNlZ21lbnQ/XG4gICAgICB1bmxlc3Mgc2hvd01lc3NhZ2VcbiAgICAgICAgICBpMThuLl9fKCdjb252ZXJzYXRpb24ubmV3X21lc3NhZ2U6TmV3IG1lc3NhZ2UgcmVjZWl2ZWQnKVxuICAgICAgZWxzZVxuICAgICAgICAgIHNlZ3MgPSBmb3Igc2VnLCBpIGluIGNvbnQ/LnNlZ21lbnQgPyBbXVxuICAgICAgICAgICAgICBjb250aW51ZSBpZiBwcm94aWVkIGFuZCBpIDwgMlxuICAgICAgICAgICAgICBjb250aW51ZSB1bmxlc3Mgc2VnLnRleHRcbiAgICAgICAgICAgICAgc2VnLnRleHRcbiAgICAgICAgICBzZWdzLmpvaW4oJycpXG4gICAgZWxzZSBpZiBjb250Py5hdHRhY2htZW50P1xuICAgICAgaTE4bi5fXygnY29udmVyc2F0aW9uLm5ld19hdHRhY2htZW50Ok5ldyBtZXNzYWdlIHJlY2VpdmVkIChpbWFnZSBvciB2aWRlbyknKVxuXG5vcGVuSGFuZ291dCA9IChjb252X2lkKSAtPlxuICAgIHNoZWxsLm9wZW5FeHRlcm5hbCBcImh0dHBzOi8vcGx1cy5nb29nbGUuY29tL2hhbmdvdXRzL18vQ09OVkVSU0FUSU9OLyN7Y29udl9pZH1cIlxuIl19
