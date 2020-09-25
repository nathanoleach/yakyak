(function() {
  var Client, clipboard, connection, conv, convsettings, entity, fs, insertTextAtCursor, ipc, isImg, later, mime, nameof, notify, remote, resendfocus, sendsetpresence, throttle, userinput, viewstate,
    indexOf = [].indexOf;

  Client = require('hangupsjs');

  remote = require('electron').remote;

  ipc = require('electron').ipcRenderer;

  fs = require('fs');

  mime = require('mime-types');

  clipboard = require('electron').clipboard;

  ({entity, conv, viewstate, userinput, connection, convsettings, notify} = require('./models'));

  ({insertTextAtCursor, throttle, later, isImg, nameof} = require('./util'));

  'connecting connected connect_failed'.split(' ').forEach(function(n) {
    return handle(n, function() {
      return connection.setState(n);
    });
  });

  handle('alive', function(time) {
    return connection.setLastActive(time);
  });

  handle('reqinit', function() {
    ipc.send('reqinit');
    connection.setState(connection.CONNECTING);
    return viewstate.setState(viewstate.STATE_STARTUP);
  });

  module.exports = {
    init: function({init}) {
      return action('init', init);
    }
  };

  handle('init', function(init) {
    var ref, ref1;
    // set the initial view state
    viewstate.setLoggedin(true);
    viewstate.setColorScheme(viewstate.colorScheme);
    viewstate.setFontSize(viewstate.fontSize);
    // update model from init object
    entity._initFromSelfEntity(init.self_entity);
    if (init.entities) {
      entity._initFromEntities(init.entities);
    }
    conv._initFromConvStates(init.conv_states);
    // ensure there's a selected conv
    if (!conv[viewstate.selectedConv]) {
      viewstate.setSelectedConv((ref = conv.list()) != null ? (ref1 = ref[0]) != null ? ref1.conversation_id : void 0 : void 0);
    }
    // explicit retrieval of conversation metadata
    //  this is required since #1109
    conv.list().forEach(function(el) {
      var ref2, ref3;
      if ((((ref2 = el.self_conversation_state) != null ? (ref3 = ref2.self_read_state) != null ? ref3.latest_read_timestamp : void 0 : void 0) != null) === 0) {
        return ipc.send('updateConversation', el.conversation_id.id);
      }
    });
    ipc.send('initpresence', entity.list());
    require('./version').check();
    // small delay for better experience
    return later(function() {
      return action('set_viewstate_normal');
    });
  });

  handle('set_viewstate_normal', function() {
    viewstate.setContacts(true);
    return viewstate.setState(viewstate.STATE_NORMAL);
  });

  handle('chat_message', function(ev) {
    if (entity[ev.sender_id.chat_id] == null) {
      // TODO entity is not fetched in usable time for first notification
      // if does not have user on cache
      entity.needEntity(ev.sender_id.chat_id);
    }
    // add chat to conversation
    conv.addChatMessage(ev);
    // these messages are to go through notifications
    return notify.addToNotify(ev);
  });

  handle('watermark', function(ev) {
    return conv.addWatermark(ev);
  });

  handle('presence', function(ev) {
    return entity.setPresence(ev[0][0][0][0], ev[0][0][1][1] === 1 ? true : false);
  });

  // handle 'self_presence', (ev) ->
  //     console.log 'self_presence', ev
  handle('querypresence', function(id) {
    return ipc.send('querypresence', id);
  });

  handle('setpresence', function(r) {
    var ref, ref1, ref2;
    if ((r != null ? (ref = r.presence) != null ? ref.available : void 0 : void 0) == null) {
      return console.log(`setpresence: User '${nameof(entity[r != null ? (ref1 = r.user_id) != null ? ref1.chat_id : void 0 : void 0])}' does not show his/hers/it status`, r);
    } else {
      return entity.setPresence(r.user_id.chat_id, r != null ? (ref2 = r.presence) != null ? ref2.available : void 0 : void 0);
    }
  });

  handle('update:unreadcount', function() {
    return console.log('update');
  });

  handle('addconversation', function() {
    viewstate.setState(viewstate.STATE_ADD_CONVERSATION);
    return convsettings.reset();
  });

  handle('convsettings', function() {
    var id;
    id = viewstate.selectedConv;
    if (!conv[id]) {
      return;
    }
    convsettings.reset();
    convsettings.loadConversation(conv[id]);
    return viewstate.setState(viewstate.STATE_ADD_CONVERSATION);
  });

  handle('activity', function(time) {
    return viewstate.updateActivity(time);
  });

  handle('atbottom', function(atbottom) {
    return viewstate.updateAtBottom(atbottom);
  });

  handle('attop', function(attop) {
    viewstate.updateAtTop(attop);
    return conv.updateAtTop(attop);
  });

  handle('history', function(conv_id, timestamp) {
    return ipc.send('getconversation', conv_id, timestamp, 20);
  });

  handle('handleconversationmetadata', function(r) {
    if (!r.conversation_state) {
      return;
    }
    // removing events so they don't get merged
    r.conversation_state.event = null;
    return conv.updateMetadata(r.conversation_state);
  });

  handle('handlehistory', function(r) {
    if (!r.conversation_state) {
      return;
    }
    return conv.updateHistory(r.conversation_state);
  });

  handle('selectConv', function(conv) {
    viewstate.setState(viewstate.STATE_NORMAL);
    viewstate.setSelectedConv(conv);
    return ipc.send('setfocus', viewstate.selectedConv);
  });

  handle('selectNextConv', function(offset = 1) {
    if (viewstate.state !== viewstate.STATE_NORMAL) {
      return;
    }
    viewstate.selectNextConv(offset);
    return ipc.send('setfocus', viewstate.selectedConv);
  });

  handle('selectConvIndex', function(index = 0) {
    if (viewstate.state !== viewstate.STATE_NORMAL) {
      return;
    }
    viewstate.selectConvIndex(index);
    return ipc.send('setfocus', viewstate.selectedConv);
  });

  handle('sendmessage', function(txt = '') {
    var msg;
    if (!txt.trim()) {
      return;
    }
    msg = userinput.buildChatMessage(entity.self, txt);
    ipc.send('sendchatmessage', msg);
    return conv.addChatMessagePlaceholder(entity.self.id, msg);
  });

  handle('settray', function(menu, iconPath, toolTip) {
    return ipc.invoke('tray', menu, iconPath, toolTip);
  });

  handle('destroytray', function() {
    return ipc.invoke('tray-destroy');
  });

  handle('toggleshowtray', function() {
    return viewstate.setShowTray(!viewstate.showtray);
  });

  handle('forcecustomsound', function(value) {
    return viewstate.setForceCustomSound(value);
  });

  handle('showiconnotification', function(value) {
    return viewstate.setShowIconNotification(value);
  });

  handle('mutesoundnotification', function() {
    return viewstate.setMuteSoundNotification(!viewstate.muteSoundNotification);
  });

  handle('togglemenu', function() {
    // Deprecated in electron >= 7.0.0
    return remote.Menu.getApplicationMenu().popup({});
  });

  handle('setescapeclearsinput', function(value) {
    return viewstate.setEscapeClearsInput(value);
  });

  handle('togglehidedockicon', function() {
    return viewstate.setHideDockIcon(!viewstate.hidedockicon);
  });

  handle('show-about', function() {
    viewstate.setState(viewstate.STATE_ABOUT);
    return updated('viewstate');
  });

  handle('hideWindow', function() {
    var mainWindow;
    mainWindow = remote.getCurrentWindow(); // And we hope we don't get another ;)
    return mainWindow.hide();
  });

  handle('togglewindow', function() {
    var mainWindow;
    console.log('toggle window!');
    mainWindow = remote.getCurrentWindow(); // And we hope we don't get another ;)
    if (mainWindow.isVisible()) {
      return mainWindow.hide();
    } else {
      return mainWindow.show();
    }
  });

  handle('togglecolorblind', function() {
    return viewstate.setColorblind(!viewstate.colorblind);
  });

  handle('togglestartminimizedtotray', function() {
    return viewstate.setStartMinimizedToTray(!viewstate.startminimizedtotray);
  });

  handle('toggleclosetotray', function() {
    return viewstate.setCloseToTray(!viewstate.closetotray);
  });

  handle('showwindow', function() {
    var mainWindow;
    mainWindow = remote.getCurrentWindow(); // And we hope we don't get another ;)
    return mainWindow.show();
  });

  sendsetpresence = throttle(10000, function() {
    ipc.send('setpresence');
    return ipc.send('setactiveclient', true, 15);
  });

  resendfocus = throttle(15000, function() {
    return ipc.send('setfocus', viewstate.selectedConv);
  });

  // on every keep alive signal from hangouts
  //  we inform the server that the user is still
  //  available
  handle('noop', function() {
    return sendsetpresence();
  });

  handle('lastActivity', function() {
    sendsetpresence();
    if (document.hasFocus()) {
      return resendfocus();
    }
  });

  handle('appfocus', function() {
    return ipc.send('appfocus');
  });

  handle('updatewatermark', (function() {
    var throttleWaterByConv;
    throttleWaterByConv = {};
    return function() {
      var c, conv_id, sendWater;
      conv_id = viewstate.selectedConv;
      c = conv[conv_id];
      if (!c) {
        return;
      }
      sendWater = throttleWaterByConv[conv_id];
      if (!sendWater) {
        (function(conv_id) {
          sendWater = throttle(1000, function() {
            return ipc.send('updatewatermark', conv_id, Date.now());
          });
          return throttleWaterByConv[conv_id] = sendWater;
        })(conv_id);
      }
      return sendWater();
    };
  })());

  handle('getentity', function(ids) {
    var fn;
    return (fn = function() {
      ipc.send('getentity', ids.slice(0, 5));
      ids = ids.slice(5);
      if (ids.length > 0) {
        return setTimeout(fn, 500);
      }
    })();
  });

  handle('addentities', function(es, conv_id) {
    var e, i, len, ref;
    ref = es != null ? es : [];
    for (i = 0, len = ref.length; i < len; i++) {
      e = ref[i];
      entity.add(e);
    }
    if (conv_id) { // auto-add these ppl to a conv
      (es != null ? es : []).forEach(function(p) {
        return conv.addParticipant(conv_id, p);
      });
      viewstate.setState(viewstate.STATE_NORMAL);
    }
    // flag to show that contacts are loaded
    return viewstate.setContacts(true);
  });

  handle('uploadimage', function(files) {
    var _, client_generated_id, conv_id, element, ext, file, i, len, msg, ref, ref1;
    // this may change during upload
    conv_id = viewstate.selectedConv;
    // sense check that client is in good state
    if (!(viewstate.state === viewstate.STATE_NORMAL && conv[conv_id])) {
      // clear value for upload image input
      document.getElementById('attachFile').value = '';
      return;
    }
    // if only one file is selected, then it shows as preview before sending
    //  otherwise, it will upload all of them immediatly
    if (files.length === 1) {
      file = files[0];
      element = document.getElementById('preview-img');
      // show error message and return if is not an image
      if (isImg(file.path)) {
        // store image in preview-container and open it
        //  I think it is better to embed than reference path as user should
        //   see exactly what he is sending. (using the path would require
        //   polling)
        fs.readFile(file.path, function(err, original_data) {
          var base64Image, binaryImage, mimeType;
          binaryImage = Buffer.from(original_data, 'binary');
          base64Image = binaryImage.toString('base64');
          mimeType = mime.lookup(file.path);
          element.src = 'data:' + mimeType + ';base64,' + base64Image;
          return document.querySelector('#preview-container').classList.add('open');
        });
      } else {
        [_, ext] = (ref = file.path.match(/.*(\.\w+)$/)) != null ? ref : [];
        notr(`Ignoring file of type ${ext}`);
      }
    } else {
      for (i = 0, len = files.length; i < len; i++) {
        file = files[i];
        // only images please
        if (!isImg(file.path)) {
          [_, ext] = (ref1 = file.path.match(/.*(\.\w+)$/)) != null ? ref1 : [];
          notr(`Ignoring file of type ${ext}`);
          continue;
        }
        // message for a placeholder
        msg = userinput.buildChatMessage(entity.self, 'uploading image…');
        msg.uploadimage = true;
        ({client_generated_id} = msg);
        // add a placeholder for the image
        conv.addChatMessagePlaceholder(entity.self.id, msg);
        // and begin upload
        ipc.send('uploadimage', {
          path: file.path,
          conv_id,
          client_generated_id
        });
      }
    }
    // clear value for upload image input
    return document.getElementById('attachFile').value = '';
  });

  handle('onpasteimage', function() {
    var element;
    element = document.getElementById('preview-img');
    element.src = clipboard.readImage().toDataURL();
    element.src = element.src.replace(/image\/png/, 'image/gif');
    return document.querySelector('#preview-container').classList.add('open');
  });

  handle('uploadpreviewimage', function() {
    var client_generated_id, conv_id, element, msg, pngData;
    conv_id = viewstate.selectedConv;
    if (!conv_id) {
      return;
    }
    msg = userinput.buildChatMessage(entity.self, 'uploading image…');
    msg.uploadimage = true;
    ({client_generated_id} = msg);
    conv.addChatMessagePlaceholder(entity.self.id, msg);
    // find preview element
    element = document.getElementById('preview-img');
    // build image from what is on preview
    pngData = element.src.replace(/data:image\/(png|jpe?g|gif|svg);base64,/, '');
    pngData = Buffer.from(pngData, 'base64');
    document.querySelector('#preview-container').classList.remove('open');
    document.querySelector('#emoji-container').classList.remove('open');
    element.src = '';
    
    return ipc.send('uploadclipboardimage', {pngData, conv_id, client_generated_id});
  });

  handle('uploadingimage', function(spec) {});

  // XXX this doesn't look very good because the image
  // shows, then flickers away before the real is loaded
  // from the upload.
  //conv.updatePlaceholderImage spec
  handle('leftresize', function(size) {
    return viewstate.setLeftSize(size);
  });

  handle('resize', function(dim) {
    return viewstate.setSize(dim);
  });

  handle('move', function(pos) {
    return viewstate.setPosition(pos);
  });

  handle('conversationname', function(name) {
    return convsettings.setName(name);
  });

  handle('conversationquery', function(query) {
    return convsettings.setSearchQuery(query);
  });

  handle('searchentities', function(query, max_results) {
    return ipc.send('searchentities', query, max_results);
  });

  handle('setsearchedentities', function(r) {
    return convsettings.setSearchedEntities(r);
  });

  handle('selectentity', function(e) {
    return convsettings.addSelectedEntity(e);
  });

  handle('deselectentity', function(e) {
    return convsettings.removeSelectedEntity(e);
  });

  handle('togglegroup', function(e) {
    return convsettings.setGroup(!convsettings.group);
  });

  handle('saveconversation', function() {
    var c, conv_id, current, e, id, name, needsRename, one_to_one, p, recreate, ref, selected, toadd;
    viewstate.setState(viewstate.STATE_NORMAL);
    conv_id = convsettings.id;
    c = conv[conv_id];
    one_to_one = (c != null ? (ref = c.type) != null ? ref.indexOf('ONE_TO_ONE') : void 0 : void 0) >= 0;
    selected = (function() {
      var i, len, ref1, results;
      ref1 = convsettings.selectedEntities;
      results = [];
      for (i = 0, len = ref1.length; i < len; i++) {
        e = ref1[i];
        results.push(e.id.chat_id);
      }
      return results;
    })();
    recreate = conv_id && one_to_one && convsettings.group;
    needsRename = convsettings.group && convsettings.name && convsettings.name !== (c != null ? c.name : void 0);
    // remember: we don't rename one_to_ones, google web client does not do it
    if (!conv_id || recreate) {
      name = (convsettings.group ? convsettings.name : void 0) || "";
      ipc.send('createconversation', selected, name, convsettings.group);
      return;
    }
    p = c.participant_data;
    current = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = p.length; i < len; i++) {
        c = p[i];
        if (!entity.isSelf(c.id.chat_id)) {
          results.push(c.id.chat_id);
        }
      }
      return results;
    })();
    toadd = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = selected.length; i < len; i++) {
        id = selected[i];
        if (indexOf.call(current, id) < 0) {
          results.push(id);
        }
      }
      return results;
    })();
    if (toadd.length) {
      ipc.send('adduser', conv_id, toadd);
    }
    if (needsRename) {
      return ipc.send('renameconversation', conv_id, convsettings.name);
    }
  });

  handle('conversation_rename', function(c) {
    conv.rename(c, c.conversation_rename.new_name);
    return conv.addChatMessage(c);
  });

  handle('membership_change', function(e) {
    var conv_id, id, ids, ref;
    conv_id = e.conversation_id.id;
    ids = (function() {
      var i, len, ref, results;
      ref = e.membership_change.participant_ids;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        id = ref[i];
        results.push(id.chat_id || id.gaia_id);
      }
      return results;
    })();
    if (e.membership_change.type === 'LEAVE') {
      if (ref = entity.self.id, indexOf.call(ids, ref) >= 0) {
        return conv.deleteConv(conv_id);
      }
      return conv.removeParticipants(conv_id, ids);
    }
    conv.addChatMessage(e);
    return ipc.send('getentity', ids, {
      add_to_conv: conv_id
    });
  });

  handle('createconversationdone', function(c) {
    convsettings.reset();
    conv.add(c);
    return viewstate.setSelectedConv(c.id.id);
  });

  handle('notification_level', function(n) {
    var conv_id, level, ref;
    conv_id = n != null ? (ref = n[0]) != null ? ref[0] : void 0 : void 0;
    level = (n != null ? n[1] : void 0) === 10 ? 'QUIET' : 'RING';
    if (conv_id && level) {
      return conv.setNotificationLevel(conv_id, level);
    }
  });

  handle('togglenotif', function() {
    var QUIET, RING, c, conv_id, q;
    ({QUIET, RING} = Client.NotificationLevel);
    conv_id = viewstate.selectedConv;
    if (!(c = conv[conv_id])) {
      return;
    }
    q = conv.isQuiet(c);
    ipc.send('setconversationnotificationlevel', conv_id, (q ? RING : QUIET));
    return conv.setNotificationLevel(conv_id, (q ? 'RING' : 'QUIET'));
  });

  handle('togglestar', function() {
    var c, conv_id;
    conv_id = viewstate.selectedConv;
    if (!(c = conv[conv_id])) {
      return;
    }
    return conv.toggleStar(c);
  });

  handle('delete', function(a) {
    var c, conv_id, ref;
    conv_id = a != null ? (ref = a[0]) != null ? ref[0] : void 0 : void 0;
    if (!(c = conv[conv_id])) {
      return;
    }
    return conv.deleteConv(conv_id);
  });

  handle('setspellchecklanguage', function(language) {
    return viewstate.setSpellCheckLanguage(language, remote.getCurrentWindow());
  });

  
  // Change language in YakYak

  handle('changelanguage', function(language) {
    if (i18n.getLocales().includes(viewstate.language)) {
      ipc.send('seti18n', null, language);
      return viewstate.setLanguage(language);
    }
  });

  handle('deleteconv', function(confirmed) {
    var conv_id;
    conv_id = viewstate.selectedConv;
    if (!confirmed) {
      return later(function() {
        if (confirm(i18n.__('conversation.delete_confirm:Really delete conversation?'))) {
          return action('deleteconv', true);
        }
      });
    } else {
      ipc.send('deleteconversation', conv_id);
      viewstate.selectConvIndex(0);
      return viewstate.setState(viewstate.STATE_NORMAL);
    }
  });

  handle('leaveconv', function(confirmed) {
    var conv_id;
    conv_id = viewstate.selectedConv;
    if (!confirmed) {
      return later(function() {
        if (confirm(i18n.__('conversation.leave_confirm:Really leave conversation?'))) {
          return action('leaveconv', true);
        }
      });
    } else {
      ipc.send('removeuser', conv_id);
      viewstate.selectConvIndex(0);
      return viewstate.setState(viewstate.STATE_NORMAL);
    }
  });

  handle('lastkeydown', function(time) {
    return viewstate.setLastKeyDown(time);
  });

  handle('settyping', function(v) {
    var conv_id;
    conv_id = viewstate.selectedConv;
    if (!(conv_id && viewstate.state === viewstate.STATE_NORMAL)) {
      return;
    }
    ipc.send('settyping', conv_id, v);
    return viewstate.setState(viewstate.STATE_NORMAL);
  });

  handle('typing', function(t) {
    return conv.addTyping(t);
  });

  handle('pruneTyping', function(conv_id) {
    return conv.pruneTyping(conv_id);
  });

  handle('syncallnewevents', throttle(10000, function(time) {
    if (!time) {
      return;
    }
    return ipc.send('syncallnewevents', time);
  }));

  handle('handlesyncedevents', function(r) {
    var e, i, j, len, len1, ref, ref1, st, states;
    states = r != null ? r.conversation_state : void 0;
    if (!(states != null ? states.length : void 0)) {
      return;
    }
    for (i = 0, len = states.length; i < len; i++) {
      st = states[i];
      ref1 = (ref = st != null ? st.event : void 0) != null ? ref : [];
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        e = ref1[j];
        conv.addChatMessage(e);
      }
    }
    return connection.setEventState(connection.IN_SYNC);
  });

  handle('syncrecentconversations', throttle(10000, function() {
    return ipc.send('syncrecentconversations');
  }));

  handle('handlerecentconversations', function(r) {
    var st;
    if (!(st = r.conversation_state)) {
      return;
    }
    conv.replaceFromStates(st);
    return connection.setEventState(connection.IN_SYNC);
  });

  handle('client_conversation', function(c) {
    // Conversation must be added, even if already exists
    //  why? because when a new chat message for a new conversation appears
    //  a skeleton is made of a conversation
    return conv.add(c); // unless conv[c?.conversation_id?.id]?.participant_data?
  });

  // commented unless condition, as it was preventing yakyak reacting to client_conversations events
  //  from server
  handle('hangout_event', function(e) {
    var ref, ref1;
    if ((ref = e != null ? (ref1 = e.hangout_event) != null ? ref1.event_type : void 0 : void 0) !== 'START_HANGOUT' && ref !== 'END_HANGOUT') {
      return;
    }
    // trigger notifications for this
    return notify.addToNotify(e);
  });

  'reply_to_invite settings conversation_notification invitation_watermark'.split(' ').forEach(function(n) {
    return handle(n, function(...as) {
      return console.log(n, ...as);
    });
  });

  handle('unreadtotal', function(total, orMore) {
    var value;
    value = "";
    if (total > 0) {
      value = total + (orMore ? "+" : "");
    }
    updated('conv_count');
    return ipc.send('updatebadge', value);
  });

  handle('showconvmin', function(doshow) {
    return viewstate.setShowConvMin(doshow);
  });

  handle('setusesystemdateformat', function(val) {
    return viewstate.setUseSystemDateFormat(val);
  });

  handle('showconvthumbs', function(doshow) {
    return viewstate.setShowConvThumbs(doshow);
  });

  handle('showanimatedthumbs', function(doshow) {
    return viewstate.setShowAnimatedThumbs(doshow);
  });

  handle('showconvtime', function(doshow) {
    return viewstate.setShowConvTime(doshow);
  });

  handle('showconvlast', function(doshow) {
    return viewstate.setShowConvLast(doshow);
  });

  handle('togglepopupnotifications', function() {
    console.log('toggle popupnotifications');
    return viewstate.setShowPopUpNotifications(!viewstate.showPopUpNotifications);
  });

  handle('showpopupnotifications', function(doshow) {
    return viewstate.setShowPopUpNotifications(doshow);
  });

  handle('showmessageinnotification', function(doshow) {
    return viewstate.setShowMessageInNotification(doshow);
  });

  handle('showusernameinnotification', function(doshow) {
    return viewstate.setShowUsernameInNotification(doshow);
  });

  handle('convertemoji', function(doshow) {
    return viewstate.setConvertEmoji(doshow);
  });

  handle('suggestemoji', function(doshow) {
    return viewstate.setSuggestEmoji(doshow);
  });

  handle('showimagepreview', function(doshow) {
    return viewstate.setshowImagePreview(doshow);
  });

  handle('changetheme', function(colorscheme) {
    return viewstate.setColorScheme(colorscheme);
  });

  handle('changefontsize', function(fontsize) {
    return viewstate.setFontSize(fontsize);
  });

  handle('devtools', function() {
    return remote.getCurrentWindow().openDevTools({
      detach: true
    });
  });

  handle('quit', function() {
    return ipc.send('quit');
  });

  handle('togglefullscreen', function() {
    return ipc.send('togglefullscreen');
  });

  handle('zoom', function(step) {
    if (step != null) {
      return viewstate.setZoom((parseFloat(document.body.style.zoom.replace(',', '.')) || 1.0) + step);
    }
    return viewstate.setZoom(1);
  });

  handle('logout', function() {
    return ipc.send('logout');
  });

  handle('wonline', function(wonline) {
    connection.setWindowOnline(wonline);
    if (wonline) {
      return ipc.send('hangupsConnect');
    } else {
      return ipc.send('hangupsDisconnect');
    }
  });

  handle('openonsystemstartup', function(open) {
    return viewstate.setOpenOnSystemStartup(open);
  });

  handle('initopenonsystemstartup', function(isEnabled) {
    return viewstate.initOpenOnSystemStartup(isEnabled);
  });

  handle('minimize', function() {
    var mainWindow;
    mainWindow = remote.getCurrentWindow();
    return mainWindow.minimize();
  });

  handle('resizewindow', function() {
    var mainWindow;
    mainWindow = remote.getCurrentWindow();
    if (mainWindow.isMaximized()) {
      return mainWindow.unmaximize();
    } else {
      return mainWindow.maximize();
    }
  });

  handle('close', function() {
    var mainWindow;
    mainWindow = remote.getCurrentWindow();
    return mainWindow.close();
  });

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvZGlzcGF0Y2hlci5qcyIsInNvdXJjZXMiOlsidWkvZGlzcGF0Y2hlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLE1BQUEsRUFBQSxTQUFBLEVBQUEsVUFBQSxFQUFBLElBQUEsRUFBQSxZQUFBLEVBQUEsTUFBQSxFQUFBLEVBQUEsRUFBQSxrQkFBQSxFQUFBLEdBQUEsRUFBQSxLQUFBLEVBQUEsS0FBQSxFQUFBLElBQUEsRUFBQSxNQUFBLEVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxXQUFBLEVBQUEsZUFBQSxFQUFBLFFBQUEsRUFBQSxTQUFBLEVBQUEsU0FBQTtJQUFBOztFQUFBLE1BQUEsR0FBUyxPQUFBLENBQVEsV0FBUjs7RUFDVCxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDN0IsR0FBQSxHQUFTLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBRzdCLEVBQUEsR0FBSyxPQUFBLENBQVEsSUFBUjs7RUFDTCxJQUFBLEdBQU8sT0FBQSxDQUFRLFlBQVI7O0VBRVAsU0FBQSxHQUFZLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBRWhDLENBQUEsQ0FBQyxNQUFELEVBQVMsSUFBVCxFQUFlLFNBQWYsRUFBMEIsU0FBMUIsRUFBcUMsVUFBckMsRUFBaUQsWUFBakQsRUFBK0QsTUFBL0QsQ0FBQSxHQUF5RSxPQUFBLENBQVEsVUFBUixDQUF6RTs7RUFDQSxDQUFBLENBQUMsa0JBQUQsRUFBcUIsUUFBckIsRUFBK0IsS0FBL0IsRUFBc0MsS0FBdEMsRUFBNkMsTUFBN0MsQ0FBQSxHQUF1RCxPQUFBLENBQVEsUUFBUixDQUF2RDs7RUFFQSxxQ0FBcUMsQ0FBQyxLQUF0QyxDQUE0QyxHQUE1QyxDQUFnRCxDQUFDLE9BQWpELENBQXlELFFBQUEsQ0FBQyxDQUFELENBQUE7V0FDckQsTUFBQSxDQUFPLENBQVAsRUFBVSxRQUFBLENBQUEsQ0FBQTthQUFHLFVBQVUsQ0FBQyxRQUFYLENB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QUZlLENBQW5COztFQUlBLE1BQUEsQ0FBTyxjQUFQLEVBQXVCLFFBQUEsQ0FBQSxDQUFBO0FBQ3ZCLFFBQUE7SUFBSSxVQUFBLEdBQWEsTUFBTSxDQUFDLGdCQUFQLENBQUE7SUFDYixJQUFHLFVBQVUsQ0FBQyxXQUFYLENBQUEsQ0FBSDthQUFpQyxVQUFVLENBQUMsVUFBWCxDQUFBLEVBQWpDO0tBQUEsTUFBQTthQUE4RCxVQUFVLENBQUMsUUFBWCxDQUFBLEVBQTlEOztFQUZtQixDQUF2Qjs7RUFJQSxNQUFBLENBQU8sT0FBUCxFQUFnQixRQUFBLENBQUEsQ0FBQTtBQUNoQixRQUFBO0lBQUksVUFBQSxHQUFhLE1BQU0sQ0FBQyxnQkFBUCxDQUFBO1dBQ2IsVUFBVSxDQUFDLEtBQVgsQ0FBQTtFQUZZLENBQWhCO0FBdmpCQSIsInNvdXJjZXNDb250ZW50IjpbIkNsaWVudCA9IHJlcXVpcmUgJ2hhbmd1cHNqcydcbnJlbW90ZSA9IHJlcXVpcmUoJ2VsZWN0cm9uJykucmVtb3RlXG5pcGMgICAgPSByZXF1aXJlKCdlbGVjdHJvbicpLmlwY1JlbmRlcmVyXG5cblxuZnMgPSByZXF1aXJlKCdmcycpXG5taW1lID0gcmVxdWlyZSgnbWltZS10eXBlcycpXG5cbmNsaXBib2FyZCA9IHJlcXVpcmUoJ2VsZWN0cm9uJykuY2xpcGJvYXJkXG5cbntlbnRpdHksIGNvbnYsIHZpZXdzdGF0ZSwgdXNlcmlucHV0LCBjb25uZWN0aW9uLCBjb252c2V0dGluZ3MsIG5vdGlmeX0gPSByZXF1aXJlICcuL21vZGVscydcbntpbnNlcnRUZXh0QXRDdXJzb3IsIHRocm90dGxlLCBsYXRlciwgaXNJbWcsIG5hbWVvZn0gPSByZXF1aXJlICcuL3V0aWwnXG5cbidjb25uZWN0aW5nIGNvbm5lY3RlZCBjb25uZWN0X2ZhaWxlZCcuc3BsaXQoJyAnKS5mb3JFYWNoIChuKSAtPlxuICAgIGhhbmRsZSBuLCAtPiBjb25uZWN0aW9uLnNldFN0YXRlIG5cblxuaGFuZGxlICdhbGl2ZScsICh0aW1lKSAtPiBjb25uZWN0aW9uLnNldExhc3RBY3RpdmUgdGltZVxuXG5oYW5kbGUgJ3JlcWluaXQnLCAtPlxuICAgIGlwYy5zZW5kICdyZXFpbml0J1xuICAgIGNvbm5lY3Rpb24uc2V0U3RhdGUgY29ubmVjdGlvbi5DT05ORUNUSU5HXG4gICAgdmlld3N0YXRlLnNldFN0YXRlIHZpZXdzdGF0ZS5TVEFURV9TVEFSVFVQXG5cbm1vZHVsZS5leHBvcnRzID1cbiAgICBpbml0OiAoe2luaXR9KSAtPiBhY3Rpb24gJ2luaXQnLCBpbml0XG5cbmhhbmRsZSAnaW5pdCcsIChpbml0KSAtPlxuICAgICMgc2V0IHRoZSBpbml0aWFsIHZpZXcgc3RhdGVcbiAgICB2aWV3c3RhdGUuc2V0TG9nZ2VkaW4gdHJ1ZVxuXG4gICAgdmlld3N0YXRlLnNldENvbG9yU2NoZW1lIHZpZXdzdGF0ZS5jb2xvclNjaGVtZVxuICAgIHZpZXdzdGF0ZS5zZXRGb250U2l6ZSB2aWV3c3RhdGUuZm9udFNpemVcblxuICAgICMgdXBkYXRlIG1vZGVsIGZyb20gaW5pdCBvYmplY3RcbiAgICBlbnRpdHkuX2luaXRGcm9tU2VsZkVudGl0eSBpbml0LnNlbGZfZW50aXR5XG4gICAgZW50aXR5Ll9pbml0RnJvbUVudGl0aWVzIGluaXQuZW50aXRpZXMgaWYgaW5pdC5lbnRpdGllc1xuICAgIGNvbnYuX2luaXRGcm9tQ29udlN0YXRlcyBpbml0LmNvbnZfc3RhdGVzXG4gICAgIyBlbnN1cmUgdGhlcmUncyBhIHNlbGVjdGVkIGNvbnZcbiAgICB1bmxlc3MgY29udlt2aWV3c3RhdGUuc2VsZWN0ZWRDb252XVxuICAgICAgICB2aWV3c3RhdGUuc2V0U2VsZWN0ZWRDb252IGNvbnYubGlzdCgpP1swXT8uY29udmVyc2F0aW9uX2lkXG5cbiAgICAjIGV4cGxpY2l0IHJldHJpZXZhbCBvZiBjb252ZXJzYXRpb24gbWV0YWRhdGFcbiAgICAjICB0aGlzIGlzIHJlcXVpcmVkIHNpbmNlICMxMTA5XG4gICAgY29udi5saXN0KCkuZm9yRWFjaCAoZWwpIC0+XG4gICAgICAgIGlmIGVsLnNlbGZfY29udmVyc2F0aW9uX3N0YXRlPy5zZWxmX3JlYWRfc3RhdGU/LmxhdGVzdF9yZWFkX3RpbWVzdGFtcD8gPT0gMFxuICAgICAgICAgICAgICBpcGMuc2VuZCAndXBkYXRlQ29udmVyc2F0aW9uJywgZWwuY29udmVyc2F0aW9uX2lkLmlkXG5cbiAgICBpcGMuc2VuZCAnaW5pdHByZXNlbmNlJywgZW50aXR5Lmxpc3QoKVxuXG4gICAgcmVxdWlyZSgnLi92ZXJzaW9uJykuY2hlY2soKVxuXG4gICAgIyBzbWFsbCBkZWxheSBmb3IgYmV0dGVyIGV4cGVyaWVuY2VcbiAgICBsYXRlciAtPiBhY3Rpb24gJ3NldF92aWV3c3RhdGVfbm9ybWFsJ1xuXG5oYW5kbGUgJ3NldF92aWV3c3RhdGVfbm9ybWFsJywgLT5cbiAgICB2aWV3c3RhdGUuc2V0Q29udGFjdHMgdHJ1ZVxuICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfTk9STUFMXG5cbmhhbmRsZSAnY2hhdF9tZXNzYWdlJywgKGV2KSAtPlxuICAgICMgVE9ETyBlbnRpdHkgaXMgbm90IGZldGNoZWQgaW4gdXNhYmxlIHRpbWUgZm9yIGZpcnN0IG5vdGlmaWNhdGlvblxuICAgICMgaWYgZG9lcyBub3QgaGF2ZSB1c2VyIG9uIGNhY2hlXG4gICAgZW50aXR5Lm5lZWRFbnRpdHkgZXYuc2VuZGVyX2lkLmNoYXRfaWQgdW5sZXNzIGVudGl0eVtldi5zZW5kZXJfaWQuY2hhdF9pZF0/XG4gICAgIyBhZGQgY2hhdCB0byBjb252ZXJzYXRpb25cbiAgICBjb252LmFkZENoYXRNZXNzYWdlIGV2XG4gICAgIyB0aGVzZSBtZXNzYWdlcyBhcmUgdG8gZ28gdGhyb3VnaCBub3RpZmljYXRpb25zXG4gICAgbm90aWZ5LmFkZFRvTm90aWZ5IGV2XG5cbmhhbmRsZSAnd2F0ZXJtYXJrJywgKGV2KSAtPlxuICAgIGNvbnYuYWRkV2F0ZXJtYXJrIGV2XG5cbmhhbmRsZSAncHJlc2VuY2UnLCAoZXYpIC0+XG4gICAgZW50aXR5LnNldFByZXNlbmNlIGV2WzBdWzBdWzBdWzBdLCBpZiBldlswXVswXVsxXVsxXSA9PSAxIHRoZW4gdHJ1ZSBlbHNlIGZhbHNlXG5cbiMgaGFuZGxlICdzZWxmX3ByZXNlbmNlJywgKGV2KSAtPlxuIyAgICAgY29uc29sZS5sb2cgJ3NlbGZfcHJlc2VuY2UnLCBldlxuXG5oYW5kbGUgJ3F1ZXJ5cHJlc2VuY2UnLCAoaWQpIC0+XG4gICAgaXBjLnNlbmQgJ3F1ZXJ5cHJlc2VuY2UnLCBpZFxuXG5oYW5kbGUgJ3NldHByZXNlbmNlJywgKHIpIC0+XG4gICAgaWYgbm90IHI/LnByZXNlbmNlPy5hdmFpbGFibGU/XG4gICAgICAgIGNvbnNvbGUubG9nIFwic2V0cHJlc2VuY2U6IFVzZXIgJyN7bmFtZW9mIGVudGl0eVtyPy51c2VyX2lkPy5jaGF0X2lkXX0nIGRvZXMgbm90IHNob3cgaGlzL2hlcnMvaXQgc3RhdHVzXCIsIHJcbiAgICBlbHNlXG4gICAgICAgIGVudGl0eS5zZXRQcmVzZW5jZSByLnVzZXJfaWQuY2hhdF9pZCwgcj8ucHJlc2VuY2U/LmF2YWlsYWJsZVxuXG5oYW5kbGUgJ3VwZGF0ZTp1bnJlYWRjb3VudCcsIC0+XG4gICAgY29uc29sZS5sb2cgJ3VwZGF0ZSdcblxuaGFuZGxlICdhZGRjb252ZXJzYXRpb24nLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfQUREX0NPTlZFUlNBVElPTlxuICAgIGNvbnZzZXR0aW5ncy5yZXNldCgpXG5cbmhhbmRsZSAnY29udnNldHRpbmdzJywgLT5cbiAgICBpZCA9IHZpZXdzdGF0ZS5zZWxlY3RlZENvbnZcbiAgICByZXR1cm4gdW5sZXNzIGNvbnZbaWRdXG4gICAgY29udnNldHRpbmdzLnJlc2V0KClcbiAgICBjb252c2V0dGluZ3MubG9hZENvbnZlcnNhdGlvbiBjb252W2lkXVxuICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfQUREX0NPTlZFUlNBVElPTlxuXG5oYW5kbGUgJ2FjdGl2aXR5JywgKHRpbWUpIC0+XG4gICAgdmlld3N0YXRlLnVwZGF0ZUFjdGl2aXR5IHRpbWVcblxuaGFuZGxlICdhdGJvdHRvbScsIChhdGJvdHRvbSkgLT5cbiAgICB2aWV3c3RhdGUudXBkYXRlQXRCb3R0b20gYXRib3R0b21cblxuaGFuZGxlICdhdHRvcCcsIChhdHRvcCkgLT5cbiAgICB2aWV3c3RhdGUudXBkYXRlQXRUb3AgYXR0b3BcbiAgICBjb252LnVwZGF0ZUF0VG9wIGF0dG9wXG5cbmhhbmRsZSAnaGlzdG9yeScsIChjb252X2lkLCB0aW1lc3RhbXApIC0+XG4gICAgaXBjLnNlbmQgJ2dldGNvbnZlcnNhdGlvbicsIGNvbnZfaWQsIHRpbWVzdGFtcCwgMjBcblxuaGFuZGxlICdoYW5kbGVjb252ZXJzYXRpb25tZXRhZGF0YScsIChyKSAtPlxuICAgIHJldHVybiB1bmxlc3Mgci5jb252ZXJzYXRpb25fc3RhdGVcbiAgICAjIHJlbW92aW5nIGV2ZW50cyBzbyB0aGV5IGRvbid0IGdldCBtZXJnZWRcbiAgICByLmNvbnZlcnNhdGlvbl9zdGF0ZS5ldmVudCA9IG51bGxcbiAgICBjb252LnVwZGF0ZU1ldGFkYXRhIHIuY29udmVyc2F0aW9uX3N0YXRlXG5cbmhhbmRsZSAnaGFuZGxlaGlzdG9yeScsIChyKSAtPlxuICAgIHJldHVybiB1bmxlc3Mgci5jb252ZXJzYXRpb25fc3RhdGVcbiAgICBjb252LnVwZGF0ZUhpc3Rvcnkgci5jb252ZXJzYXRpb25fc3RhdGVcblxuaGFuZGxlICdzZWxlY3RDb252JywgKGNvbnYpIC0+XG4gICAgdmlld3N0YXRlLnNldFN0YXRlIHZpZXdzdGF0ZS5TVEFURV9OT1JNQUxcbiAgICB2aWV3c3RhdGUuc2V0U2VsZWN0ZWRDb252IGNvbnZcbiAgICBpcGMuc2VuZCAnc2V0Zm9jdXMnLCB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG5cbmhhbmRsZSAnc2VsZWN0TmV4dENvbnYnLCAob2Zmc2V0ID0gMSkgLT5cbiAgICBpZiB2aWV3c3RhdGUuc3RhdGUgIT0gdmlld3N0YXRlLlNUQVRFX05PUk1BTCB0aGVuIHJldHVyblxuICAgIHZpZXdzdGF0ZS5zZWxlY3ROZXh0Q29udiBvZmZzZXRcbiAgICBpcGMuc2VuZCAnc2V0Zm9jdXMnLCB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG5cbmhhbmRsZSAnc2VsZWN0Q29udkluZGV4JywgKGluZGV4ID0gMCkgLT5cbiAgICBpZiB2aWV3c3RhdGUuc3RhdGUgIT0gdmlld3N0YXRlLlNUQVRFX05PUk1BTCB0aGVuIHJldHVyblxuICAgIHZpZXdzdGF0ZS5zZWxlY3RDb252SW5kZXggaW5kZXhcbiAgICBpcGMuc2VuZCAnc2V0Zm9jdXMnLCB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG5cbmhhbmRsZSAnc2VuZG1lc3NhZ2UnLCAodHh0ID0gJycpIC0+XG4gICAgaWYgIXR4dC50cmltKCkgdGhlbiByZXR1cm5cbiAgICBtc2cgPSB1c2VyaW5wdXQuYnVpbGRDaGF0TWVzc2FnZSBlbnRpdHkuc2VsZiwgdHh0XG4gICAgaXBjLnNlbmQgJ3NlbmRjaGF0bWVzc2FnZScsIG1zZ1xuICAgIGNvbnYuYWRkQ2hhdE1lc3NhZ2VQbGFjZWhvbGRlciBlbnRpdHkuc2VsZi5pZCwgbXNnXG5cbmhhbmRsZSAnc2V0dHJheScsIChtZW51LCBpY29uUGF0aCwgdG9vbFRpcCktPlxuICAgIGlwYy5pbnZva2UgJ3RyYXknLCBtZW51LCBpY29uUGF0aCwgdG9vbFRpcFxuXG5oYW5kbGUgJ2Rlc3Ryb3l0cmF5JywgLT5cbiAgICBpcGMuaW52b2tlICd0cmF5LWRlc3Ryb3knXG5cbmhhbmRsZSAndG9nZ2xlc2hvd3RyYXknLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTaG93VHJheShub3Qgdmlld3N0YXRlLnNob3d0cmF5KVxuXG5oYW5kbGUgJ2ZvcmNlY3VzdG9tc291bmQnLCAodmFsdWUpIC0+XG4gICAgdmlld3N0YXRlLnNldEZvcmNlQ3VzdG9tU291bmQodmFsdWUpXG5cbmhhbmRsZSAnc2hvd2ljb25ub3RpZmljYXRpb24nLCAodmFsdWUpIC0+XG4gICAgdmlld3N0YXRlLnNldFNob3dJY29uTm90aWZpY2F0aW9uKHZhbHVlKVxuXG5oYW5kbGUgJ211dGVzb3VuZG5vdGlmaWNhdGlvbicsIC0+XG4gICAgdmlld3N0YXRlLnNldE11dGVTb3VuZE5vdGlmaWNhdGlvbihub3Qgdmlld3N0YXRlLm11dGVTb3VuZE5vdGlmaWNhdGlvbilcblxuaGFuZGxlICd0b2dnbGVtZW51JywgLT5cbiAgICAjIERlcHJlY2F0ZWQgaW4gZWxlY3Ryb24gPj0gNy4wLjBcbiAgICByZW1vdGUuTWVudS5nZXRBcHBsaWNhdGlvbk1lbnUoKS5wb3B1cCh7fSlcblxuaGFuZGxlICdzZXRlc2NhcGVjbGVhcnNpbnB1dCcsICh2YWx1ZSkgLT5cbiAgICB2aWV3c3RhdGUuc2V0RXNjYXBlQ2xlYXJzSW5wdXQodmFsdWUpXG5cbmhhbmRsZSAndG9nZ2xlaGlkZWRvY2tpY29uJywgLT5cbiAgICB2aWV3c3RhdGUuc2V0SGlkZURvY2tJY29uKG5vdCB2aWV3c3RhdGUuaGlkZWRvY2tpY29uKVxuXG5oYW5kbGUgJ3Nob3ctYWJvdXQnLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfQUJPVVRcbiAgICB1cGRhdGVkICd2aWV3c3RhdGUnXG5cbmhhbmRsZSAnaGlkZVdpbmRvdycsIC0+XG4gICAgbWFpbldpbmRvdyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KCkgIyBBbmQgd2UgaG9wZSB3ZSBkb24ndCBnZXQgYW5vdGhlciA7KVxuICAgIG1haW5XaW5kb3cuaGlkZSgpXG5cbmhhbmRsZSAndG9nZ2xld2luZG93JywgLT5cbiAgICBjb25zb2xlLmxvZygndG9nZ2xlIHdpbmRvdyEnKVxuICAgIG1haW5XaW5kb3cgPSByZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpICMgQW5kIHdlIGhvcGUgd2UgZG9uJ3QgZ2V0IGFub3RoZXIgOylcbiAgICBpZiBtYWluV2luZG93LmlzVmlzaWJsZSgpIHRoZW4gbWFpbldpbmRvdy5oaWRlKCkgZWxzZSBtYWluV2luZG93LnNob3coKVxuXG5oYW5kbGUgJ3RvZ2dsZWNvbG9yYmxpbmQnLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRDb2xvcmJsaW5kKG5vdCB2aWV3c3RhdGUuY29sb3JibGluZClcblxuaGFuZGxlICd0b2dnbGVzdGFydG1pbmltaXplZHRvdHJheScsIC0+XG4gICAgdmlld3N0YXRlLnNldFN0YXJ0TWluaW1pemVkVG9UcmF5KG5vdCB2aWV3c3RhdGUuc3RhcnRtaW5pbWl6ZWR0b3RyYXkpXG5cbmhhbmRsZSAndG9nZ2xlY2xvc2V0b3RyYXknLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRDbG9zZVRvVHJheShub3Qgdmlld3N0YXRlLmNsb3NldG90cmF5KVxuXG5oYW5kbGUgJ3Nob3d3aW5kb3cnLCAtPlxuICAgIG1haW5XaW5kb3cgPSByZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpICMgQW5kIHdlIGhvcGUgd2UgZG9uJ3QgZ2V0IGFub3RoZXIgOylcbiAgICBtYWluV2luZG93LnNob3coKVxuXG5zZW5kc2V0cHJlc2VuY2UgPSB0aHJvdHRsZSAxMDAwMCwgLT5cbiAgICBpcGMuc2VuZCAnc2V0cHJlc2VuY2UnXG4gICAgaXBjLnNlbmQgJ3NldGFjdGl2ZWNsaWVudCcsIHRydWUsIDE1XG5yZXNlbmRmb2N1cyA9IHRocm90dGxlIDE1MDAwLCAtPiBpcGMuc2VuZCAnc2V0Zm9jdXMnLCB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG5cbiMgb24gZXZlcnkga2VlcCBhbGl2ZSBzaWduYWwgZnJvbSBoYW5nb3V0c1xuIyAgd2UgaW5mb3JtIHRoZSBzZXJ2ZXIgdGhhdCB0aGUgdXNlciBpcyBzdGlsbFxuIyAgYXZhaWxhYmxlXG5oYW5kbGUgJ25vb3AnLCAtPlxuICAgIHNlbmRzZXRwcmVzZW5jZSgpXG5cbmhhbmRsZSAnbGFzdEFjdGl2aXR5JywgLT5cbiAgICBzZW5kc2V0cHJlc2VuY2UoKVxuICAgIHJlc2VuZGZvY3VzKCkgaWYgZG9jdW1lbnQuaGFzRm9jdXMoKVxuXG5oYW5kbGUgJ2FwcGZvY3VzJywgLT5cbiAgICBpcGMuc2VuZCAnYXBwZm9jdXMnXG5cbmhhbmRsZSAndXBkYXRld2F0ZXJtYXJrJywgZG8gLT5cbiAgICB0aHJvdHRsZVdhdGVyQnlDb252ID0ge31cbiAgICAtPlxuICAgICAgICBjb252X2lkID0gdmlld3N0YXRlLnNlbGVjdGVkQ29udlxuICAgICAgICBjID0gY29udltjb252X2lkXVxuICAgICAgICByZXR1cm4gdW5sZXNzIGNcbiAgICAgICAgc2VuZFdhdGVyID0gdGhyb3R0bGVXYXRlckJ5Q29udltjb252X2lkXVxuICAgICAgICB1bmxlc3Mgc2VuZFdhdGVyXG4gICAgICAgICAgICBkbyAoY29udl9pZCkgLT5cbiAgICAgICAgICAgICAgICBzZW5kV2F0ZXIgPSB0aHJvdHRsZSAxMDAwLCAtPiBpcGMuc2VuZCAndXBkYXRld2F0ZXJtYXJrJywgY29udl9pZCwgRGF0ZS5ub3coKVxuICAgICAgICAgICAgICAgIHRocm90dGxlV2F0ZXJCeUNvbnZbY29udl9pZF0gPSBzZW5kV2F0ZXJcbiAgICAgICAgc2VuZFdhdGVyKClcblxuaGFuZGxlICdnZXRlbnRpdHknLCAoaWRzKSAtPlxuICAgIGRvIGZuID0gLT5cbiAgICAgICAgaXBjLnNlbmQgJ2dldGVudGl0eScsIGlkc1suLjRdXG4gICAgICAgIGlkcyA9IGlkc1s1Li5dXG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDUwMCkgaWYgaWRzLmxlbmd0aCA+IDBcblxuaGFuZGxlICdhZGRlbnRpdGllcycsIChlcywgY29udl9pZCkgLT5cbiAgICBlbnRpdHkuYWRkIGUgZm9yIGUgaW4gZXMgPyBbXVxuICAgIGlmIGNvbnZfaWQgI8KgYXV0by1hZGQgdGhlc2UgcHBsIHRvIGEgY29udlxuICAgICAgICAoZXMgPyBbXSkuZm9yRWFjaCAocCkgLT4gY29udi5hZGRQYXJ0aWNpcGFudCBjb252X2lkLCBwXG4gICAgICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfTk9STUFMXG5cbiAgICAjIGZsYWcgdG8gc2hvdyB0aGF0IGNvbnRhY3RzIGFyZSBsb2FkZWRcbiAgICB2aWV3c3RhdGUuc2V0Q29udGFjdHMgdHJ1ZVxuXG5oYW5kbGUgJ3VwbG9hZGltYWdlJywgKGZpbGVzKSAtPlxuICAgICMgdGhpcyBtYXkgY2hhbmdlIGR1cmluZyB1cGxvYWRcbiAgICBjb252X2lkID0gdmlld3N0YXRlLnNlbGVjdGVkQ29udlxuICAgICMgc2Vuc2UgY2hlY2sgdGhhdCBjbGllbnQgaXMgaW4gZ29vZCBzdGF0ZVxuICAgIHVubGVzcyB2aWV3c3RhdGUuc3RhdGUgPT0gdmlld3N0YXRlLlNUQVRFX05PUk1BTCBhbmQgY29udltjb252X2lkXVxuICAgICAgICAjIGNsZWFyIHZhbHVlIGZvciB1cGxvYWQgaW1hZ2UgaW5wdXRcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2F0dGFjaEZpbGUnKS52YWx1ZSA9ICcnXG4gICAgICAgIHJldHVyblxuICAgICMgaWYgb25seSBvbmUgZmlsZSBpcyBzZWxlY3RlZCwgdGhlbiBpdCBzaG93cyBhcyBwcmV2aWV3IGJlZm9yZSBzZW5kaW5nXG4gICAgIyAgb3RoZXJ3aXNlLCBpdCB3aWxsIHVwbG9hZCBhbGwgb2YgdGhlbSBpbW1lZGlhdGx5XG4gICAgaWYgZmlsZXMubGVuZ3RoID09IDFcbiAgICAgICAgZmlsZSA9IGZpbGVzWzBdICMgZ2V0IGZpcnN0IGFuZCBvbmx5IGZpbGVcbiAgICAgICAgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkICdwcmV2aWV3LWltZydcbiAgICAgICAgIyBzaG93IGVycm9yIG1lc3NhZ2UgYW5kIHJldHVybiBpZiBpcyBub3QgYW4gaW1hZ2VcbiAgICAgICAgaWYgaXNJbWcgZmlsZS5wYXRoXG4gICAgICAgICAgICAjIHN0b3JlIGltYWdlIGluIHByZXZpZXctY29udGFpbmVyIGFuZCBvcGVuIGl0XG4gICAgICAgICAgICAjICBJIHRoaW5rIGl0IGlzIGJldHRlciB0byBlbWJlZCB0aGFuIHJlZmVyZW5jZSBwYXRoIGFzIHVzZXIgc2hvdWxkXG4gICAgICAgICAgICAjICAgc2VlIGV4YWN0bHkgd2hhdCBoZSBpcyBzZW5kaW5nLiAodXNpbmcgdGhlIHBhdGggd291bGQgcmVxdWlyZVxuICAgICAgICAgICAgIyAgIHBvbGxpbmcpXG4gICAgICAgICAgICBmcy5yZWFkRmlsZSBmaWxlLnBhdGgsIChlcnIsIG9yaWdpbmFsX2RhdGEpIC0+XG4gICAgICAgICAgICAgICAgYmluYXJ5SW1hZ2UgPSBCdWZmZXIuZnJvbShvcmlnaW5hbF9kYXRhLCAnYmluYXJ5JylcbiAgICAgICAgICAgICAgICBiYXNlNjRJbWFnZSA9IGJpbmFyeUltYWdlLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgICAgICAgICAgIG1pbWVUeXBlID0gbWltZS5sb29rdXAgZmlsZS5wYXRoXG4gICAgICAgICAgICAgICAgZWxlbWVudC5zcmMgPSAnZGF0YTonICsgbWltZVR5cGUgKyAnO2Jhc2U2NCwnICsgYmFzZTY0SW1hZ2VcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJldmlldy1jb250YWluZXInKS5jbGFzc0xpc3QuYWRkKCdvcGVuJylcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgW18sIGV4dF0gPSBmaWxlLnBhdGgubWF0Y2goLy4qKFxcLlxcdyspJC8pID8gW11cbiAgICAgICAgICAgIG5vdHIgXCJJZ25vcmluZyBmaWxlIG9mIHR5cGUgI3tleHR9XCJcbiAgICBlbHNlXG4gICAgICAgIGZvciBmaWxlIGluIGZpbGVzXG4gICAgICAgICAgICAjIG9ubHkgaW1hZ2VzIHBsZWFzZVxuICAgICAgICAgICAgdW5sZXNzIGlzSW1nIGZpbGUucGF0aFxuICAgICAgICAgICAgICAgIFtfLCBleHRdID0gZmlsZS5wYXRoLm1hdGNoKC8uKihcXC5cXHcrKSQvKSA/IFtdXG4gICAgICAgICAgICAgICAgbm90ciBcIklnbm9yaW5nIGZpbGUgb2YgdHlwZSAje2V4dH1cIlxuICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAjIG1lc3NhZ2UgZm9yIGEgcGxhY2Vob2xkZXJcbiAgICAgICAgICAgIG1zZyA9IHVzZXJpbnB1dC5idWlsZENoYXRNZXNzYWdlIGVudGl0eS5zZWxmLCAndXBsb2FkaW5nIGltYWdl4oCmJ1xuICAgICAgICAgICAgbXNnLnVwbG9hZGltYWdlID0gdHJ1ZVxuICAgICAgICAgICAge2NsaWVudF9nZW5lcmF0ZWRfaWR9ID0gbXNnXG4gICAgICAgICAgICAjIGFkZCBhIHBsYWNlaG9sZGVyIGZvciB0aGUgaW1hZ2VcbiAgICAgICAgICAgIGNvbnYuYWRkQ2hhdE1lc3NhZ2VQbGFjZWhvbGRlciBlbnRpdHkuc2VsZi5pZCwgbXNnXG4gICAgICAgICAgICAjIGFuZCBiZWdpbiB1cGxvYWRcbiAgICAgICAgICAgIGlwYy5zZW5kICd1cGxvYWRpbWFnZScsIHtwYXRoOmZpbGUucGF0aCwgY29udl9pZCwgY2xpZW50X2dlbmVyYXRlZF9pZH1cbiAgICAjIGNsZWFyIHZhbHVlIGZvciB1cGxvYWQgaW1hZ2UgaW5wdXRcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXR0YWNoRmlsZScpLnZhbHVlID0gJydcblxuaGFuZGxlICdvbnBhc3RlaW1hZ2UnLCAtPlxuICAgIGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCAncHJldmlldy1pbWcnXG4gICAgZWxlbWVudC5zcmMgPSBjbGlwYm9hcmQucmVhZEltYWdlKCkudG9EYXRhVVJMKClcbiAgICBlbGVtZW50LnNyYyA9IGVsZW1lbnQuc3JjLnJlcGxhY2UgL2ltYWdlXFwvcG5nLywgJ2ltYWdlL2dpZidcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJldmlldy1jb250YWluZXInKS5jbGFzc0xpc3QuYWRkKCdvcGVuJylcblxuaGFuZGxlICd1cGxvYWRwcmV2aWV3aW1hZ2UnLCAtPlxuICAgIGNvbnZfaWQgPSB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG4gICAgcmV0dXJuIHVubGVzcyBjb252X2lkXG4gICAgbXNnID0gdXNlcmlucHV0LmJ1aWxkQ2hhdE1lc3NhZ2UgZW50aXR5LnNlbGYsICd1cGxvYWRpbmcgaW1hZ2XigKYnXG4gICAgbXNnLnVwbG9hZGltYWdlID0gdHJ1ZVxuICAgIHtjbGllbnRfZ2VuZXJhdGVkX2lkfSA9IG1zZ1xuICAgIGNvbnYuYWRkQ2hhdE1lc3NhZ2VQbGFjZWhvbGRlciBlbnRpdHkuc2VsZi5pZCwgbXNnXG4gICAgIyBmaW5kIHByZXZpZXcgZWxlbWVudFxuICAgIGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCAncHJldmlldy1pbWcnXG4gICAgIyBidWlsZCBpbWFnZSBmcm9tIHdoYXQgaXMgb24gcHJldmlld1xuICAgIHBuZ0RhdGEgPSBlbGVtZW50LnNyYy5yZXBsYWNlIC9kYXRhOmltYWdlXFwvKHBuZ3xqcGU/Z3xnaWZ8c3ZnKTtiYXNlNjQsLywgJydcbiAgICBwbmdEYXRhID0gQnVmZmVyLmZyb20ocG5nRGF0YSwgJ2Jhc2U2NCcpXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByZXZpZXctY29udGFpbmVyJykuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Vtb2ppLWNvbnRhaW5lcicpLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKVxuICAgIGVsZW1lbnQuc3JjID0gJydcbiAgICAjXG4gICAgaXBjLnNlbmQgJ3VwbG9hZGNsaXBib2FyZGltYWdlJywge3BuZ0RhdGEsIGNvbnZfaWQsIGNsaWVudF9nZW5lcmF0ZWRfaWR9XG5cbmhhbmRsZSAndXBsb2FkaW5naW1hZ2UnLCAoc3BlYykgLT5cbiAgICAjIFhYWCB0aGlzIGRvZXNuJ3QgbG9vayB2ZXJ5IGdvb2QgYmVjYXVzZSB0aGUgaW1hZ2VcbiAgICAjIHNob3dzLCB0aGVuIGZsaWNrZXJzIGF3YXkgYmVmb3JlIHRoZSByZWFsIGlzIGxvYWRlZFxuICAgICMgZnJvbSB0aGUgdXBsb2FkLlxuICAgICNjb252LnVwZGF0ZVBsYWNlaG9sZGVySW1hZ2Ugc3BlY1xuXG5oYW5kbGUgJ2xlZnRyZXNpemUnLCAoc2l6ZSkgLT4gdmlld3N0YXRlLnNldExlZnRTaXplIHNpemVcbmhhbmRsZSAncmVzaXplJywgKGRpbSkgLT4gdmlld3N0YXRlLnNldFNpemUgZGltXG5oYW5kbGUgJ21vdmUnLCAocG9zKSAtPiB2aWV3c3RhdGUuc2V0UG9zaXRpb24gcG9zXG5cbmhhbmRsZSAnY29udmVyc2F0aW9ubmFtZScsIChuYW1lKSAtPlxuICAgIGNvbnZzZXR0aW5ncy5zZXROYW1lIG5hbWVcbmhhbmRsZSAnY29udmVyc2F0aW9ucXVlcnknLCAocXVlcnkpIC0+XG4gICAgY29udnNldHRpbmdzLnNldFNlYXJjaFF1ZXJ5IHF1ZXJ5XG5oYW5kbGUgJ3NlYXJjaGVudGl0aWVzJywgKHF1ZXJ5LCBtYXhfcmVzdWx0cykgLT5cbiAgICBpcGMuc2VuZCAnc2VhcmNoZW50aXRpZXMnLCBxdWVyeSwgbWF4X3Jlc3VsdHNcbmhhbmRsZSAnc2V0c2VhcmNoZWRlbnRpdGllcycsIChyKSAtPlxuICAgIGNvbnZzZXR0aW5ncy5zZXRTZWFyY2hlZEVudGl0aWVzIHJcbmhhbmRsZSAnc2VsZWN0ZW50aXR5JywgKGUpIC0+IGNvbnZzZXR0aW5ncy5hZGRTZWxlY3RlZEVudGl0eSBlXG5oYW5kbGUgJ2Rlc2VsZWN0ZW50aXR5JywgKGUpIC0+IGNvbnZzZXR0aW5ncy5yZW1vdmVTZWxlY3RlZEVudGl0eSBlXG5oYW5kbGUgJ3RvZ2dsZWdyb3VwJywgKGUpIC0+IGNvbnZzZXR0aW5ncy5zZXRHcm91cCghY29udnNldHRpbmdzLmdyb3VwKVxuXG5oYW5kbGUgJ3NhdmVjb252ZXJzYXRpb24nLCAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTdGF0ZSB2aWV3c3RhdGUuU1RBVEVfTk9STUFMXG4gICAgY29udl9pZCA9IGNvbnZzZXR0aW5ncy5pZFxuICAgIGMgPSBjb252W2NvbnZfaWRdXG4gICAgb25lX3RvX29uZSA9IGM/LnR5cGU/LmluZGV4T2YoJ09ORV9UT19PTkUnKSA+PSAwXG4gICAgc2VsZWN0ZWQgPSAoZS5pZC5jaGF0X2lkIGZvciBlIGluIGNvbnZzZXR0aW5ncy5zZWxlY3RlZEVudGl0aWVzKVxuICAgIHJlY3JlYXRlID0gY29udl9pZCBhbmQgb25lX3RvX29uZSBhbmQgY29udnNldHRpbmdzLmdyb3VwXG4gICAgbmVlZHNSZW5hbWUgPSBjb252c2V0dGluZ3MuZ3JvdXAgYW5kIGNvbnZzZXR0aW5ncy5uYW1lIGFuZCBjb252c2V0dGluZ3MubmFtZSAhPSBjPy5uYW1lXG4gICAgIyByZW1lbWJlcjogd2UgZG9uJ3QgcmVuYW1lIG9uZV90b19vbmVzLCBnb29nbGUgd2ViIGNsaWVudCBkb2VzIG5vdCBkbyBpdFxuICAgIGlmIG5vdCBjb252X2lkIG9yIHJlY3JlYXRlXG4gICAgICAgIG5hbWUgPSAoY29udnNldHRpbmdzLm5hbWUgaWYgY29udnNldHRpbmdzLmdyb3VwKSBvciBcIlwiXG4gICAgICAgIGlwYy5zZW5kICdjcmVhdGVjb252ZXJzYXRpb24nLCBzZWxlY3RlZCwgbmFtZSwgY29udnNldHRpbmdzLmdyb3VwXG4gICAgICAgIHJldHVyblxuICAgIHAgPSBjLnBhcnRpY2lwYW50X2RhdGFcbiAgICBjdXJyZW50ID0gKGMuaWQuY2hhdF9pZCBmb3IgYyBpbiBwIHdoZW4gbm90IGVudGl0eS5pc1NlbGYgYy5pZC5jaGF0X2lkKVxuICAgIHRvYWRkID0gKGlkIGZvciBpZCBpbiBzZWxlY3RlZCB3aGVuIGlkIG5vdCBpbiBjdXJyZW50KVxuICAgIGlwYy5zZW5kICdhZGR1c2VyJywgY29udl9pZCwgdG9hZGQgaWYgdG9hZGQubGVuZ3RoXG4gICAgaXBjLnNlbmQgJ3JlbmFtZWNvbnZlcnNhdGlvbicsIGNvbnZfaWQsIGNvbnZzZXR0aW5ncy5uYW1lIGlmIG5lZWRzUmVuYW1lXG5cbmhhbmRsZSAnY29udmVyc2F0aW9uX3JlbmFtZScsIChjKSAtPlxuICAgIGNvbnYucmVuYW1lIGMsIGMuY29udmVyc2F0aW9uX3JlbmFtZS5uZXdfbmFtZVxuICAgIGNvbnYuYWRkQ2hhdE1lc3NhZ2UgY1xuXG5oYW5kbGUgJ21lbWJlcnNoaXBfY2hhbmdlJywgKGUpIC0+XG4gICAgY29udl9pZCA9IGUuY29udmVyc2F0aW9uX2lkLmlkXG4gICAgaWRzID0gKGlkLmNoYXRfaWQgb3IgaWQuZ2FpYV9pZCBmb3IgaWQgaW4gZS5tZW1iZXJzaGlwX2NoYW5nZS5wYXJ0aWNpcGFudF9pZHMpXG4gICAgaWYgZS5tZW1iZXJzaGlwX2NoYW5nZS50eXBlID09ICdMRUFWRSdcbiAgICAgICAgaWYgZW50aXR5LnNlbGYuaWQgaW4gaWRzXG4gICAgICAgICAgICByZXR1cm4gY29udi5kZWxldGVDb252IGNvbnZfaWRcbiAgICAgICAgcmV0dXJuIGNvbnYucmVtb3ZlUGFydGljaXBhbnRzIGNvbnZfaWQsIGlkc1xuICAgIGNvbnYuYWRkQ2hhdE1lc3NhZ2UgZVxuICAgIGlwYy5zZW5kICdnZXRlbnRpdHknLCBpZHMsIHthZGRfdG9fY29udjogY29udl9pZH1cblxuaGFuZGxlICdjcmVhdGVjb252ZXJzYXRpb25kb25lJywgKGMpIC0+XG4gICAgY29udnNldHRpbmdzLnJlc2V0KClcbiAgICBjb252LmFkZCBjXG4gICAgdmlld3N0YXRlLnNldFNlbGVjdGVkQ29udiBjLmlkLmlkXG5cbmhhbmRsZSAnbm90aWZpY2F0aW9uX2xldmVsJywgKG4pIC0+XG4gICAgY29udl9pZCA9IG4/WzBdP1swXVxuICAgIGxldmVsID0gaWYgbj9bMV0gPT0gMTAgdGhlbiAnUVVJRVQnIGVsc2UgJ1JJTkcnXG4gICAgY29udi5zZXROb3RpZmljYXRpb25MZXZlbCBjb252X2lkLCBsZXZlbCBpZiBjb252X2lkIGFuZCBsZXZlbFxuXG5oYW5kbGUgJ3RvZ2dsZW5vdGlmJywgLT5cbiAgICB7UVVJRVQsIFJJTkd9ID0gQ2xpZW50Lk5vdGlmaWNhdGlvbkxldmVsXG4gICAgY29udl9pZCA9IHZpZXdzdGF0ZS5zZWxlY3RlZENvbnZcbiAgICByZXR1cm4gdW5sZXNzIGMgPSBjb252W2NvbnZfaWRdXG4gICAgcSA9IGNvbnYuaXNRdWlldChjKVxuICAgIGlwYy5zZW5kICdzZXRjb252ZXJzYXRpb25ub3RpZmljYXRpb25sZXZlbCcsIGNvbnZfaWQsIChpZiBxIHRoZW4gUklORyBlbHNlIFFVSUVUKVxuICAgIGNvbnYuc2V0Tm90aWZpY2F0aW9uTGV2ZWwgY29udl9pZCwgKGlmIHEgdGhlbiAnUklORycgZWxzZSAnUVVJRVQnKVxuXG5oYW5kbGUgJ3RvZ2dsZXN0YXInLCAtPlxuICAgIGNvbnZfaWQgPSB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG4gICAgcmV0dXJuIHVubGVzcyBjID0gY29udltjb252X2lkXVxuICAgIGNvbnYudG9nZ2xlU3RhcihjKVxuXG5oYW5kbGUgJ2RlbGV0ZScsIChhKSAtPlxuICAgIGNvbnZfaWQgPSBhP1swXT9bMF1cbiAgICByZXR1cm4gdW5sZXNzIGMgPSBjb252W2NvbnZfaWRdXG4gICAgY29udi5kZWxldGVDb252IGNvbnZfaWRcblxuaGFuZGxlICdzZXRzcGVsbGNoZWNrbGFuZ3VhZ2UnLCAobGFuZ3VhZ2UpIC0+XG4gICAgICB2aWV3c3RhdGUuc2V0U3BlbGxDaGVja0xhbmd1YWdlKGxhbmd1YWdlLCByZW1vdGUuZ2V0Q3VycmVudFdpbmRvdygpKVxuXG4jXG4jXG4jIENoYW5nZSBsYW5ndWFnZSBpbiBZYWtZYWtcbiNcbmhhbmRsZSAnY2hhbmdlbGFuZ3VhZ2UnLCAobGFuZ3VhZ2UpIC0+XG4gICAgaWYgaTE4bi5nZXRMb2NhbGVzKCkuaW5jbHVkZXMgdmlld3N0YXRlLmxhbmd1YWdlXG4gICAgICAgIGlwYy5zZW5kICdzZXRpMThuJywgbnVsbCwgbGFuZ3VhZ2VcbiAgICAgICAgdmlld3N0YXRlLnNldExhbmd1YWdlKGxhbmd1YWdlKVxuXG5oYW5kbGUgJ2RlbGV0ZWNvbnYnLCAoY29uZmlybWVkKSAtPlxuICAgIGNvbnZfaWQgPSB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG4gICAgdW5sZXNzIGNvbmZpcm1lZFxuICAgICAgICBsYXRlciAtPiBpZiBjb25maXJtIGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5kZWxldGVfY29uZmlybTpSZWFsbHkgZGVsZXRlIGNvbnZlcnNhdGlvbj8nKVxuICAgICAgICAgICAgYWN0aW9uICdkZWxldGVjb252JywgdHJ1ZVxuICAgIGVsc2VcbiAgICAgICAgaXBjLnNlbmQgJ2RlbGV0ZWNvbnZlcnNhdGlvbicsIGNvbnZfaWRcbiAgICAgICAgdmlld3N0YXRlLnNlbGVjdENvbnZJbmRleCgwKVxuICAgICAgICB2aWV3c3RhdGUuc2V0U3RhdGUodmlld3N0YXRlLlNUQVRFX05PUk1BTClcblxuaGFuZGxlICdsZWF2ZWNvbnYnLCAoY29uZmlybWVkKSAtPlxuICAgIGNvbnZfaWQgPSB2aWV3c3RhdGUuc2VsZWN0ZWRDb252XG4gICAgdW5sZXNzIGNvbmZpcm1lZFxuICAgICAgICBsYXRlciAtPiBpZiBjb25maXJtIGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5sZWF2ZV9jb25maXJtOlJlYWxseSBsZWF2ZSBjb252ZXJzYXRpb24/JylcbiAgICAgICAgICAgIGFjdGlvbiAnbGVhdmVjb252JywgdHJ1ZVxuICAgIGVsc2VcbiAgICAgICAgaXBjLnNlbmQgJ3JlbW92ZXVzZXInLCBjb252X2lkXG4gICAgICAgIHZpZXdzdGF0ZS5zZWxlY3RDb252SW5kZXgoMClcbiAgICAgICAgdmlld3N0YXRlLnNldFN0YXRlKHZpZXdzdGF0ZS5TVEFURV9OT1JNQUwpXG5cbmhhbmRsZSAnbGFzdGtleWRvd24nLCAodGltZSkgLT4gdmlld3N0YXRlLnNldExhc3RLZXlEb3duIHRpbWVcbmhhbmRsZSAnc2V0dHlwaW5nJywgKHYpIC0+XG4gICAgY29udl9pZCA9IHZpZXdzdGF0ZS5zZWxlY3RlZENvbnZcbiAgICByZXR1cm4gdW5sZXNzIGNvbnZfaWQgYW5kIHZpZXdzdGF0ZS5zdGF0ZSA9PSB2aWV3c3RhdGUuU1RBVEVfTk9STUFMXG4gICAgaXBjLnNlbmQgJ3NldHR5cGluZycsIGNvbnZfaWQsIHZcbiAgICB2aWV3c3RhdGUuc2V0U3RhdGUodmlld3N0YXRlLlNUQVRFX05PUk1BTClcblxuaGFuZGxlICd0eXBpbmcnLCAodCkgLT5cbiAgICBjb252LmFkZFR5cGluZyB0XG5oYW5kbGUgJ3BydW5lVHlwaW5nJywgKGNvbnZfaWQpIC0+XG4gICAgY29udi5wcnVuZVR5cGluZyBjb252X2lkXG5cbmhhbmRsZSAnc3luY2FsbG5ld2V2ZW50cycsIHRocm90dGxlIDEwMDAwLCAodGltZSkgLT5cbiAgICByZXR1cm4gdW5sZXNzIHRpbWVcbiAgICBpcGMuc2VuZCAnc3luY2FsbG5ld2V2ZW50cycsIHRpbWVcblxuaGFuZGxlICdoYW5kbGVzeW5jZWRldmVudHMnLCAocikgLT5cbiAgICBzdGF0ZXMgPSByPy5jb252ZXJzYXRpb25fc3RhdGVcbiAgICByZXR1cm4gdW5sZXNzIHN0YXRlcz8ubGVuZ3RoXG4gICAgZm9yIHN0IGluIHN0YXRlc1xuICAgICAgICBmb3IgZSBpbiAoc3Q/LmV2ZW50ID8gW10pXG4gICAgICAgICAgICBjb252LmFkZENoYXRNZXNzYWdlIGVcbiAgICBjb25uZWN0aW9uLnNldEV2ZW50U3RhdGUgY29ubmVjdGlvbi5JTl9TWU5DXG5cbmhhbmRsZSAnc3luY3JlY2VudGNvbnZlcnNhdGlvbnMnLCB0aHJvdHRsZSAxMDAwMCwgLT5cbiAgICBpcGMuc2VuZCAnc3luY3JlY2VudGNvbnZlcnNhdGlvbnMnXG5cbmhhbmRsZSAnaGFuZGxlcmVjZW50Y29udmVyc2F0aW9ucycsIChyKSAtPlxuICAgIHJldHVybiB1bmxlc3Mgc3QgPSByLmNvbnZlcnNhdGlvbl9zdGF0ZVxuICAgIGNvbnYucmVwbGFjZUZyb21TdGF0ZXMgc3RcbiAgICBjb25uZWN0aW9uLnNldEV2ZW50U3RhdGUgY29ubmVjdGlvbi5JTl9TWU5DXG5cbmhhbmRsZSAnY2xpZW50X2NvbnZlcnNhdGlvbicsIChjKSAtPlxuICAgICMgQ29udmVyc2F0aW9uIG11c3QgYmUgYWRkZWQsIGV2ZW4gaWYgYWxyZWFkeSBleGlzdHNcbiAgICAjICB3aHk/IGJlY2F1c2Ugd2hlbiBhIG5ldyBjaGF0IG1lc3NhZ2UgZm9yIGEgbmV3IGNvbnZlcnNhdGlvbiBhcHBlYXJzXG4gICAgIyAgYSBza2VsZXRvbiBpcyBtYWRlIG9mIGEgY29udmVyc2F0aW9uXG4gICAgY29udi5hZGQgYyAjIHVubGVzcyBjb252W2M/LmNvbnZlcnNhdGlvbl9pZD8uaWRdPy5wYXJ0aWNpcGFudF9kYXRhP1xuICAgICMgY29tbWVudGVkIHVubGVzcyBjb25kaXRpb24sIGFzIGl0IHdhcyBwcmV2ZW50aW5nIHlha3lhayByZWFjdGluZyB0byBjbGllbnRfY29udmVyc2F0aW9ucyBldmVudHNcbiAgICAjICBmcm9tIHNlcnZlclxuXG5oYW5kbGUgJ2hhbmdvdXRfZXZlbnQnLCAoZSkgLT5cbiAgICByZXR1cm4gdW5sZXNzIGU/LmhhbmdvdXRfZXZlbnQ/LmV2ZW50X3R5cGUgaW4gWydTVEFSVF9IQU5HT1VUJywgJ0VORF9IQU5HT1VUJ11cbiAgICAjIHRyaWdnZXIgbm90aWZpY2F0aW9ucyBmb3IgdGhpc1xuICAgIG5vdGlmeS5hZGRUb05vdGlmeSBlXG5cbidyZXBseV90b19pbnZpdGUgc2V0dGluZ3MgY29udmVyc2F0aW9uX25vdGlmaWNhdGlvbiBpbnZpdGF0aW9uX3dhdGVybWFyaycuc3BsaXQoJyAnKS5mb3JFYWNoIChuKSAtPlxuICAgIGhhbmRsZSBuLCAoYXMuLi4pIC0+IGNvbnNvbGUubG9nIG4sIGFzLi4uXG5cbmhhbmRsZSAndW5yZWFkdG90YWwnLCAodG90YWwsIG9yTW9yZSkgLT5cbiAgICB2YWx1ZSA9IFwiXCJcbiAgICBpZiB0b3RhbCA+IDAgdGhlbiB2YWx1ZSA9IHRvdGFsICsgKGlmIG9yTW9yZSB0aGVuIFwiK1wiIGVsc2UgXCJcIilcbiAgICB1cGRhdGVkICdjb252X2NvdW50J1xuICAgIGlwYy5zZW5kICd1cGRhdGViYWRnZScsIHZhbHVlXG5cbmhhbmRsZSAnc2hvd2NvbnZtaW4nLCAoZG9zaG93KSAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTaG93Q29udk1pbiBkb3Nob3dcblxuaGFuZGxlICdzZXR1c2VzeXN0ZW1kYXRlZm9ybWF0JywgKHZhbCkgLT5cblxuICAgIHZpZXdzdGF0ZS5zZXRVc2VTeXN0ZW1EYXRlRm9ybWF0KHZhbClcblxuaGFuZGxlICdzaG93Y29udnRodW1icycsIChkb3Nob3cpIC0+XG4gICAgdmlld3N0YXRlLnNldFNob3dDb252VGh1bWJzIGRvc2hvd1xuXG5oYW5kbGUgJ3Nob3dhbmltYXRlZHRodW1icycsIChkb3Nob3cpIC0+XG4gICAgdmlld3N0YXRlLnNldFNob3dBbmltYXRlZFRodW1icyBkb3Nob3dcblxuaGFuZGxlICdzaG93Y29udnRpbWUnLCAoZG9zaG93KSAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTaG93Q29udlRpbWUgZG9zaG93XG5cbmhhbmRsZSAnc2hvd2NvbnZsYXN0JywgKGRvc2hvdykgLT5cbiAgICB2aWV3c3RhdGUuc2V0U2hvd0NvbnZMYXN0IGRvc2hvd1xuXG5oYW5kbGUgJ3RvZ2dsZXBvcHVwbm90aWZpY2F0aW9ucycsIC0+XG4gICAgY29uc29sZS5sb2coJ3RvZ2dsZSBwb3B1cG5vdGlmaWNhdGlvbnMnKVxuICAgIHZpZXdzdGF0ZS5zZXRTaG93UG9wVXBOb3RpZmljYXRpb25zIG5vdCB2aWV3c3RhdGUuc2hvd1BvcFVwTm90aWZpY2F0aW9uc1xuXG5oYW5kbGUgJ3Nob3dwb3B1cG5vdGlmaWNhdGlvbnMnLCAoZG9zaG93KSAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTaG93UG9wVXBOb3RpZmljYXRpb25zIGRvc2hvd1xuXG5oYW5kbGUgJ3Nob3dtZXNzYWdlaW5ub3RpZmljYXRpb24nLCAoZG9zaG93KSAtPlxuICAgIHZpZXdzdGF0ZS5zZXRTaG93TWVzc2FnZUluTm90aWZpY2F0aW9uIGRvc2hvd1xuXG5oYW5kbGUgJ3Nob3d1c2VybmFtZWlubm90aWZpY2F0aW9uJywgKGRvc2hvdykgLT5cbiAgICB2aWV3c3RhdGUuc2V0U2hvd1VzZXJuYW1lSW5Ob3RpZmljYXRpb24gZG9zaG93XG5cbmhhbmRsZSAnY29udmVydGVtb2ppJywgKGRvc2hvdykgLT5cbiAgICB2aWV3c3RhdGUuc2V0Q29udmVydEVtb2ppIGRvc2hvd1xuXG5oYW5kbGUgJ3N1Z2dlc3RlbW9qaScsIChkb3Nob3cpIC0+XG4gICAgdmlld3N0YXRlLnNldFN1Z2dlc3RFbW9qaSBkb3Nob3dcblxuaGFuZGxlICdzaG93aW1hZ2VwcmV2aWV3JywgKGRvc2hvdykgLT5cbiAgICB2aWV3c3RhdGUuc2V0c2hvd0ltYWdlUHJldmlldyBkb3Nob3dcblxuaGFuZGxlICdjaGFuZ2V0aGVtZScsIChjb2xvcnNjaGVtZSkgLT5cbiAgICB2aWV3c3RhdGUuc2V0Q29sb3JTY2hlbWUgY29sb3JzY2hlbWVcblxuaGFuZGxlICdjaGFuZ2Vmb250c2l6ZScsIChmb250c2l6ZSkgLT5cbiAgICB2aWV3c3RhdGUuc2V0Rm9udFNpemUgZm9udHNpemVcblxuaGFuZGxlICdkZXZ0b29scycsIC0+XG4gICAgcmVtb3RlLmdldEN1cnJlbnRXaW5kb3coKS5vcGVuRGV2VG9vbHMgZGV0YWNoOnRydWVcblxuaGFuZGxlICdxdWl0JywgLT5cbiAgICBpcGMuc2VuZCAncXVpdCdcblxuaGFuZGxlICd0b2dnbGVmdWxsc2NyZWVuJywgLT5cbiAgICBpcGMuc2VuZCAndG9nZ2xlZnVsbHNjcmVlbidcblxuaGFuZGxlICd6b29tJywgKHN0ZXApIC0+XG4gICAgaWYgc3RlcD9cbiAgICAgICAgcmV0dXJuIHZpZXdzdGF0ZS5zZXRab29tIChwYXJzZUZsb2F0KGRvY3VtZW50LmJvZHkuc3R5bGUuem9vbS5yZXBsYWNlKCcsJywgJy4nKSkgb3IgMS4wKSArIHN0ZXBcbiAgICB2aWV3c3RhdGUuc2V0Wm9vbSAxXG5cbmhhbmRsZSAnbG9nb3V0JywgLT5cbiAgICBpcGMuc2VuZCAnbG9nb3V0J1xuXG5oYW5kbGUgJ3dvbmxpbmUnLCAod29ubGluZSkgLT5cbiAgICBjb25uZWN0aW9uLnNldFdpbmRvd09ubGluZSB3b25saW5lXG4gICAgaWYgd29ubGluZVxuICAgICAgICBpcGMuc2VuZCAnaGFuZ3Vwc0Nvbm5lY3QnXG4gICAgZWxzZVxuICAgICAgICBpcGMuc2VuZCAnaGFuZ3Vwc0Rpc2Nvbm5lY3QnXG5cbmhhbmRsZSAnb3Blbm9uc3lzdGVtc3RhcnR1cCcsIChvcGVuKSAtPlxuICAgIHZpZXdzdGF0ZS5zZXRPcGVuT25TeXN0ZW1TdGFydHVwIG9wZW5cblxuaGFuZGxlICdpbml0b3Blbm9uc3lzdGVtc3RhcnR1cCcsIChpc0VuYWJsZWQpIC0+XG4gICAgdmlld3N0YXRlLmluaXRPcGVuT25TeXN0ZW1TdGFydHVwIGlzRW5hYmxlZFxuXG5oYW5kbGUgJ21pbmltaXplJywgLT5cbiAgICBtYWluV2luZG93ID0gcmVtb3RlLmdldEN1cnJlbnRXaW5kb3coKVxuICAgIG1haW5XaW5kb3cubWluaW1pemUoKVxuXG5oYW5kbGUgJ3Jlc2l6ZXdpbmRvdycsIC0+XG4gICAgbWFpbldpbmRvdyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KClcbiAgICBpZiBtYWluV2luZG93LmlzTWF4aW1pemVkKCkgdGhlbiBtYWluV2luZG93LnVubWF4aW1pemUoKSBlbHNlIG1haW5XaW5kb3cubWF4aW1pemUoKVxuXG5oYW5kbGUgJ2Nsb3NlJywgLT5cbiAgICBtYWluV2luZG93ID0gcmVtb3RlLmdldEN1cnJlbnRXaW5kb3coKVxuICAgIG1haW5XaW5kb3cuY2xvc2UoKVxuIl19
