(function() {
  var CUTOFF, HANGOUT_ANNOTATION_TYPE, MESSAGE_CLASSES, OBSERVE_OPTS, atTopIfSmall, drawAvatar, drawMeMessage, drawMessage, drawMessageAvatar, drawSeenAvatar, extractObjectStyle, extractProtobufStyle, firstRender, fixProxied, fixlink, forceredraw, format, formatAttachment, formatters, getImageUrl, getProxiedName, groupEvents, groupEventsByMessageType, ifpass, initialsof, isImg, isMeMessage, lastConv, later, linkto, moment, nameof, nameofconv, onMutate, onclick, preload, preloadInstagramPhoto, preloadTweet, preload_cache, scrollToBottom, shell, stripProxiedColon, throttle, url, urlRegexp;

  moment = require('moment');

  shell = require('electron').shell;

  urlRegexp = require('uber-url-regex');

  url = require('url');

  ({nameof, initialsof, nameofconv, linkto, later, forceredraw, throttle, getProxiedName, fixlink, isImg, getImageUrl, drawAvatar} = require('../util'));

  CUTOFF = 5 * 60 * 1000 * 1000; // 5 mins

  
  // chat_message:
  //   {
  //     annotation: [
  //       [4, ""]
  //     ]
  //     message_content: {
  //       attachement: []
  //       segment: [{ ... }]
  //     }
  //   }
  HANGOUT_ANNOTATION_TYPE = {
    me_message: 4
  };

  // this helps fixing houts proxied with things like hangupsbot
  // the format of proxied messages are
  // and here we put entities in the entity db for
  // users found only in proxied messages.
  fixProxied = function(e, proxied, entity) {
    var name, ref, ref1, ref2, ref3;
    if ((e != null ? (ref = e.chat_message) != null ? ref.message_content : void 0 : void 0) == null) {
      return;
    }
    e.chat_message.message_content.proxied = true;
    name = e != null ? (ref1 = e.chat_message) != null ? (ref2 = ref1.message_content) != null ? (ref3 = ref2.segment[0]) != null ? ref3.text : void 0 : void 0 : void 0 : void 0;
    // update fallback_name for entity database
    if (name !== '>>') {
      // synthetic add of fallback_name
      return entity.add({
        id: {
          gaia_id: proxied,
          chat_id: proxied
        },
        fallback_name: name
      }, {
        silent: true
      });
    }
  };

  onclick = function(e) {
    var address, finalUrl, patt, xhr;
    e.preventDefault();
    address = e.currentTarget.getAttribute('href');
    patt = new RegExp("^(https?[:][/][/]www[.]google[.](com|[a-z][a-z])[/]url[?]q[=])([^&]+)(&.+)*");
    if (patt.test(address)) {
      address = address.replace(patt, '$3');
      address = unescape(address);
      // this is a link outside google and can be opened directly
      //  as there is no need for authentication
      shell.openExternal(fixlink(address));
      return;
    }
    if (urlRegexp({
      exact: true
    }).test(address)) {
      if (url.parse(address).host == null) {
        address = `http://${address}`;
      }
    }
    finalUrl = fixlink(address);
    // Google apis give us an url that is only valid for the current logged user.
    // We can't open this url in the external browser because it may not be authenticated
    // or may be authenticated differently (another user or multiple users).
    // In this case we try to open the url ourselves until we get redirected to the final url
    // of the image/video.
    // The finalURL will be cdn-hosted, static and does not require authentication
    // so we can finally open it in the external browser :(
    xhr = new XMLHttpRequest();
    // Showing message with 3 second delay showing the user that something is happening
    notr({
      html: i18n.__('conversation.open_link:Opening the link in the browser...'),
      stay: 3000
    });
    xhr.onreadystatechange = function(e) {
      var redirected;
      if (e.target.status === 0) {
        return;
      }
      if (xhr.readyState !== 4) {
        return;
      }
      redirected = finalUrl.indexOf(xhr.responseURL) !== 0;
      if (redirected) {
        finalUrl = xhr.responseURL;
      }
      shell.openExternal(finalUrl);
      return xhr.abort();
    };
    xhr.open("get", finalUrl);
    return xhr.send();
  };

  // helper method to group events in time/user bunches
  groupEvents = function(es, entity) {
    var cid, e, group, groups, j, len, proxied, ref, ref1, user;
    groups = [];
    group = null;
    user = null;
    for (j = 0, len = es.length; j < len; j++) {
      e = es[j];
      if (e.timestamp - ((ref = group != null ? group.end : void 0) != null ? ref : 0) > CUTOFF) {
        group = {
          byuser: [],
          start: e.timestamp,
          end: e.timestamp
        };
        user = null;
        groups.push(group);
      }
      proxied = getProxiedName(e);
      if (proxied) {
        fixProxied(e, proxied, entity);
      }
      cid = proxied ? proxied : e != null ? (ref1 = e.sender_id) != null ? ref1.chat_id : void 0 : void 0;
      if (cid !== (user != null ? user.cid : void 0)) {
        group.byuser.push(user = {
          cid: cid,
          event: []
        });
      }
      user.event.push(e);
      group.end = e.timestamp;
    }
    return groups;
  };

  // possible classes of messages
  MESSAGE_CLASSES = ['placeholder', 'chat_message', 'conversation_rename', 'membership_change'];

  OBSERVE_OPTS = {
    childList: true,
    attributes: true,
    attributeOldValue: true,
    subtree: true
  };

  firstRender = true;

  lastConv = null; // to detect conv switching

  module.exports = view(function(models) {
    var all_seen, c, conv, conv_id, entity, j, l, len, len1, participant, ref, ref1, viewstate;
    ({viewstate, conv, entity} = models);
    if (firstRender) {
      // mutation events kicks in after first render
      later(onMutate(viewstate));
    }
    firstRender = false;
    conv_id = viewstate != null ? viewstate.selectedConv : void 0;
    c = conv[conv_id];
    if ((c != null ? c.current_participant : void 0) != null) {
      ref = c.current_participant;
      for (j = 0, len = ref.length; j < len; j++) {
        participant = ref[j];
        entity.needEntity(participant.chat_id);
      }
    }
    div({
      class: 'messages',
      observe: onMutate(viewstate)
    }, function() {
      var clz, events, g, grouped, l, last_seen, last_seen_chat_ids_with_event, len1, results, sender, u;
      if (!(c != null ? c.event : void 0)) {
        return;
      }
      grouped = groupEvents(c.event, entity);
      div({
        class: 'historyinfo'
      }, function() {
        if (c.requestinghistory) {
          return pass('Requesting history…', function() {
            return span({
              class: 'material-icons spin'
            }, 'donut_large');
          });
        }
      });
      if (!viewstate.useSystemDateFormat) {
        moment.locale(i18n.getLocale());
      } else {
        moment.locale(window.navigator.language);
      }
      last_seen = conv.findLastReadEventsByUser(c);
      last_seen_chat_ids_with_event = function(last_seen, event) {
        var chat_id, e, results;
        results = [];
        for (chat_id in last_seen) {
          e = last_seen[chat_id];
          if (event === e) {
            results.push(chat_id);
          }
        }
        return results;
      };
      results = [];
      for (l = 0, len1 = grouped.length; l < len1; l++) {
        g = grouped[l];
        div({
          class: 'timestamp'
        }, moment(g.start / 1000).calendar());
        results.push((function() {
          var len2, m, ref1, results1;
          ref1 = g.byuser;
          results1 = [];
          for (m = 0, len2 = ref1.length; m < len2; m++) {
            u = ref1[m];
            sender = nameof(entity[u.cid]);
            results1.push((function() {
              var len3, n, ref2, results2;
              ref2 = groupEventsByMessageType(u.event);
              results2 = [];
              for (n = 0, len3 = ref2.length; n < len3; n++) {
                events = ref2[n];
                if (isMeMessage(events[0])) {
                  // all items are /me messages if the first one is due to grouping above
                  results2.push(div({
                    class: 'ugroup me'
                  }, function() {
                    var e, len4, o, results3;
                    drawMessageAvatar(u, sender, viewstate, entity);
                    results3 = [];
                    for (o = 0, len4 = events.length; o < len4; o++) {
                      e = events[o];
                      results3.push(drawMeMessage(e));
                    }
                    return results3;
                  }));
                } else {
                  clz = ['ugroup'];
                  if (entity.isSelf(u.cid)) {
                    clz.push('self');
                  }
                  results2.push(div({
                    class: clz.join(' ')
                  }, function() {
                    drawMessageAvatar(u, sender, viewstate, entity);
                    div({
                      class: 'umessages'
                    }, function() {
                      var e, len4, o, results3;
                      results3 = [];
                      for (o = 0, len4 = events.length; o < len4; o++) {
                        e = events[o];
                        results3.push(drawMessage(e, entity));
                      }
                      return results3;
                    });
                    // at the end of the events group we draw who has read any of its events
                    return div({
                      class: 'seen-list'
                    }, function() {
                      var chat_id, e, len4, o, results3, skip;
                      results3 = [];
                      for (o = 0, len4 = events.length; o < len4; o++) {
                        e = events[o];
                        results3.push((function() {
                          var len5, q, ref3, results4;
                          ref3 = last_seen_chat_ids_with_event(last_seen, e);
                          results4 = [];
                          for (q = 0, len5 = ref3.length; q < len5; q++) {
                            chat_id = ref3[q];
                            skip = entity.isSelf(chat_id) || (chat_id === u.cid);
                            if (!skip) {
                              results4.push(drawSeenAvatar(entity[chat_id], e.event_id, viewstate, entity));
                            } else {
                              results4.push(void 0);
                            }
                          }
                          return results4;
                        })());
                      }
                      return results3;
                    });
                  }));
                }
              }
              return results2;
            })());
          }
          return results1;
        })());
      }
      return results;
    });
    // Go through all the participants and only show his last seen status
    if ((c != null ? c.current_participant : void 0) != null) {
      ref1 = c.current_participant;
      for (l = 0, len1 = ref1.length; l < len1; l++) {
        participant = ref1[l];
        // get all avatars
        all_seen = document.querySelectorAll(`.seen[data-id='${participant.chat_id}']`);
      }
    }
    // select last one
    //  NOT WORKING
    //if all_seen.length > 0
    //    all_seen.forEach (el) ->
    //        el.classList.remove 'show'
    //    all_seen[all_seen.length - 1].classList.add 'show'
    if (lastConv !== conv_id) {
      lastConv = conv_id;
      return later(atTopIfSmall);
    }
  });

  drawMessageAvatar = function(u, sender, viewstate, entity) {
    return div({
      class: 'sender-wrapper'
    }, function() {
      a({
        href: linkto(u.cid),
        title: sender
      }, {onclick}, {
        class: 'sender'
      }, function() {
        return drawAvatar(u.cid, viewstate, entity);
      });
      return span(sender);
    });
  };

  groupEventsByMessageType = function(event) {
    var e, index, j, len, prevWasMe, res;
    res = [];
    index = 0;
    prevWasMe = true;
    for (j = 0, len = event.length; j < len; j++) {
      e = event[j];
      if (isMeMessage(e)) {
        index = res.push([e]);
        prevWasMe = true;
      } else {
        if (prevWasMe) {
          index = res.push([e]);
        } else {
          res[index - 1].push(e);
        }
        prevWasMe = false;
      }
    }
    return res;
  };

  isMeMessage = function(e) {
    var ref, ref1, ref2;
    return (e != null ? (ref = e.chat_message) != null ? (ref1 = ref.annotation) != null ? (ref2 = ref1[0]) != null ? ref2[0] : void 0 : void 0 : void 0 : void 0) === HANGOUT_ANNOTATION_TYPE.me_message;
  };

  drawSeenAvatar = function(u, event_id, viewstate, entity) {
    var initials;
    initials = initialsof(u);
    return div({
      class: "seen",
      "data-id": u.id,
      "data-event-id": event_id,
      title: u.display_name
    }, function() {
      return drawAvatar(u.id, viewstate, entity);
    });
  };

  drawMeMessage = function(e) {
    return div({
      class: 'message'
    }, function() {
      var ref;
      return (ref = e.chat_message) != null ? ref.message_content.segment[0].text : void 0;
    });
  };

  drawMessage = function(e, entity) {
    var c, j, len, mclz, title;
    // console.log 'message', e.chat_message
    mclz = ['message'];
    for (j = 0, len = MESSAGE_CLASSES.length; j < len; j++) {
      c = MESSAGE_CLASSES[j];
      if (e[c] != null) {
        mclz.push(c);
      }
    }
    title = e.timestamp ? moment(e.timestamp / 1000).calendar() : null;
    return div({
      id: e.event_id,
      key: e.event_id,
      class: mclz.join(' '),
      title: title,
      dir: 'auto'
    }, function() {
      var content, ents, hangout_event, names, ref, style, t;
      if (e.chat_message) {
        content = (ref = e.chat_message) != null ? ref.message_content : void 0;
        format(content);
        // loadInlineImages content
        if (e.placeholder && e.uploadimage) {
          return span({
            class: 'material-icons spin'
          }, 'donut_large');
        }
      } else if (e.conversation_rename) {
        return pass(`renamed conversation to ${e.conversation_rename.new_name}`);
      // {new_name: "labbot" old_name: ""}
      } else if (e.membership_change) {
        t = e.membership_change.type;
        ents = e.membership_change.participant_ids.map(function(p) {
          return entity[p.chat_id];
        });
        names = ents.map(nameof).join(', ');
        if (t === 'JOIN') {
          return pass(`invited ${names}`);
        } else if (t === 'LEAVE') {
          return pass(`${names} left the conversation`);
        }
      } else if (e.hangout_event) {
        hangout_event = e.hangout_event;
        style = {
          'vertical-align': 'middle'
        };
        if (hangout_event.event_type === 'START_HANGOUT') {
          span({
            class: 'material-icons',
            style
          }, 'call_made_small');
          return pass(' Call started');
        } else if (hangout_event.event_type === 'END_HANGOUT') {
          span({
            class: 'material-icons small',
            style
          }, 'call_end');
          return pass(' Call ended');
        }
      } else {
        return console.log('unhandled event type', e, entity);
      }
    });
  };

  atTopIfSmall = function() {
    var msgel, screl;
    screl = document.querySelector('.main');
    msgel = document.querySelector('.messages');
    return action('attop', (msgel != null ? msgel.offsetHeight : void 0) < (screl != null ? screl.offsetHeight : void 0));
  };

  // when there's mutation, we scroll to bottom in case we already are at bottom
  onMutate = function(viewstate) {
    return throttle(10, function() {
      if (viewstate.atbottom) {
        // jump to bottom to follow conv
        return scrollToBottom();
      }
    });
  };

  scrollToBottom = module.exports.scrollToBottom = function() {
    var el;
    // ensure we're scrolled to bottom
    el = document.querySelector('.main');
    // to bottom
    return el.scrollTop = Number.MAX_SAFE_INTEGER;
  };

  ifpass = function(t, f) {
    if (t) {
      return f;
    } else {
      return pass;
    }
  };

  format = function(cont) {
    var e, i, j, len, ref, ref1, seg;
    if ((cont != null ? cont.attachment : void 0) != null) {
      try {
        formatAttachment(cont.attachment);
      } catch (error) {
        e = error;
        console.error(e);
      }
    }
    ref1 = (ref = cont != null ? cont.segment : void 0) != null ? ref : [];
    for (i = j = 0, len = ref1.length; j < len; i = ++j) {
      seg = ref1[i];
      if (cont.proxied && i < 1) {
        continue;
      }
      formatters.forEach(function(fn) {
        return fn(seg, cont);
      });
    }
    return null;
  };

  formatters = [
    // text formatter
    function(seg,
    cont) {
      var f,
    href,
    ref,
    ref1;
      f = (ref = seg.formatting) != null ? ref : {};
      href = seg != null ? (ref1 = seg.link_data) != null ? ref1.link_target : void 0 : void 0;
      return ifpass(href,
    (function(f) {
        return a({href,
    onclick},
    f);
      }))(function() {
        return ifpass(f.bold,
    b)(function() {
          return ifpass(f.italic,
    i)(function() {
            return ifpass(f.underline,
    u)(function() {
              return ifpass(f.strikethrough,
    s)(function() {
                return pass(cont.proxied ? stripProxiedColon(seg.text) : seg.type === 'LINE_BREAK' ? '\n' : seg.text);
              });
            });
          });
        });
      });
    },
    // image formatter
    function(seg) {
      var href,
    imageUrl,
    ref;
      href = seg != null ? (ref = seg.link_data) != null ? ref.link_target : void 0 : void 0;
      imageUrl = getImageUrl(href); // false if can't find one
      if (imageUrl && preload(imageUrl)) {
        return div(function() {
          if (models.viewstate.showImagePreview) {
            return img({
              src: imageUrl
            });
          } else {
            return a({imageUrl,
    onclick});
          }
        });
      }
    },
    // twitter preview
    function(seg) {
      var data,
    href,
    matches;
      href = seg != null ? seg.text : void 0;
      if (!href) {
        return;
      }
      matches = href.match(/^(https?:\/\/)(.+\.)?(twitter.com\/.+\/status\/.+)/);
      if (!matches) {
        return;
      }
      data = preloadTweet(matches[1] + matches[3]);
      if (!data) {
        return;
      }
      return div({
        class: 'tweet'
      },
    function() {
        if (data.text) {
          p(function() {
            return data.text;
          });
        }
        if (data.imageUrl && (preload(data.imageUrl)) && models.viewstate.showImagePreview) {
          return img({
            src: data.imageUrl
          });
        }
      });
    },
    // instagram preview
    function(seg) {
      var data,
    href,
    matches;
      href = seg != null ? seg.text : void 0;
      if (!href) {
        return;
      }
      matches = href.match(/^(https?:\/\/)(.+\.)?(instagram.com\/p\/.+)/);
      if (!matches) {
        return;
      }
      data = preloadInstagramPhoto('https://api.instagram.com/oembed/?url=' + href);
      if (!data) {
        return;
      }
      return div({
        class: 'instagram'
      },
    function() {
        if (data.text) {
          p(function() {
            return data.text;
          });
        }
        if (data.imageUrl && (preload(data.imageUrl)) && models.viewstate.showImagePreview) {
          return img({
            src: data.imageUrl
          });
        }
      });
    }
  ];

  stripProxiedColon = function(txt) {
    if ((txt != null ? txt.indexOf(": ") : void 0) === 0) {
      return txt.substring(2);
    } else {
      return txt;
    }
  };

  preload_cache = {};

  preload = function(href) {
    var cache, el;
    cache = preload_cache[href];
    if (!cache) {
      el = document.createElement('img');
      el.onload = function() {
        if (typeof el.naturalWidth !== 'number') {
          return;
        }
        el.loaded = true;
        return later(function() {
          return action('loadedimg');
        });
      };
      el.onerror = function() {
        return console.log('error loading image', href);
      };
      el.src = href;
      preload_cache[href] = el;
    }
    return cache != null ? cache.loaded : void 0;
  };

  preloadTweet = function(href) {
    var cache;
    cache = preload_cache[href];
    if (!cache) {
      preload_cache[href] = {};
      fetch(href).then(function(response) {
        return response.text();
      }).then(function(html) {
        var container, frag, image, textNode;
        frag = document.createElement('div');
        frag.innerHTML = html;
        container = frag.querySelector('[data-associated-tweet-id]');
        textNode = container.querySelector('.tweet-text');
        image = container.querySelector('[data-image-url]');
        preload_cache[href].text = textNode.textContent;
        preload_cache[href].imageUrl = image != null ? image.dataset.imageUrl : void 0;
        return later(function() {
          return action('loadedtweet');
        });
      });
    }
    return cache;
  };

  preloadInstagramPhoto = function(href) {
    var cache;
    cache = preload_cache[href];
    if (!cache) {
      preload_cache[href] = {};
      fetch(href).then(function(response) {
        return response.json();
      }).then(function(json) {
        preload_cache[href].text = json.title;
        preload_cache[href].imageUrl = json.thumbnail_url;
        return later(function() {
          return action('loadedinstagramphoto');
        });
      });
    }
    return cache;
  };

  formatAttachment = function(att) {
    var data, href, original_content_url, ref, ref1, ref2, ref3, thumb;
    // console.log 'attachment', att if att.length > 0
    if (att != null ? (ref = att[0]) != null ? (ref1 = ref.embed_item) != null ? ref1.type_ : void 0 : void 0 : void 0) {
      data = extractProtobufStyle(att);
      if (!data) {
        return;
      }
      ({href, thumb, original_content_url} = data);
    } else if (att != null ? (ref2 = att[0]) != null ? (ref3 = ref2.embed_item) != null ? ref3.type : void 0 : void 0 : void 0) {
      console.log('THIS SHOULD NOT HAPPEN WTF !!');
      data = extractProtobufStyle(att);
      if (!data) {
        return;
      }
      ({href, thumb, original_content_url} = data);
    } else {
      if ((att != null ? att.length : void 0) !== 0) {
        console.warn('ignoring attachment', att);
      }
      return;
    }
    if (!href) {
      // stickers do not have an href so we link to the original content instead
      href = original_content_url;
    }
    // here we assume attachments are only images
    if (preload(thumb)) {
      return div({
        class: 'attach'
      }, function() {
        return a({href, onclick}, function() {
          if (models.viewstate.showImagePreview) {
            return img({
              src: thumb
            });
          } else {
            return i18n.__('conversation.no_preview_image_click_to_open:Image preview is disabled: click to open it in the browser');
          }
        });
      });
    }
  };

  handle('loadedimg', function() {
    // allow controller to record current position
    updated('beforeImg');
    // will do the redraw inserting the image
    updated('conv');
    // fix the position after redraw
    return updated('afterImg');
  });

  handle('loadedtweet', function() {
    return updated('conv');
  });

  handle('loadedinstagramphoto', function() {
    return updated('conv');
  });

  extractProtobufStyle = function(att) {
    var data, embed_item, href, isVideo, k, original_content_url, plus_photo, ref, ref1, ref10, ref11, ref12, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, t, thumb, type_;
    href = null;
    thumb = null;
    embed_item = att != null ? (ref = att[0]) != null ? ref.embed_item : void 0 : void 0;
    ({plus_photo, data, type_} = embed_item != null ? embed_item : {});
    if (plus_photo != null) {
      href = (ref1 = plus_photo.data) != null ? ref1.url : void 0;
      thumb = (ref2 = plus_photo.data) != null ? (ref3 = ref2.thumbnail) != null ? ref3.image_url : void 0 : void 0;
      href = (ref4 = plus_photo.data) != null ? (ref5 = ref4.thumbnail) != null ? ref5.url : void 0 : void 0;
      original_content_url = (ref6 = plus_photo.data) != null ? ref6.original_content_url : void 0;
      isVideo = ((ref7 = plus_photo.data) != null ? ref7.media_type : void 0) !== 'MEDIA_TYPE_PHOTO';
      return {href, thumb, original_content_url};
    }
    t = type_ != null ? type_[0] : void 0;
    if (t !== 249) {
      return console.warn('ignoring (old) attachment type', att);
    }
    k = (ref8 = Object.keys(data)) != null ? ref8[0] : void 0;
    if (!k) {
      return;
    }
    href = data != null ? (ref9 = data[k]) != null ? ref9[5] : void 0 : void 0;
    thumb = data != null ? (ref10 = data[k]) != null ? ref10[9] : void 0 : void 0;
    if (!thumb) {
      href = data != null ? (ref11 = data[k]) != null ? ref11[4] : void 0 : void 0;
      thumb = data != null ? (ref12 = data[k]) != null ? ref12[5] : void 0 : void 0;
    }
    return {href, thumb, original_content_url};
  };

  extractObjectStyle = function(att) {
    var eitem, href, it, ref, ref1, thumb, type;
    eitem = att != null ? (ref = att[0]) != null ? ref.embed_item : void 0 : void 0;
    ({type} = eitem != null ? eitem : {});
    if ((type != null ? type[0] : void 0) === "PLUS_PHOTO") {
      it = eitem["embeds.PlusPhoto.plus_photo"];
      href = it != null ? it.url : void 0;
      thumb = it != null ? (ref1 = it.thumbnail) != null ? ref1.url : void 0 : void 0;
      return {href, thumb};
    } else {
      return console.warn('ignoring (new) type', type);
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvbWVzc2FnZXMuanMiLCJzb3VyY2VzIjpbInVpL3ZpZXdzL21lc3NhZ2VzLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsTUFBQSxFQUFBLHVCQUFBLEVBQUEsZUFBQSxFQUFBLFlBQUEsRUFBQSxZQUFBLEVBQUEsVUFBQSxFQUFBLGFBQUEsRUFBQSxXQUFBLEVBQUEsaUJBQUEsRUFBQSxjQUFBLEVBQUEsa0JBQUEsRUFBQSxvQkFBQSxFQUFBLFdBQUEsRUFBQSxVQUFBLEVBQUEsT0FBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUEsZ0JBQUEsRUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLEVBQUEsd0JBQUEsRUFBQSxNQUFBLEVBQUEsVUFBQSxFQUFBLEtBQUEsRUFBQSxXQUFBLEVBQUEsUUFBQSxFQUFBLEtBQUEsRUFBQSxNQUFBLEVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxVQUFBLEVBQUEsUUFBQSxFQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUEscUJBQUEsRUFBQSxZQUFBLEVBQUEsYUFBQSxFQUFBLGNBQUEsRUFBQSxLQUFBLEVBQUEsaUJBQUEsRUFBQSxRQUFBLEVBQUEsR0FBQSxFQUFBOztFQUFBLE1BQUEsR0FBWSxPQUFBLENBQVEsUUFBUjs7RUFDWixLQUFBLEdBQVksT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDaEMsU0FBQSxHQUFZLE9BQUEsQ0FBUSxnQkFBUjs7RUFDWixHQUFBLEdBQVksT0FBQSxDQUFRLEtBQVI7O0VBRVosQ0FBQSxDQUFDLE1BQUQsRUFBUyxVQUFULEVBQXFCLFVBQXJCLEVBQWlDLE1BQWpDLEVBQXlDLEtBQXpDLEVBQWdELFdBQWhELEVBQTZELFFBQTdELEVBQ0EsY0FEQSxFQUNnQixPQURoQixFQUN5QixLQUR6QixFQUNnQyxXQURoQyxFQUM2QyxVQUQ3QyxDQUFBLEdBQzRELE9BQUEsQ0FBUSxTQUFSLENBRDVEOztFQUdBLE1BQUEsR0FB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QUFFLENBQUYsb0JBRnBCOztXQUlBLENBQUMsSUFBRCxFQUFPLEtBQVAsRUFBYyxvQkFBZDtFQXhCbUI7O0VBMEJ2QixrQkFBQSxHQUFxQixRQUFBLENBQUMsR0FBRCxDQUFBO0FBQ3JCLFFBQUEsS0FBQSxFQUFBLElBQUEsRUFBQSxFQUFBLEVBQUEsR0FBQSxFQUFBLElBQUEsRUFBQSxLQUFBLEVBQUE7SUFBSSxLQUFBLDZDQUFlLENBQUU7SUFDakIsQ0FBQSxDQUFDLElBQUQsQ0FBQSxtQkFBUyxRQUFRLENBQUEsQ0FBakI7SUFDQSxvQkFBRyxJQUFJLENBQUUsQ0FBRixXQUFKLEtBQVksWUFBZjtNQUNJLEVBQUEsR0FBSyxLQUFLLENBQUMsNkJBQUQ7TUFDVixJQUFBLGdCQUFPLEVBQUUsQ0FBRTtNQUNYLEtBQUEsb0RBQXFCLENBQUU7QUFDdkIsYUFBTyxDQUFDLElBQUQsRUFBTyxLQUFQLEVBSlg7S0FBQSxNQUFBO2FBTUksT0FBTyxDQUFDLElBQVIsQ0FBYSxxQkFBYixFQUFvQyxJQUFwQyxFQU5KOztFQUhpQjtBQTllckIiLCJzb3VyY2VzQ29udGVudCI6WyJtb21lbnQgICAgPSByZXF1aXJlICdtb21lbnQnXG5zaGVsbCAgICAgPSByZXF1aXJlKCdlbGVjdHJvbicpLnNoZWxsXG51cmxSZWdleHAgPSByZXF1aXJlICd1YmVyLXVybC1yZWdleCdcbnVybCAgICAgICA9IHJlcXVpcmUgJ3VybCdcblxue25hbWVvZiwgaW5pdGlhbHNvZiwgbmFtZW9mY29udiwgbGlua3RvLCBsYXRlciwgZm9yY2VyZWRyYXcsIHRocm90dGxlLFxuZ2V0UHJveGllZE5hbWUsIGZpeGxpbmssIGlzSW1nLCBnZXRJbWFnZVVybCwgZHJhd0F2YXRhcn0gID0gcmVxdWlyZSAnLi4vdXRpbCdcblxuQ1VUT0ZGID0gNSAqIDYwICogMTAwMCAqIDEwMDAgIyA1IG1pbnNcblxuIyBjaGF0X21lc3NhZ2U6XG4jICAge1xuIyAgICAgYW5ub3RhdGlvbjogW1xuIyAgICAgICBbNCwgXCJcIl1cbiMgICAgIF1cbiMgICAgIG1lc3NhZ2VfY29udGVudDoge1xuIyAgICAgICBhdHRhY2hlbWVudDogW11cbiMgICAgICAgc2VnbWVudDogW3sgLi4uIH1dXG4jICAgICB9XG4jICAgfVxuSEFOR09VVF9BTk5PVEFUSU9OX1RZUEUgPSB7XG4gICAgbWVfbWVzc2FnZTogNFxufVxuXG4jIHRoaXMgaGVscHMgZml4aW5nIGhvdXRzIHByb3hpZWQgd2l0aCB0aGluZ3MgbGlrZSBoYW5ndXBzYm90XG4jIHRoZSBmb3JtYXQgb2YgcHJveGllZCBtZXNzYWdlcyBhcmVcbiMgYW5kIGhlcmUgd2UgcHV0IGVudGl0aWVzIGluIHRoZSBlbnRpdHkgZGIgZm9yXG4jIHVzZXJzIGZvdW5kIG9ubHkgaW4gcHJveGllZCBtZXNzYWdlcy5cbmZpeFByb3hpZWQgPSAoZSwgcHJveGllZCwgZW50aXR5KSAtPlxuICAgIHJldHVybiB1bmxlc3MgZT8uY2hhdF9tZXNzYWdlPy5tZXNzYWdlX2NvbnRlbnQ/XG4gICAgZS5jaGF0X21lc3NhZ2UubWVzc2FnZV9jb250ZW50LnByb3hpZWQgPSB0cnVlXG4gICAgbmFtZSA9IGU/LmNoYXRfbWVzc2FnZT8ubWVzc2FnZV9jb250ZW50Py5zZWdtZW50WzBdPy50ZXh0XG4gICAgIyB1cGRhdGUgZmFsbGJhY2tfbmFtZSBmb3IgZW50aXR5IGRhdGFiYXNlXG4gICAgaWYgbmFtZSAhPSAnPj4nXG4gICAgICAgICMgc3ludGhldGljIGFkZCBvZiBmYWxsYmFja19uYW1lXG4gICAgICAgIGVudGl0eS5hZGQge1xuICAgICAgICAgICAgaWQ6IHtcbiAgICAgICAgICAgICAgICBnYWlhX2lkOiBwcm94aWVkXG4gICAgICAgICAgICAgICAgY2hhdF9pZDogcHJveGllZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmFsbGJhY2tfbmFtZTogbmFtZVxuICAgICAgICB9LCBzaWxlbnQ6dHJ1ZVxuXG5vbmNsaWNrID0gKGUpIC0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgYWRkcmVzcyA9IGUuY3VycmVudFRhcmdldC5nZXRBdHRyaWJ1dGUgJ2hyZWYnXG5cbiAgICBwYXR0ID0gbmV3IFJlZ0V4cChcIl4oaHR0cHM/WzpdWy9dWy9dd3d3Wy5dZ29vZ2xlWy5dKGNvbXxbYS16XVthLXpdKVsvXXVybFs/XXFbPV0pKFteJl0rKSgmLispKlwiKVxuICAgIGlmIHBhdHQudGVzdChhZGRyZXNzKVxuICAgICAgICBhZGRyZXNzID0gYWRkcmVzcy5yZXBsYWNlKHBhdHQsICckMycpXG4gICAgICAgIGFkZHJlc3MgPSB1bmVzY2FwZShhZGRyZXNzKVxuICAgICAgICAjIHRoaXMgaXMgYSBsaW5rIG91dHNpZGUgZ29vZ2xlIGFuZCBjYW4gYmUgb3BlbmVkIGRpcmVjdGx5XG4gICAgICAgICMgIGFzIHRoZXJlIGlzIG5vIG5lZWQgZm9yIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgIHNoZWxsLm9wZW5FeHRlcm5hbChmaXhsaW5rKGFkZHJlc3MpKVxuICAgICAgICByZXR1cm5cblxuICAgIGlmIHVybFJlZ2V4cCh7ZXhhY3Q6IHRydWV9KS50ZXN0KGFkZHJlc3MpXG4gICAgICAgIHVubGVzcyB1cmwucGFyc2UoYWRkcmVzcykuaG9zdD9cbiAgICAgICAgICAgIGFkZHJlc3MgPSBcImh0dHA6Ly8je2FkZHJlc3N9XCJcblxuICAgIGZpbmFsVXJsID0gZml4bGluayhhZGRyZXNzKVxuXG4gICAgIyBHb29nbGUgYXBpcyBnaXZlIHVzIGFuIHVybCB0aGF0IGlzIG9ubHkgdmFsaWQgZm9yIHRoZSBjdXJyZW50IGxvZ2dlZCB1c2VyLlxuICAgICMgV2UgY2FuJ3Qgb3BlbiB0aGlzIHVybCBpbiB0aGUgZXh0ZXJuYWwgYnJvd3NlciBiZWNhdXNlIGl0IG1heSBub3QgYmUgYXV0aGVudGljYXRlZFxuICAgICMgb3IgbWF5IGJlIGF1dGhlbnRpY2F0ZWQgZGlmZmVyZW50bHkgKGFub3RoZXIgdXNlciBvciBtdWx0aXBsZSB1c2VycykuXG4gICAgIyBJbiB0aGlzIGNhc2Ugd2UgdHJ5IHRvIG9wZW4gdGhlIHVybCBvdXJzZWx2ZXMgdW50aWwgd2UgZ2V0IHJlZGlyZWN0ZWQgdG8gdGhlIGZpbmFsIHVybFxuICAgICMgb2YgdGhlIGltYWdlL3ZpZGVvLlxuICAgICMgVGhlIGZpbmFsVVJMIHdpbGwgYmUgY2RuLWhvc3RlZCwgc3RhdGljIGFuZCBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgIyBzbyB3ZSBjYW4gZmluYWxseSBvcGVuIGl0IGluIHRoZSBleHRlcm5hbCBicm93c2VyIDooXG5cbiAgICB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3RcblxuICAgICMgU2hvd2luZyBtZXNzYWdlIHdpdGggMyBzZWNvbmQgZGVsYXkgc2hvd2luZyB0aGUgdXNlciB0aGF0IHNvbWV0aGluZyBpcyBoYXBwZW5pbmdcbiAgICBub3RyIHtcbiAgICAgICAgaHRtbDogaTE4bi5fXyAnY29udmVyc2F0aW9uLm9wZW5fbGluazpPcGVuaW5nIHRoZSBsaW5rIGluIHRoZSBicm93c2VyLi4uJ1xuICAgICAgICBzdGF5OiAzMDAwXG4gICAgfVxuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IChlKSAtPlxuICAgICAgICByZXR1cm4gaWYgZS50YXJnZXQuc3RhdHVzIGlzIDBcbiAgICAgICAgcmV0dXJuIGlmIHhoci5yZWFkeVN0YXRlIGlzbnQgNFxuICAgICAgICByZWRpcmVjdGVkID0gZmluYWxVcmwuaW5kZXhPZih4aHIucmVzcG9uc2VVUkwpICE9IDBcbiAgICAgICAgaWYgcmVkaXJlY3RlZFxuICAgICAgICAgICAgZmluYWxVcmwgPSB4aHIucmVzcG9uc2VVUkxcbiAgICAgICAgc2hlbGwub3BlbkV4dGVybmFsKGZpbmFsVXJsKVxuICAgICAgICB4aHIuYWJvcnQoKVxuXG4gICAgeGhyLm9wZW4oXCJnZXRcIiwgZmluYWxVcmwpXG4gICAgeGhyLnNlbmQoKVxuXG4jIGhlbHBlciBtZXRob2QgdG8gZ3JvdXAgZXZlbnRzIGluIHRpbWUvdXNlciBidW5jaGVzXG5ncm91cEV2ZW50cyA9IChlcywgZW50aXR5KSAtPlxuICAgIGdyb3VwcyA9IFtdXG4gICAgZ3JvdXAgPSBudWxsXG4gICAgdXNlciA9IG51bGxcbiAgICBmb3IgZSBpbiBlc1xuICAgICAgICBpZiBlLnRpbWVzdGFtcCAtIChncm91cD8uZW5kID8gMCkgPiBDVVRPRkZcbiAgICAgICAgICAgIGdyb3VwID0ge1xuICAgICAgICAgICAgICAgIGJ5dXNlcjogW11cbiAgICAgICAgICAgICAgICBzdGFydDogZS50aW1lc3RhbXBcbiAgICAgICAgICAgICAgICBlbmQ6IGUudGltZXN0YW1wXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB1c2VyID0gbnVsbFxuICAgICAgICAgICAgZ3JvdXBzLnB1c2ggZ3JvdXBcbiAgICAgICAgcHJveGllZCA9IGdldFByb3hpZWROYW1lKGUpXG4gICAgICAgIGlmIHByb3hpZWRcbiAgICAgICAgICAgIGZpeFByb3hpZWQgZSwgcHJveGllZCwgZW50aXR5XG4gICAgICAgIGNpZCA9IGlmIHByb3hpZWQgdGhlbiBwcm94aWVkIGVsc2UgZT8uc2VuZGVyX2lkPy5jaGF0X2lkXG4gICAgICAgIGlmIGNpZCAhPSB1c2VyPy5jaWRcbiAgICAgICAgICAgIGdyb3VwLmJ5dXNlci5wdXNoIHVzZXIgPSB7XG4gICAgICAgICAgICAgICAgY2lkOiBjaWRcbiAgICAgICAgICAgICAgICBldmVudDogW11cbiAgICAgICAgICAgIH1cbiAgICAgICAgdXNlci5ldmVudC5wdXNoIGVcbiAgICAgICAgZ3JvdXAuZW5kID0gZS50aW1lc3RhbXBcbiAgICBncm91cHNcblxuIyBwb3NzaWJsZSBjbGFzc2VzIG9mIG1lc3NhZ2VzXG5NRVNTQUdFX0NMQVNTRVMgPSBbJ3BsYWNlaG9sZGVyJywgJ2NoYXRfbWVzc2FnZScsXG4nY29udmVyc2F0aW9uX3JlbmFtZScsICdtZW1iZXJzaGlwX2NoYW5nZSddXG5cbk9CU0VSVkVfT1BUUyA9XG4gICAgY2hpbGRMaXN0OnRydWVcbiAgICBhdHRyaWJ1dGVzOnRydWVcbiAgICBhdHRyaWJ1dGVPbGRWYWx1ZTp0cnVlXG4gICAgc3VidHJlZTp0cnVlXG5cbmZpcnN0UmVuZGVyICAgICAgID0gdHJ1ZVxubGFzdENvbnYgICAgICAgICAgPSBudWxsICMgdG8gZGV0ZWN0IGNvbnYgc3dpdGNoaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gdmlldyAobW9kZWxzKSAtPlxuICAgIHt2aWV3c3RhdGUsIGNvbnYsIGVudGl0eX0gPSBtb2RlbHNcblxuICAgICMgbXV0YXRpb24gZXZlbnRzIGtpY2tzIGluIGFmdGVyIGZpcnN0IHJlbmRlclxuICAgIGxhdGVyIG9uTXV0YXRlKHZpZXdzdGF0ZSkgaWYgZmlyc3RSZW5kZXJcbiAgICBmaXJzdFJlbmRlciA9IGZhbHNlXG5cbiAgICBjb252X2lkID0gdmlld3N0YXRlPy5zZWxlY3RlZENvbnZcbiAgICBjID0gY29udltjb252X2lkXVxuICAgIGlmIGM/LmN1cnJlbnRfcGFydGljaXBhbnQ/XG4gICAgICAgIGZvciBwYXJ0aWNpcGFudCBpbiBjLmN1cnJlbnRfcGFydGljaXBhbnRcbiAgICAgICAgICAgIGVudGl0eS5uZWVkRW50aXR5IHBhcnRpY2lwYW50LmNoYXRfaWRcbiAgICBkaXYgY2xhc3M6J21lc3NhZ2VzJywgb2JzZXJ2ZTpvbk11dGF0ZSh2aWV3c3RhdGUpLCAtPlxuICAgICAgICByZXR1cm4gdW5sZXNzIGM/LmV2ZW50XG5cbiAgICAgICAgZ3JvdXBlZCA9IGdyb3VwRXZlbnRzIGMuZXZlbnQsIGVudGl0eVxuICAgICAgICBkaXYgY2xhc3M6J2hpc3RvcnlpbmZvJywgLT5cbiAgICAgICAgICAgIGlmIGMucmVxdWVzdGluZ2hpc3RvcnlcbiAgICAgICAgICAgICAgICBwYXNzICdSZXF1ZXN0aW5nIGhpc3RvcnnigKYnLCAtPiBzcGFuIGNsYXNzOidtYXRlcmlhbC1pY29ucyBzcGluJywgJ2RvbnV0X2xhcmdlJ1xuXG4gICAgICAgIGlmICF2aWV3c3RhdGUudXNlU3lzdGVtRGF0ZUZvcm1hdFxuICAgICAgICAgICAgbW9tZW50LmxvY2FsZShpMThuLmdldExvY2FsZSgpKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBtb21lbnQubG9jYWxlKHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2UpXG5cbiAgICAgICAgbGFzdF9zZWVuID0gY29udi5maW5kTGFzdFJlYWRFdmVudHNCeVVzZXIoYylcbiAgICAgICAgbGFzdF9zZWVuX2NoYXRfaWRzX3dpdGhfZXZlbnQgPSAobGFzdF9zZWVuLCBldmVudCkgLT5cbiAgICAgICAgICAgIChjaGF0X2lkIGZvciBjaGF0X2lkLCBlIG9mIGxhc3Rfc2VlbiB3aGVuIGV2ZW50IGlzIGUpXG5cbiAgICAgICAgZm9yIGcgaW4gZ3JvdXBlZFxuICAgICAgICAgICAgZGl2IGNsYXNzOid0aW1lc3RhbXAnLCBtb21lbnQoZy5zdGFydCAvIDEwMDApLmNhbGVuZGFyKClcbiAgICAgICAgICAgIGZvciB1IGluIGcuYnl1c2VyXG4gICAgICAgICAgICAgICAgc2VuZGVyID0gbmFtZW9mIGVudGl0eVt1LmNpZF1cbiAgICAgICAgICAgICAgICBmb3IgZXZlbnRzIGluIGdyb3VwRXZlbnRzQnlNZXNzYWdlVHlwZSB1LmV2ZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIGlzTWVNZXNzYWdlIGV2ZW50c1swXVxuICAgICAgICAgICAgICAgICAgICAgICAgIyBhbGwgaXRlbXMgYXJlIC9tZSBtZXNzYWdlcyBpZiB0aGUgZmlyc3Qgb25lIGlzIGR1ZSB0byBncm91cGluZyBhYm92ZVxuICAgICAgICAgICAgICAgICAgICAgICAgZGl2IGNsYXNzOid1Z3JvdXAgbWUnLCAtPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYXdNZXNzYWdlQXZhdGFyIHUsIHNlbmRlciwgdmlld3N0YXRlLCBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmF3TWVNZXNzYWdlIGUgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGNseiA9IFsndWdyb3VwJ11cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsei5wdXNoICdzZWxmJyBpZiBlbnRpdHkuaXNTZWxmKHUuY2lkKVxuICAgICAgICAgICAgICAgICAgICAgICAgZGl2IGNsYXNzOmNsei5qb2luKCcgJyksIC0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd01lc3NhZ2VBdmF0YXIgdSwgc2VuZGVyLCB2aWV3c3RhdGUsIGVudGl0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpdiBjbGFzczondW1lc3NhZ2VzJywgLT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd01lc3NhZ2UoZSwgZW50aXR5KSBmb3IgZSBpbiBldmVudHNcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICMgYXQgdGhlIGVuZCBvZiB0aGUgZXZlbnRzIGdyb3VwIHdlIGRyYXcgd2hvIGhhcyByZWFkIGFueSBvZiBpdHMgZXZlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGl2IGNsYXNzOiAnc2Vlbi1saXN0JywgKCkgLT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgY2hhdF9pZCBpbiBsYXN0X3NlZW5fY2hhdF9pZHNfd2l0aF9ldmVudChsYXN0X3NlZW4sIGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2tpcCA9IGVudGl0eS5pc1NlbGYoY2hhdF9pZCkgb3IgKGNoYXRfaWQgPT0gdS5jaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhd1NlZW5BdmF0YXIoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eVtjaGF0X2lkXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5ldmVudF9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld3N0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIGlmIG5vdCBza2lwXG5cbiAgICAjIEdvIHRocm91Z2ggYWxsIHRoZSBwYXJ0aWNpcGFudHMgYW5kIG9ubHkgc2hvdyBoaXMgbGFzdCBzZWVuIHN0YXR1c1xuICAgIGlmIGM/LmN1cnJlbnRfcGFydGljaXBhbnQ/XG4gICAgICAgIGZvciBwYXJ0aWNpcGFudCBpbiBjLmN1cnJlbnRfcGFydGljaXBhbnRcbiAgICAgICAgICAgICMgZ2V0IGFsbCBhdmF0YXJzXG4gICAgICAgICAgICBhbGxfc2VlbiA9IGRvY3VtZW50XG4gICAgICAgICAgICAucXVlcnlTZWxlY3RvckFsbChcIi5zZWVuW2RhdGEtaWQ9JyN7cGFydGljaXBhbnQuY2hhdF9pZH0nXVwiKVxuICAgICAgICAgICAgIyBzZWxlY3QgbGFzdCBvbmVcbiAgICAgICAgICAgICMgIE5PVCBXT1JLSU5HXG4gICAgICAgICAgICAjaWYgYWxsX3NlZW4ubGVuZ3RoID4gMFxuICAgICAgICAgICAgIyAgICBhbGxfc2Vlbi5mb3JFYWNoIChlbCkgLT5cbiAgICAgICAgICAgICMgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUgJ3Nob3cnXG4gICAgICAgICAgICAjICAgIGFsbF9zZWVuW2FsbF9zZWVuLmxlbmd0aCAtIDFdLmNsYXNzTGlzdC5hZGQgJ3Nob3cnXG4gICAgaWYgbGFzdENvbnYgIT0gY29udl9pZFxuICAgICAgICBsYXN0Q29udiA9IGNvbnZfaWRcbiAgICAgICAgbGF0ZXIgYXRUb3BJZlNtYWxsXG5cbmRyYXdNZXNzYWdlQXZhdGFyID0gKHUsIHNlbmRlciwgdmlld3N0YXRlLCBlbnRpdHkpIC0+XG4gICAgZGl2IGNsYXNzOiAnc2VuZGVyLXdyYXBwZXInLCAtPlxuICAgICAgICBhIGhyZWY6bGlua3RvKHUuY2lkKSwgdGl0bGU6IHNlbmRlciwge29uY2xpY2t9LCBjbGFzczonc2VuZGVyJywgLT5cbiAgICAgICAgICAgIGRyYXdBdmF0YXIodS5jaWQsIHZpZXdzdGF0ZSwgZW50aXR5KVxuICAgICAgICBzcGFuIHNlbmRlclxuXG5ncm91cEV2ZW50c0J5TWVzc2FnZVR5cGUgPSAoZXZlbnQpIC0+XG4gICAgcmVzID0gW11cbiAgICBpbmRleCA9IDBcbiAgICBwcmV2V2FzTWUgPSB0cnVlXG4gICAgZm9yIGUgaW4gZXZlbnRcbiAgICAgICAgaWYgaXNNZU1lc3NhZ2UgZVxuICAgICAgICAgICAgaW5kZXggPSByZXMucHVzaCBbZV1cbiAgICAgICAgICAgIHByZXZXYXNNZSA9IHRydWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgaWYgcHJldldhc01lXG4gICAgICAgICAgICAgICAgaW5kZXggPSByZXMucHVzaCBbZV1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICByZXNbaW5kZXggLSAxXS5wdXNoIGVcbiAgICAgICAgICAgIHByZXZXYXNNZSA9IGZhbHNlXG4gICAgcmV0dXJuIHJlc1xuXG5pc01lTWVzc2FnZSA9IChlKSAtPlxuICAgIGU/LmNoYXRfbWVzc2FnZT8uYW5ub3RhdGlvbj9bMF0/WzBdID09IEhBTkdPVVRfQU5OT1RBVElPTl9UWVBFLm1lX21lc3NhZ2VcblxuZHJhd1NlZW5BdmF0YXIgPSAodSwgZXZlbnRfaWQsIHZpZXdzdGF0ZSwgZW50aXR5KSAtPlxuICAgIGluaXRpYWxzID0gaW5pdGlhbHNvZiB1XG4gICAgZGl2IGNsYXNzOiBcInNlZW5cIlxuICAgICwgXCJkYXRhLWlkXCI6IHUuaWRcbiAgICAsIFwiZGF0YS1ldmVudC1pZFwiOiBldmVudF9pZFxuICAgICwgdGl0bGU6IHUuZGlzcGxheV9uYW1lXG4gICAgLCAtPlxuICAgICAgICBkcmF3QXZhdGFyKHUuaWQsIHZpZXdzdGF0ZSwgZW50aXR5KVxuXG5kcmF3TWVNZXNzYWdlID0gKGUpIC0+XG4gICAgZGl2IGNsYXNzOidtZXNzYWdlJywgLT5cbiAgICAgICAgZS5jaGF0X21lc3NhZ2U/Lm1lc3NhZ2VfY29udGVudC5zZWdtZW50WzBdLnRleHRcblxuZHJhd01lc3NhZ2UgPSAoZSwgZW50aXR5KSAtPlxuICAgICMgY29uc29sZS5sb2cgJ21lc3NhZ2UnLCBlLmNoYXRfbWVzc2FnZVxuICAgIG1jbHogPSBbJ21lc3NhZ2UnXVxuICAgIG1jbHoucHVzaCBjIGZvciBjIGluIE1FU1NBR0VfQ0xBU1NFUyB3aGVuIGVbY10/XG4gICAgdGl0bGUgPSBpZiBlLnRpbWVzdGFtcCB0aGVuIG1vbWVudChlLnRpbWVzdGFtcCAvIDEwMDApLmNhbGVuZGFyKCkgZWxzZSBudWxsXG4gICAgZGl2IGlkOmUuZXZlbnRfaWQsIGtleTplLmV2ZW50X2lkLCBjbGFzczptY2x6LmpvaW4oJyAnKSwgdGl0bGU6dGl0bGUsIGRpcjogJ2F1dG8nLCAtPlxuICAgICAgICBpZiBlLmNoYXRfbWVzc2FnZVxuICAgICAgICAgICAgY29udGVudCA9IGUuY2hhdF9tZXNzYWdlPy5tZXNzYWdlX2NvbnRlbnRcbiAgICAgICAgICAgIGZvcm1hdCBjb250ZW50XG4gICAgICAgICAgICAjIGxvYWRJbmxpbmVJbWFnZXMgY29udGVudFxuICAgICAgICAgICAgaWYgZS5wbGFjZWhvbGRlciBhbmQgZS51cGxvYWRpbWFnZVxuICAgICAgICAgICAgICAgIHNwYW4gY2xhc3M6J21hdGVyaWFsLWljb25zIHNwaW4nLCAnZG9udXRfbGFyZ2UnXG4gICAgICAgIGVsc2UgaWYgZS5jb252ZXJzYXRpb25fcmVuYW1lXG4gICAgICAgICAgICBwYXNzIFwicmVuYW1lZCBjb252ZXJzYXRpb24gdG8gI3tlLmNvbnZlcnNhdGlvbl9yZW5hbWUubmV3X25hbWV9XCJcbiAgICAgICAgICAgICMge25ld19uYW1lOiBcImxhYmJvdFwiIG9sZF9uYW1lOiBcIlwifVxuICAgICAgICBlbHNlIGlmIGUubWVtYmVyc2hpcF9jaGFuZ2VcbiAgICAgICAgICAgIHQgPSBlLm1lbWJlcnNoaXBfY2hhbmdlLnR5cGVcbiAgICAgICAgICAgIGVudHMgPSBlLm1lbWJlcnNoaXBfY2hhbmdlLnBhcnRpY2lwYW50X2lkcy5tYXAgKHApIC0+IGVudGl0eVtwLmNoYXRfaWRdXG4gICAgICAgICAgICBuYW1lcyA9IGVudHMubWFwKG5hbWVvZikuam9pbignLCAnKVxuICAgICAgICAgICAgaWYgdCA9PSAnSk9JTidcbiAgICAgICAgICAgICAgICBwYXNzIFwiaW52aXRlZCAje25hbWVzfVwiXG4gICAgICAgICAgICBlbHNlIGlmIHQgPT0gJ0xFQVZFJ1xuICAgICAgICAgICAgICAgIHBhc3MgXCIje25hbWVzfSBsZWZ0IHRoZSBjb252ZXJzYXRpb25cIlxuICAgICAgICBlbHNlIGlmIGUuaGFuZ291dF9ldmVudFxuICAgICAgICAgICAgaGFuZ291dF9ldmVudCA9IGUuaGFuZ291dF9ldmVudFxuICAgICAgICAgICAgc3R5bGUgPSAndmVydGljYWwtYWxpZ24nOiAnbWlkZGxlJ1xuICAgICAgICAgICAgaWYgaGFuZ291dF9ldmVudC5ldmVudF90eXBlIGlzICdTVEFSVF9IQU5HT1VUJ1xuICAgICAgICAgICAgICAgIHNwYW4geyBjbGFzczogJ21hdGVyaWFsLWljb25zJywgc3R5bGUgfSwgJ2NhbGxfbWFkZV9zbWFsbCdcbiAgICAgICAgICAgICAgICBwYXNzICcgQ2FsbCBzdGFydGVkJ1xuICAgICAgICAgICAgZWxzZSBpZiBoYW5nb3V0X2V2ZW50LmV2ZW50X3R5cGUgaXMgJ0VORF9IQU5HT1VUJ1xuICAgICAgICAgICAgICAgIHNwYW4geyBjbGFzczonbWF0ZXJpYWwtaWNvbnMgc21hbGwnLCBzdHlsZSB9LCAnY2FsbF9lbmQnXG4gICAgICAgICAgICAgICAgcGFzcyAnIENhbGwgZW5kZWQnXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNvbnNvbGUubG9nICd1bmhhbmRsZWQgZXZlbnQgdHlwZScsIGUsIGVudGl0eVxuXG5cbmF0VG9wSWZTbWFsbCA9IC0+XG4gICAgc2NyZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubWFpbicpXG4gICAgbXNnZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubWVzc2FnZXMnKVxuICAgIGFjdGlvbiAnYXR0b3AnLCBtc2dlbD8ub2Zmc2V0SGVpZ2h0IDwgc2NyZWw/Lm9mZnNldEhlaWdodFxuXG5cbiMgd2hlbiB0aGVyZSdzIG11dGF0aW9uLCB3ZSBzY3JvbGwgdG8gYm90dG9tIGluIGNhc2Ugd2UgYWxyZWFkeSBhcmUgYXQgYm90dG9tXG5vbk11dGF0ZSA9ICh2aWV3c3RhdGUpIC0+IHRocm90dGxlIDEwLCAtPlxuICAgICMganVtcCB0byBib3R0b20gdG8gZm9sbG93IGNvbnZcbiAgICBzY3JvbGxUb0JvdHRvbSgpIGlmIHZpZXdzdGF0ZS5hdGJvdHRvbVxuXG5cbnNjcm9sbFRvQm90dG9tID0gbW9kdWxlLmV4cG9ydHMuc2Nyb2xsVG9Cb3R0b20gPSAtPlxuICAgICMgZW5zdXJlIHdlJ3JlIHNjcm9sbGVkIHRvIGJvdHRvbVxuICAgIGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1haW4nKVxuICAgICMgdG8gYm90dG9tXG4gICAgZWwuc2Nyb2xsVG9wID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJcblxuXG5pZnBhc3MgPSAodCwgZikgLT4gaWYgdCB0aGVuIGYgZWxzZSBwYXNzXG5cbmZvcm1hdCA9IChjb250KSAtPlxuICAgIGlmIGNvbnQ/LmF0dGFjaG1lbnQ/XG4gICAgICAgIHRyeVxuICAgICAgICAgICAgZm9ybWF0QXR0YWNobWVudCBjb250LmF0dGFjaG1lbnRcbiAgICAgICAgY2F0Y2ggZVxuICAgICAgICAgICAgY29uc29sZS5lcnJvciBlXG4gICAgZm9yIHNlZywgaSBpbiBjb250Py5zZWdtZW50ID8gW11cbiAgICAgICAgY29udGludWUgaWYgY29udC5wcm94aWVkIGFuZCBpIDwgMVxuICAgICAgICBmb3JtYXR0ZXJzLmZvckVhY2ggKGZuKSAtPlxuICAgICAgICAgICAgZm4gc2VnLCBjb250XG4gICAgbnVsbFxuXG5cbmZvcm1hdHRlcnMgPSBbXG4gICAgIyB0ZXh0IGZvcm1hdHRlclxuICAgIChzZWcsIGNvbnQpIC0+XG4gICAgICAgIGYgPSBzZWcuZm9ybWF0dGluZyA/IHt9XG4gICAgICAgIGhyZWYgPSBzZWc/LmxpbmtfZGF0YT8ubGlua190YXJnZXRcbiAgICAgICAgaWZwYXNzKGhyZWYsICgoZikgLT4gYSB7aHJlZiwgb25jbGlja30sIGYpKSAtPlxuICAgICAgICAgICAgaWZwYXNzKGYuYm9sZCwgYikgLT5cbiAgICAgICAgICAgICAgICBpZnBhc3MoZi5pdGFsaWMsIGkpIC0+XG4gICAgICAgICAgICAgICAgICAgIGlmcGFzcyhmLnVuZGVybGluZSwgdSkgLT5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmcGFzcyhmLnN0cmlrZXRocm91Z2gsIHMpIC0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFzcyBpZiBjb250LnByb3hpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyaXBQcm94aWVkQ29sb24gc2VnLnRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIHNlZy50eXBlID09ICdMSU5FX0JSRUFLJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXFxuJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VnLnRleHRcbiAgICAjIGltYWdlIGZvcm1hdHRlclxuICAgIChzZWcpIC0+XG4gICAgICAgIGhyZWYgPSBzZWc/LmxpbmtfZGF0YT8ubGlua190YXJnZXRcbiAgICAgICAgaW1hZ2VVcmwgPSBnZXRJbWFnZVVybCBocmVmICMgZmFsc2UgaWYgY2FuJ3QgZmluZCBvbmVcbiAgICAgICAgaWYgaW1hZ2VVcmwgYW5kIHByZWxvYWQgaW1hZ2VVcmxcbiAgICAgICAgICAgIGRpdiAtPlxuICAgICAgICAgICAgICAgIGlmIG1vZGVscy52aWV3c3RhdGUuc2hvd0ltYWdlUHJldmlld1xuICAgICAgICAgICAgICAgICAgICBpbWcgc3JjOiBpbWFnZVVybFxuICAgICAgICAgICAgICAgIGVsc2UgYSB7aW1hZ2VVcmwsIG9uY2xpY2t9XG4gICAgIyB0d2l0dGVyIHByZXZpZXdcbiAgICAoc2VnKSAtPlxuICAgICAgICBocmVmID0gc2VnPy50ZXh0XG4gICAgICAgIGlmICFocmVmXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgbWF0Y2hlcyA9IGhyZWYubWF0Y2ggL14oaHR0cHM/OlxcL1xcLykoLitcXC4pPyh0d2l0dGVyLmNvbVxcLy4rXFwvc3RhdHVzXFwvLispL1xuICAgICAgICBpZiAhbWF0Y2hlc1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIGRhdGEgPSBwcmVsb2FkVHdlZXQgbWF0Y2hlc1sxXSArIG1hdGNoZXNbM11cbiAgICAgICAgaWYgIWRhdGFcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBkaXYgY2xhc3M6J3R3ZWV0JywgLT5cbiAgICAgICAgICAgIGlmIGRhdGEudGV4dFxuICAgICAgICAgICAgICAgIHAgLT5cbiAgICAgICAgICAgICAgICAgICAgZGF0YS50ZXh0XG4gICAgICAgICAgICBpZiBkYXRhLmltYWdlVXJsIGFuZCAocHJlbG9hZCBkYXRhLmltYWdlVXJsKSBhbmQgbW9kZWxzLnZpZXdzdGF0ZS5zaG93SW1hZ2VQcmV2aWV3XG4gICAgICAgICAgICAgICAgaW1nIHNyYzogZGF0YS5pbWFnZVVybFxuICAgICMgaW5zdGFncmFtIHByZXZpZXdcbiAgICAoc2VnKSAtPlxuICAgICAgICBocmVmID0gc2VnPy50ZXh0XG4gICAgICAgIGlmICFocmVmXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgbWF0Y2hlcyA9IGhyZWYubWF0Y2ggL14oaHR0cHM/OlxcL1xcLykoLitcXC4pPyhpbnN0YWdyYW0uY29tXFwvcFxcLy4rKS9cbiAgICAgICAgaWYgIW1hdGNoZXNcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBkYXRhID0gcHJlbG9hZEluc3RhZ3JhbVBob3RvICdodHRwczovL2FwaS5pbnN0YWdyYW0uY29tL29lbWJlZC8/dXJsPScgKyBocmVmXG4gICAgICAgIGlmICFkYXRhXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgZGl2IGNsYXNzOidpbnN0YWdyYW0nLCAtPlxuICAgICAgICAgICAgaWYgZGF0YS50ZXh0XG4gICAgICAgICAgICAgICAgcCAtPlxuICAgICAgICAgICAgICAgICAgICBkYXRhLnRleHRcbiAgICAgICAgICAgIGlmIGRhdGEuaW1hZ2VVcmwgYW5kIChwcmVsb2FkIGRhdGEuaW1hZ2VVcmwpIGFuZCBtb2RlbHMudmlld3N0YXRlLnNob3dJbWFnZVByZXZpZXdcbiAgICAgICAgICAgICAgICBpbWcgc3JjOiBkYXRhLmltYWdlVXJsXG5dXG5cbnN0cmlwUHJveGllZENvbG9uID0gKHR4dCkgLT5cbiAgICBpZiB0eHQ/LmluZGV4T2YoXCI6IFwiKSA9PSAwXG4gICAgICAgIHR4dC5zdWJzdHJpbmcoMilcbiAgICBlbHNlXG4gICAgICAgIHR4dFxuXG5wcmVsb2FkX2NhY2hlID0ge31cblxuXG5wcmVsb2FkID0gKGhyZWYpIC0+XG4gICAgY2FjaGUgPSBwcmVsb2FkX2NhY2hlW2hyZWZdXG4gICAgaWYgbm90IGNhY2hlXG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCAnaW1nJ1xuICAgICAgICBlbC5vbmxvYWQgPSAtPlxuICAgICAgICAgICAgcmV0dXJuIHVubGVzcyB0eXBlb2YgZWwubmF0dXJhbFdpZHRoID09ICdudW1iZXInXG4gICAgICAgICAgICBlbC5sb2FkZWQgPSB0cnVlXG4gICAgICAgICAgICBsYXRlciAtPiBhY3Rpb24gJ2xvYWRlZGltZydcbiAgICAgICAgZWwub25lcnJvciA9IC0+IGNvbnNvbGUubG9nICdlcnJvciBsb2FkaW5nIGltYWdlJywgaHJlZlxuICAgICAgICBlbC5zcmMgPSBocmVmXG4gICAgICAgIHByZWxvYWRfY2FjaGVbaHJlZl0gPSBlbFxuICAgIHJldHVybiBjYWNoZT8ubG9hZGVkXG5cbnByZWxvYWRUd2VldCA9IChocmVmKSAtPlxuICAgIGNhY2hlID0gcHJlbG9hZF9jYWNoZVtocmVmXVxuICAgIGlmIG5vdCBjYWNoZVxuICAgICAgICBwcmVsb2FkX2NhY2hlW2hyZWZdID0ge31cbiAgICAgICAgZmV0Y2ggaHJlZlxuICAgICAgICAudGhlbiAocmVzcG9uc2UpIC0+XG4gICAgICAgICAgICByZXNwb25zZS50ZXh0KClcbiAgICAgICAgLnRoZW4gKGh0bWwpIC0+XG4gICAgICAgICAgICBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCAnZGl2J1xuICAgICAgICAgICAgZnJhZy5pbm5lckhUTUwgPSBodG1sXG4gICAgICAgICAgICBjb250YWluZXIgPSBmcmFnLnF1ZXJ5U2VsZWN0b3IgJ1tkYXRhLWFzc29jaWF0ZWQtdHdlZXQtaWRdJ1xuICAgICAgICAgICAgdGV4dE5vZGUgPSBjb250YWluZXIucXVlcnlTZWxlY3RvciAoJy50d2VldC10ZXh0JylcbiAgICAgICAgICAgIGltYWdlID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IgKCdbZGF0YS1pbWFnZS11cmxdJylcbiAgICAgICAgICAgIHByZWxvYWRfY2FjaGVbaHJlZl0udGV4dCA9IHRleHROb2RlLnRleHRDb250ZW50XG4gICAgICAgICAgICBwcmVsb2FkX2NhY2hlW2hyZWZdLmltYWdlVXJsID0gaW1hZ2U/LmRhdGFzZXQuaW1hZ2VVcmxcbiAgICAgICAgICAgIGxhdGVyIC0+IGFjdGlvbiAnbG9hZGVkdHdlZXQnXG4gICAgcmV0dXJuIGNhY2hlXG5cbnByZWxvYWRJbnN0YWdyYW1QaG90byA9IChocmVmKSAtPlxuICAgIGNhY2hlID0gcHJlbG9hZF9jYWNoZVtocmVmXVxuICAgIGlmIG5vdCBjYWNoZVxuICAgICAgICBwcmVsb2FkX2NhY2hlW2hyZWZdID0ge31cbiAgICAgICAgZmV0Y2ggaHJlZlxuICAgICAgICAudGhlbiAocmVzcG9uc2UpIC0+XG4gICAgICAgICAgICByZXNwb25zZS5qc29uKClcbiAgICAgICAgLnRoZW4gKGpzb24pIC0+XG4gICAgICAgICAgICBwcmVsb2FkX2NhY2hlW2hyZWZdLnRleHQgPSBqc29uLnRpdGxlXG4gICAgICAgICAgICBwcmVsb2FkX2NhY2hlW2hyZWZdLmltYWdlVXJsID0ganNvbi50aHVtYm5haWxfdXJsXG4gICAgICAgICAgICBsYXRlciAtPiBhY3Rpb24gJ2xvYWRlZGluc3RhZ3JhbXBob3RvJ1xuICAgIHJldHVybiBjYWNoZVxuXG5mb3JtYXRBdHRhY2htZW50ID0gKGF0dCkgLT5cbiAgICAjIGNvbnNvbGUubG9nICdhdHRhY2htZW50JywgYXR0IGlmIGF0dC5sZW5ndGggPiAwXG4gICAgaWYgYXR0P1swXT8uZW1iZWRfaXRlbT8udHlwZV9cbiAgICAgICAgZGF0YSA9IGV4dHJhY3RQcm90b2J1ZlN0eWxlKGF0dClcbiAgICAgICAgcmV0dXJuIGlmIG5vdCBkYXRhXG4gICAgICAgIHtocmVmLCB0aHVtYiwgb3JpZ2luYWxfY29udGVudF91cmx9ID0gZGF0YVxuICAgIGVsc2UgaWYgYXR0P1swXT8uZW1iZWRfaXRlbT8udHlwZVxuICAgICAgICBjb25zb2xlLmxvZygnVEhJUyBTSE9VTEQgTk9UIEhBUFBFTiBXVEYgISEnKVxuICAgICAgICBkYXRhID0gZXh0cmFjdFByb3RvYnVmU3R5bGUoYXR0KVxuICAgICAgICByZXR1cm4gaWYgbm90IGRhdGFcbiAgICAgICAge2hyZWYsIHRodW1iLCBvcmlnaW5hbF9jb250ZW50X3VybH0gPSBkYXRhXG4gICAgZWxzZVxuICAgICAgICBjb25zb2xlLndhcm4gJ2lnbm9yaW5nIGF0dGFjaG1lbnQnLCBhdHQgdW5sZXNzIGF0dD8ubGVuZ3RoID09IDBcbiAgICAgICAgcmV0dXJuXG5cbiAgICAjIHN0aWNrZXJzIGRvIG5vdCBoYXZlIGFuIGhyZWYgc28gd2UgbGluayB0byB0aGUgb3JpZ2luYWwgY29udGVudCBpbnN0ZWFkXG4gICAgaHJlZiA9IG9yaWdpbmFsX2NvbnRlbnRfdXJsIHVubGVzcyBocmVmXG5cbiAgICAjIGhlcmUgd2UgYXNzdW1lIGF0dGFjaG1lbnRzIGFyZSBvbmx5IGltYWdlc1xuICAgIGlmIHByZWxvYWQgdGh1bWJcbiAgICAgICAgZGl2IGNsYXNzOidhdHRhY2gnLCAtPlxuICAgICAgICAgICAgYSB7aHJlZiwgb25jbGlja30sIC0+XG4gICAgICAgICAgICAgICAgaWYgbW9kZWxzLnZpZXdzdGF0ZS5zaG93SW1hZ2VQcmV2aWV3XG4gICAgICAgICAgICAgICAgICAgIGltZyBzcmM6dGh1bWJcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5ub19wcmV2aWV3X2ltYWdlX2NsaWNrX3RvX29wZW46SW1hZ2UgcHJldmlldyBpcyBkaXNhYmxlZDogY2xpY2sgdG8gb3BlbiBpdCBpbiB0aGUgYnJvd3NlcicpXG5cbmhhbmRsZSAnbG9hZGVkaW1nJywgLT5cbiAgICAjIGFsbG93IGNvbnRyb2xsZXIgdG8gcmVjb3JkIGN1cnJlbnQgcG9zaXRpb25cbiAgICB1cGRhdGVkICdiZWZvcmVJbWcnXG4gICAgIyB3aWxsIGRvIHRoZSByZWRyYXcgaW5zZXJ0aW5nIHRoZSBpbWFnZVxuICAgIHVwZGF0ZWQgJ2NvbnYnXG4gICAgIyBmaXggdGhlIHBvc2l0aW9uIGFmdGVyIHJlZHJhd1xuICAgIHVwZGF0ZWQgJ2FmdGVySW1nJ1xuXG5oYW5kbGUgJ2xvYWRlZHR3ZWV0JywgLT5cbiAgICB1cGRhdGVkICdjb252J1xuXG5oYW5kbGUgJ2xvYWRlZGluc3RhZ3JhbXBob3RvJywgLT5cbiAgICB1cGRhdGVkICdjb252J1xuXG5leHRyYWN0UHJvdG9idWZTdHlsZSA9IChhdHQpIC0+XG4gICAgaHJlZiA9IG51bGxcbiAgICB0aHVtYiA9IG51bGxcblxuICAgIGVtYmVkX2l0ZW0gPSBhdHQ/WzBdPy5lbWJlZF9pdGVtXG4gICAge3BsdXNfcGhvdG8sIGRhdGEsIHR5cGVffSA9IGVtYmVkX2l0ZW0gPyB7fVxuICAgIGlmIHBsdXNfcGhvdG8/XG4gICAgICAgIGhyZWYgID0gcGx1c19waG90by5kYXRhPy51cmxcbiAgICAgICAgdGh1bWIgPSBwbHVzX3Bob3RvLmRhdGE/LnRodW1ibmFpbD8uaW1hZ2VfdXJsXG4gICAgICAgIGhyZWYgID0gcGx1c19waG90by5kYXRhPy50aHVtYm5haWw/LnVybFxuICAgICAgICBvcmlnaW5hbF9jb250ZW50X3VybCA9IHBsdXNfcGhvdG8uZGF0YT8ub3JpZ2luYWxfY29udGVudF91cmxcbiAgICAgICAgaXNWaWRlbyA9IHBsdXNfcGhvdG8uZGF0YT8ubWVkaWFfdHlwZSBpc250ICdNRURJQV9UWVBFX1BIT1RPJ1xuICAgICAgICByZXR1cm4ge2hyZWYsIHRodW1iLCBvcmlnaW5hbF9jb250ZW50X3VybH1cblxuICAgIHQgPSB0eXBlXz9bMF1cbiAgICByZXR1cm4gY29uc29sZS53YXJuICdpZ25vcmluZyAob2xkKSBhdHRhY2htZW50IHR5cGUnLCBhdHQgdW5sZXNzIHQgPT0gMjQ5XG4gICAgayA9IE9iamVjdC5rZXlzKGRhdGEpP1swXVxuICAgIHJldHVybiB1bmxlc3Mga1xuICAgIGhyZWYgPSBkYXRhP1trXT9bNV1cbiAgICB0aHVtYiA9IGRhdGE/W2tdP1s5XVxuICAgIGlmIG5vdCB0aHVtYlxuICAgICAgICBocmVmID0gZGF0YT9ba10/WzRdXG4gICAgICAgIHRodW1iID0gZGF0YT9ba10/WzVdXG5cbiAgICB7aHJlZiwgdGh1bWIsIG9yaWdpbmFsX2NvbnRlbnRfdXJsfVxuXG5leHRyYWN0T2JqZWN0U3R5bGUgPSAoYXR0KSAtPlxuICAgIGVpdGVtID0gYXR0P1swXT8uZW1iZWRfaXRlbVxuICAgIHt0eXBlfSA9IGVpdGVtID8ge31cbiAgICBpZiB0eXBlP1swXSA9PSBcIlBMVVNfUEhPVE9cIlxuICAgICAgICBpdCA9IGVpdGVtW1wiZW1iZWRzLlBsdXNQaG90by5wbHVzX3Bob3RvXCJdXG4gICAgICAgIGhyZWYgPSBpdD8udXJsXG4gICAgICAgIHRodW1iID0gaXQ/LnRodW1ibmFpbD8udXJsXG4gICAgICAgIHJldHVybiB7aHJlZiwgdGh1bWJ9XG4gICAgZWxzZVxuICAgICAgICBjb25zb2xlLndhcm4gJ2lnbm9yaW5nIChuZXcpIHR5cGUnLCB0eXBlXG4iXX0=
