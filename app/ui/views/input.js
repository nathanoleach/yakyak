(function() {
  var autosize, clearsImagePreview, clipboard, convertEmoji, cursorToEnd, emojiCategories, emojiSuggListIndex, history, historyBackup, historyIndex, historyLength, historyPush, historyWalk, insertTextAtCursor, isAltCtrlMeta, isModifierKey, lastConv, later, laterMaybeFocus, maybeFocus, messages, openByDefault, openEmoticonDrawer, preparemessage, scrollToBottom, setClass, toggleVisibility;

  autosize = require('autosize');

  clipboard = require('electron').clipboard;

  ({scrollToBottom, messages} = require('./messages'));

  ({later, toggleVisibility, convertEmoji, insertTextAtCursor} = require('../util'));

  isModifierKey = function(ev) {
    return ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey;
  };

  isAltCtrlMeta = function(ev) {
    return ev.altKey || ev.ctrlKey || ev.metaKey;
  };

  cursorToEnd = function(el) {
    return el.selectionStart = el.selectionEnd = el.value.length;
  };

  history = [];

  historyIndex = 0;

  historyLength = 100;

  historyBackup = "";

  historyPush = function(data) {
    history.push(data);
    if (history.length === historyLength) {
      history.shift();
    }
    return historyIndex = history.length;
  };

  historyWalk = function(el, offset) {
    var val;
    // if we are starting to dive into history be backup current message
    if (offset === -1 && historyIndex === history.length) {
      historyBackup = el.value;
    }
    historyIndex = historyIndex + offset;
    // constrain index
    if (historyIndex < 0) {
      historyIndex = 0;
    }
    if (historyIndex > history.length) {
      historyIndex = history.length;
    }
    // if don't have history value restore 'current message'
    val = history[historyIndex] || historyBackup;
    el.value = val;
    return setTimeout((function() {
      return cursorToEnd(el);
    }), 1);
  };

  lastConv = null;

  emojiCategories = require('./emojicategories');

  openByDefault = 'people';

  emojiSuggListIndex = -1;

  if (document.querySelectorAll('.emoji-sugg-container').length) {
    document.querySelectorAll('.emoji-sugg-container')[0].parentNode.removeChild(document.querySelectorAll('.emoji-sugg-container')[0]);
  }

  module.exports = view(function(models) {
    div({
      class: 'input'
    }, function() {
      div({
        id: 'preview-container'
      }, function() {
        div({
          class: 'close-me material-icons',
          onclick: function(e) {
            return clearsImagePreview();
          }
        }, function() {
          return span('');
        });
        return div({
          class: 'relative',
          onclick: function(e) {
            var element;
            console.log('going to upload preview image');
            element = document.getElementById("message-input");
            // send text
            return preparemessage(element);
          }
        }, function() {
          img({
            id: 'preview-img',
            src: ''
          });
          return div({
            class: 'after material-icons'
          }, function() {
            return span('send');
          });
        });
      });
      div({
        class: 'relative'
      }, function() {
        return div({
          id: 'emoji-container'
        }, function() {
          div({
            id: 'emoji-group-selector'
          }, function() {
            var glow, j, len1, name, range, results;
            results = [];
            for (j = 0, len1 = emojiCategories.length; j < len1; j++) {
              range = emojiCategories[j];
              name = range['title'];
              glow = '';
              if (name === openByDefault) {
                glow = 'glow';
              }
              results.push(span({
                id: name + '-button',
                title: name,
                class: 'emoticon ' + glow
              }, range['representation'], {
                onclick: (function(name) {
                  return function() {
                    console.log("Opening " + name);
                    return openEmoticonDrawer(name);
                  };
                })(name)
              }));
            }
            return results;
          });
          return div({
            class: 'emoji-selector'
          }, function() {
            var j, len1, name, range, results, visible;
            results = [];
            for (j = 0, len1 = emojiCategories.length; j < len1; j++) {
              range = emojiCategories[j];
              name = range['title'];
              visible = '';
              if (name === openByDefault) {
                visible = 'visible';
              }
              results.push(span({
                id: name,
                class: 'group-content ' + visible
              }, function() {
                var emoji, k, len2, ref, results1;
                ref = range['range'];
                results1 = [];
                for (k = 0, len2 = ref.length; k < len2; k++) {
                  emoji = ref[k];
                  if (emoji.indexOf("\u200d") >= 0) {
                    // FIXME For now, ignore characters that have the "glue" character in them;
                    // they don't render properly
                    continue;
                  }
                  results1.push(span({
                    class: 'emoticon'
                  }, emoji, {
                    onclick: (function(emoji) {
                      return function() {
                        var element;
                        element = document.getElementById("message-input");
                        return insertTextAtCursor(element, emoji);
                      };
                    })(emoji)
                  }));
                }
                return results1;
              }));
            }
            return results;
          });
        });
      });
      return div({
        class: 'input-container'
      }, function() {
        textarea({
          id: 'message-input',
          autofocus: true,
          placeholder: i18n.__('input.message:Message'),
          rows: 1,
          dir: 'auto'
        }, '', {
          onDOMNodeInserted: function(e) {
            var ta;
            // at this point the node is still not inserted
            ta = e.target;
            later(function() {
              return autosize(ta);
            });
            return ta.addEventListener('autosize:resized', function() {
              // we do this because the autosizing sets the height to nothing
              // while measuring and that causes the messages scroll above to
              // move. by pinning the div of the outer holding div, we
              // are not moving the scroller.
              ta.parentNode.style.height = (ta.offsetHeight + 24) + 'px';
              if (messages != null) {
                return messages.scrollToBottom();
              }
            });
          },
          onkeydown: function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
              action('selectNextConv', -1);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
              action('selectNextConv', +1);
            }
            if (!isModifierKey(e)) {
              if (e.keyCode === 27) {
                e.preventDefault();
                if (models.viewstate.showtray && !models.viewstate.escapeClearsInput) {
                  action('hideWindow');
                } else {
                  // must focus on field and then execute:
                  //  - select all text in input
                  //  - replace them with an empty string
                  document.getElementById("message-input").focus();
                  document.execCommand("selectAll", false);
                  document.execCommand("insertText", false, "");
                  // also remove image preview
                  clearsImagePreview();
                }
              }
              if (e.keyCode === 13) {
                e.preventDefault();
                preparemessage(e.target);
              }
              if (e.target.value === '') {
                if (e.key === 'ArrowUp') {
                  historyWalk(e.target, -1);
                }
                if (e.key === 'ArrowDown') {
                  historyWalk(e.target, +1);
                }
              }
            }
            if (!isAltCtrlMeta(e)) {
              return action('lastkeydown', Date.now());
            }
          },
          onkeyup: function(e) {
            var d, element, emojiInserted, emojiSuggItem, emojiSuggList, i, index, len, lenAfter, results, startSel, unicodeMap;
            //check for emojis after pressing space
            element = document.getElementById("message-input");
            unicodeMap = require('../emojishortcode');
            emojiSuggListIndex = -1;
            if (e.keyCode === 32) {
              // Converts emojicodes (e.g. :smile:, :-) ) to unicode
              if (models.viewstate.convertEmoji) {
                // get cursor position
                startSel = element.selectionStart;
                len = element.value.length;
                element.value = convertEmoji(element.value);
                // Set cursor position (otherwise it would go to end of inpu)
                lenAfter = element.value.length;
                element.selectionStart = startSel - (len - lenAfter);
                element.selectionEnd = element.selectionStart;
              }
            }
            // remove emoji suggestion wrapper each time
            if (document.querySelectorAll('.emoji-sugg-container').length) {
              document.querySelectorAll('.emoji-sugg-container')[0].parentNode.removeChild(document.querySelectorAll('.emoji-sugg-container')[0]);
            }
            if (element.value.length && models.viewstate.suggestEmoji) {
              index = 0;
              results = [];
              for (d in unicodeMap) {
                i = unicodeMap[d];
                // util function to know if a emoji is trying to be typed, to launch suggestion
                emojiInserted = function(emoji, text) {
                  var searchedText;
                  searchedText = text.substr(text.lastIndexOf(':'));
                  if (searchedText === ':' || searchedText.indexOf(':') === -1) {
                    return false;
                  }
                  return emoji.startsWith(searchedText) || emoji.indexOf(searchedText) > -1;
                };
                // Insert suggestion
                if (emojiInserted(d, element.value) && index < 5) {
                  emojiSuggList = document.querySelectorAll('.emoji-sugg-container')[0];
                  if (!emojiSuggList) {
                    emojiSuggList = document.createElement('ul');
                    emojiSuggList.className = 'emoji-sugg-container';
                    element.parentNode.appendChild(emojiSuggList);
                  }
                  index++;
                  emojiSuggItem = document.createElement('li');
                  emojiSuggItem.className = 'emoji-sugg';
                  emojiSuggItem.innerHTML = '<i>' + i + '</i>' + '<span>' + d + '</span>';
                  emojiSuggList.appendChild(emojiSuggItem);
                  emojiSuggItem.addEventListener('click', (function() {
                    var emojiValue, finalText;
                    emojiValue = this.querySelector('i').innerHTML;
                    finalText = document.getElementById('message-input').value.substr(0, document.getElementById('message-input').value.lastIndexOf(':')) + emojiValue;
                    document.getElementById('message-input').value = finalText;
                    if (document.querySelectorAll('.emoji-sugg-container').length) {
                      return document.querySelectorAll('.emoji-sugg-container')[0].parentNode.removeChild(document.querySelectorAll('.emoji-sugg-container')[0]);
                    }
                  }));
                  results.push(setTimeout(function() {
                    return emojiSuggList.classList.toggle('animate');
                  }));
                } else {
                  results.push(void 0);
                }
              }
              return results;
            }
          },
          onpaste: function(e) {
            return setTimeout(function() {
              if (!clipboard.readImage().isEmpty() && !clipboard.readText()) {
                return action('onpasteimage');
              }
            }, 2);
          }
        });
        return span({
          class: 'button-container'
        }, function() {
          return button({
            title: i18n.__('input.emoticons:Show emoticons'),
            onclick: function(ef) {
              document.querySelector('#emoji-container').classList.toggle('open');
              return scrollToBottom();
            }
          }, function() {
            return span({
              class: 'material-icons'
            }, "mood");
          });
        }, function() {
          button({
            title: i18n.__('input.image:Attach image'),
            onclick: function(ev) {
              return document.getElementById('attachFile').click();
            }
          }, function() {
            return span({
              class: 'material-icons'
            }, 'photo');
          });
          return input({
            type: 'file',
            id: 'attachFile',
            accept: '.jpg,.jpeg,.png,.gif',
            onchange: function(ev) {
              return action('uploadimage', ev.target.files);
            }
          });
        });
      });
    });
    // focus when switching convs
    if (lastConv !== models.viewstate.selectedConv) {
      lastConv = models.viewstate.selectedConv;
      return laterMaybeFocus();
    }
  });

  //suggestEmoji : added enter handle and tab handle to navigate and select emoji when suggested
  window.addEventListener('keydown', (function(e) {
    var el, j, len1, newText, ref;
    if (models.viewstate.suggestEmoji) {
      if (e.keyCode === 9 && document.querySelectorAll('.emoji-sugg-container')[0]) {
        emojiSuggListIndex++;
        if (emojiSuggListIndex === 5) {
          emojiSuggListIndex = 0;
        }
        ref = document.querySelectorAll('.emoji-sugg');
        for (j = 0, len1 = ref.length; j < len1; j++) {
          el = ref[j];
          el.classList.remove('activated');
        }
        if (document.querySelectorAll('.emoji-sugg')[emojiSuggListIndex]) {
          document.querySelectorAll('.emoji-sugg')[emojiSuggListIndex].classList.toggle('activated');
        }
      }
      if (e.keyCode === 13 && document.querySelectorAll('.emoji-sugg-container')[0] && emojiSuggListIndex !== -1) {
        newText = function(originalText) {
          var newEmoji;
          newEmoji = document.querySelectorAll('.emoji-sugg')[emojiSuggListIndex].querySelector('i').innerText;
          return originalText.substr(0, originalText.lastIndexOf(':')) + newEmoji;
        };
        e.preventDefault();
        return document.getElementById('message-input').value = newText(document.getElementById('message-input').value.trim());
      }
    }
  }).bind(this));

  clearsImagePreview = function() {
    var element;
    element = document.getElementById('preview-img');
    element.src = '';
    document.getElementById('attachFile').value = '';
    return document.querySelector('#preview-container').classList.remove('open');
  };

  laterMaybeFocus = function() {
    return later(maybeFocus);
  };

  maybeFocus = function() {
    var el, ref;
    // no active element? or not focusing something relevant...
    el = document.activeElement;
    if (!el || !((ref = el.nodeName) === 'INPUT' || ref === 'TEXTAREA')) {
      // steal it!!!
      el = document.querySelector('.input textarea');
      if (el) {
        return el.focus();
      }
    }
  };

  preparemessage = function(ev) {
    var element, img;
    if (models.viewstate.convertEmoji) {
      // before sending message, check for emoji
      element = document.getElementById("message-input");
      // Converts emojicodes (e.g. :smile:, :-) ) to unicode
      element.value = convertEmoji(element.value);
    }
    
    action('sendmessage', ev.value);
    
    // check if there is an image in preview
    img = document.getElementById("preview-img");
    if (img.getAttribute('src') !== '') {
      action('uploadpreviewimage');
    }
    
    document.querySelector('#emoji-container').classList.remove('open');
    historyPush(ev.value);
    ev.value = '';
    return autosize.update(ev);
  };

  handle('noinputkeydown', function(ev) {
    var el;
    el = document.querySelector('.input textarea');
    if (el && !isAltCtrlMeta(ev)) {
      return el.focus();
    }
  });

  openEmoticonDrawer = function(drawerName) {
    var j, len1, range, results, set;
    results = [];
    for (j = 0, len1 = emojiCategories.length; j < len1; j++) {
      range = emojiCategories[j];
      set = range['title'] === drawerName;
      setClass(set, document.querySelector('#' + range['title']), 'visible');
      results.push(setClass(set, document.querySelector('#' + range['title'] + '-button'), 'glow'));
    }
    return results;
  };

  setClass = function(boolean, element, className) {
    if (element === void 0 || element === null) {
      return console.error("Cannot set visibility for undefined variable");
    } else {
      if (boolean) {
        return element.classList.add(className);
      } else {
        return element.classList.remove(className);
      }
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvaW5wdXQuanMiLCJzb3VyY2VzIjpbInVpL3ZpZXdzL2lucHV0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsUUFBQSxFQUFBLGtCQUFBLEVBQUEsU0FBQSxFQUFBLFlBQUEsRUFBQSxXQUFBLEVBQUEsZUFBQSxFQUFBLGtCQUFBLEVBQUEsT0FBQSxFQUFBLGFBQUEsRUFBQSxZQUFBLEVBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxXQUFBLEVBQUEsa0JBQUEsRUFBQSxhQUFBLEVBQUEsYUFBQSxFQUFBLFFBQUEsRUFBQSxLQUFBLEVBQUEsZUFBQSxFQUFBLFVBQUEsRUFBQSxRQUFBLEVBQUEsYUFBQSxFQUFBLGtCQUFBLEVBQUEsY0FBQSxFQUFBLGNBQUEsRUFBQSxRQUFBLEVBQUE7O0VBQUEsUUFBQSxHQUFXLE9BQUEsQ0FBUSxVQUFSOztFQUNYLFNBQUEsR0FBWSxPQUFBLENBQVEsVUFBUixDQUFtQixDQUFDOztFQUNoQyxDQUFBLENBQUMsY0FBRCxFQUFpQixRQUFqQixDQUFBLEdBQTZCLE9BQUEsQ0FBUSxZQUFSLENBQTdCOztFQUNBLENBQUEsQ0FBQyxLQUFELEVBQVEsZ0JBQVIsRUFBMEIsWUFBMUIsRUFBd0Msa0JBQXhDLENBQUEsR0FBOEQsT0FBQSxDQUFRLFNBQVIsQ0FBOUQ7O0VBRUEsYUFBQSxHQUFnQixRQUFBLENBQUMsRUFBRCxDQUFBO1dBQVEsRUFBRSxDQUFDLE1BQUgsSUFBYSxFQUFFLENBQUMsT0FBaEIsSUFBMkIsRUFBRSxDQUFDLE9BQTlCLElBQXlDLEVBQUUsQ0FBQztFQUFwRDs7RUFDaEIsYUFBQSxHQUFnQixRQUFBLENBQUMsRUFBRCxDQUFBO1dBQVEsRUFBRSxDQUFDLE1BQUgsSUFBYSxFQUFFLENBQUMsT0FBaEIsSUFBMkIsRUFBRSxDQUFDO0VBQXRDOztFQUVoQixXQUFBLEdBQWMsUUFBQSxDQUFDLEVBQUQsQ0FBQTtXQUFRLEVBQUUsQ0FBQyxjQUFILEdBQW9CLEVBQUUsQ0FB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QUMsTUFBbEIsQ0FBeUIsU0FBekIsRUFISjtPQUhKOztFQURPO0FBalJYIiwic291cmNlc0NvbnRlbnQiOlsiYXV0b3NpemUgPSByZXF1aXJlICdhdXRvc2l6ZSdcbmNsaXBib2FyZCA9IHJlcXVpcmUoJ2VsZWN0cm9uJykuY2xpcGJvYXJkXG57c2Nyb2xsVG9Cb3R0b20sIG1lc3NhZ2VzfSA9IHJlcXVpcmUgJy4vbWVzc2FnZXMnXG57bGF0ZXIsIHRvZ2dsZVZpc2liaWxpdHksIGNvbnZlcnRFbW9qaSwgaW5zZXJ0VGV4dEF0Q3Vyc29yfSA9IHJlcXVpcmUgJy4uL3V0aWwnXG5cbmlzTW9kaWZpZXJLZXkgPSAoZXYpIC0+IGV2LmFsdEtleSB8fCBldi5jdHJsS2V5IHx8IGV2Lm1ldGFLZXkgfHwgZXYuc2hpZnRLZXlcbmlzQWx0Q3RybE1ldGEgPSAoZXYpIC0+IGV2LmFsdEtleSB8fCBldi5jdHJsS2V5IHx8IGV2Lm1ldGFLZXlcblxuY3Vyc29yVG9FbmQgPSAoZWwpIC0+IGVsLnNlbGVjdGlvblN0YXJ0ID0gZWwuc2VsZWN0aW9uRW5kID0gZWwudmFsdWUubGVuZ3RoXG5cbmhpc3RvcnkgPSBbXVxuaGlzdG9yeUluZGV4ID0gMFxuaGlzdG9yeUxlbmd0aCA9IDEwMFxuaGlzdG9yeUJhY2t1cCA9IFwiXCJcblxuaGlzdG9yeVB1c2ggPSAoZGF0YSkgLT5cbiAgICBoaXN0b3J5LnB1c2ggZGF0YVxuICAgIGlmIGhpc3RvcnkubGVuZ3RoID09IGhpc3RvcnlMZW5ndGggdGhlbiBoaXN0b3J5LnNoaWZ0KClcbiAgICBoaXN0b3J5SW5kZXggPSBoaXN0b3J5Lmxlbmd0aFxuXG5oaXN0b3J5V2FsayA9IChlbCwgb2Zmc2V0KSAtPlxuICAgICMgaWYgd2UgYXJlIHN0YXJ0aW5nIHRvIGRpdmUgaW50byBoaXN0b3J5IGJlIGJhY2t1cCBjdXJyZW50IG1lc3NhZ2VcbiAgICBpZiBvZmZzZXQgaXMgLTEgYW5kIGhpc3RvcnlJbmRleCBpcyBoaXN0b3J5Lmxlbmd0aCB0aGVuIGhpc3RvcnlCYWNrdXAgPSBlbC52YWx1ZVxuICAgIGhpc3RvcnlJbmRleCA9IGhpc3RvcnlJbmRleCArIG9mZnNldFxuICAgICMgY29uc3RyYWluIGluZGV4XG4gICAgaWYgaGlzdG9yeUluZGV4IDwgMCB0aGVuIGhpc3RvcnlJbmRleCA9IDBcbiAgICBpZiBoaXN0b3J5SW5kZXggPiBoaXN0b3J5Lmxlbmd0aCB0aGVuIGhpc3RvcnlJbmRleCA9IGhpc3RvcnkubGVuZ3RoXG4gICAgIyBpZiBkb24ndCBoYXZlIGhpc3RvcnkgdmFsdWUgcmVzdG9yZSAnY3VycmVudCBtZXNzYWdlJ1xuICAgIHZhbCA9IGhpc3RvcnlbaGlzdG9yeUluZGV4XSBvciBoaXN0b3J5QmFja3VwXG4gICAgZWwudmFsdWUgPSB2YWxcbiAgICBzZXRUaW1lb3V0ICgtPiBjdXJzb3JUb0VuZCBlbCksIDFcblxubGFzdENvbnYgPSBudWxsXG5cbmVtb2ppQ2F0ZWdvcmllcyA9IHJlcXVpcmUgJy4vZW1vamljYXRlZ29yaWVzJ1xub3BlbkJ5RGVmYXVsdCA9ICdwZW9wbGUnXG5lbW9qaVN1Z2dMaXN0SW5kZXggPSAtMVxuaWYgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJykubGVuZ3RoXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJylbMF0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZW1vamktc3VnZy1jb250YWluZXInKVswXSlcblxubW9kdWxlLmV4cG9ydHMgPSB2aWV3IChtb2RlbHMpIC0+XG4gICAgZGl2IGNsYXNzOidpbnB1dCcsIC0+XG4gICAgICAgIGRpdiBpZDogJ3ByZXZpZXctY29udGFpbmVyJywgLT5cbiAgICAgICAgICAgIGRpdiBjbGFzczogJ2Nsb3NlLW1lIG1hdGVyaWFsLWljb25zJ1xuICAgICAgICAgICAgICAgICwgb25jbGljazogKGUpIC0+XG4gICAgICAgICAgICAgICAgICAgIGNsZWFyc0ltYWdlUHJldmlldygpXG4gICAgICAgICAgICAgICAgLCAtPlxuICAgICAgICAgICAgICAgICAgICBzcGFuICful40nXG4gICAgICAgICAgICBkaXYgY2xhc3M6ICdyZWxhdGl2ZSdcbiAgICAgICAgICAgICAgICAsIG9uY2xpY2s6IChlKSAtPlxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyAnZ29pbmcgdG8gdXBsb2FkIHByZXZpZXcgaW1hZ2UnXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCBcIm1lc3NhZ2UtaW5wdXRcIlxuICAgICAgICAgICAgICAgICAgICAjIHNlbmQgdGV4dFxuICAgICAgICAgICAgICAgICAgICBwcmVwYXJlbWVzc2FnZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgLCAtPlxuICAgICAgICAgICAgICAgICAgICBpbWcgaWQ6ICdwcmV2aWV3LWltZycsIHNyYzogJydcbiAgICAgICAgICAgICAgICAgICAgZGl2IGNsYXNzOiAnYWZ0ZXIgbWF0ZXJpYWwtaWNvbnMnXG4gICAgICAgICAgICAgICAgICAgICAgICAsIC0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BhbiAnc2VuZCdcblxuICAgICAgICBkaXYgY2xhc3M6ICdyZWxhdGl2ZScsIC0+XG4gICAgICAgICAgICBkaXYgaWQ6J2Vtb2ppLWNvbnRhaW5lcicsIC0+XG4gICAgICAgICAgICAgICAgZGl2IGlkOidlbW9qaS1ncm91cC1zZWxlY3RvcicsIC0+XG4gICAgICAgICAgICAgICAgICAgIGZvciByYW5nZSBpbiBlbW9qaUNhdGVnb3JpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSByYW5nZVsndGl0bGUnXVxuICAgICAgICAgICAgICAgICAgICAgICAgZ2xvdyA9ICcnXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiBuYW1lID09IG9wZW5CeURlZmF1bHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbG93ID0gJ2dsb3cnXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGFuIGlkOm5hbWUrJy1idXR0b24nXG4gICAgICAgICAgICAgICAgICAgICAgICAsIHRpdGxlOm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICwgY2xhc3M6J2Vtb3RpY29uICcgKyBnbG93XG4gICAgICAgICAgICAgICAgICAgICAgICAsIHJhbmdlWydyZXByZXNlbnRhdGlvbiddXG4gICAgICAgICAgICAgICAgICAgICAgICAsIG9uY2xpY2s6IGRvIChuYW1lKSAtPiAtPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiT3BlbmluZyBcIiArIG5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BlbkVtb3RpY29uRHJhd2VyIG5hbWVcblxuICAgICAgICAgICAgICAgIGRpdiBjbGFzczonZW1vamktc2VsZWN0b3InLCAtPlxuICAgICAgICAgICAgICAgICAgICBmb3IgcmFuZ2UgaW4gZW1vamlDYXRlZ29yaWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gcmFuZ2VbJ3RpdGxlJ11cbiAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGUgPSAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgbmFtZSA9PSBvcGVuQnlEZWZhdWx0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZSA9ICd2aXNpYmxlJ1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzcGFuIGlkOm5hbWUsIGNsYXNzOidncm91cC1jb250ZW50ICcgKyB2aXNpYmxlLCAtPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciBlbW9qaSBpbiByYW5nZVsncmFuZ2UnXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiBlbW9qaS5pbmRleE9mKFwiXFx1MjAwZFwiKSA+PSAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjIEZJWE1FIEZvciBub3csIGlnbm9yZSBjaGFyYWN0ZXJzIHRoYXQgaGF2ZSB0aGUgXCJnbHVlXCIgY2hhcmFjdGVyIGluIHRoZW07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjIHRoZXkgZG9uJ3QgcmVuZGVyIHByb3Blcmx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGFuIGNsYXNzOidlbW90aWNvbicsIGVtb2ppXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgb25jbGljazogZG8gKGVtb2ppKSAtPiAtPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkIFwibWVzc2FnZS1pbnB1dFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRUZXh0QXRDdXJzb3IgZWxlbWVudCwgZW1vamlcblxuICAgICAgICBkaXYgY2xhc3M6J2lucHV0LWNvbnRhaW5lcicsIC0+XG4gICAgICAgICAgICB0ZXh0YXJlYSBpZDonbWVzc2FnZS1pbnB1dCcsIGF1dG9mb2N1czp0cnVlLCBwbGFjZWhvbGRlcjogaTE4bi5fXygnaW5wdXQubWVzc2FnZTpNZXNzYWdlJyksIHJvd3M6IDEsIGRpcjogJ2F1dG8nLCAnJ1xuICAgICAgICAgICAgLCBvbkRPTU5vZGVJbnNlcnRlZDogKGUpIC0+XG4gICAgICAgICAgICAgICAgIyBhdCB0aGlzIHBvaW50IHRoZSBub2RlIGlzIHN0aWxsIG5vdCBpbnNlcnRlZFxuICAgICAgICAgICAgICAgIHRhID0gZS50YXJnZXRcbiAgICAgICAgICAgICAgICBsYXRlciAtPiBhdXRvc2l6ZSB0YVxuICAgICAgICAgICAgICAgIHRhLmFkZEV2ZW50TGlzdGVuZXIgJ2F1dG9zaXplOnJlc2l6ZWQnLCAtPlxuICAgICAgICAgICAgICAgICAgICAjIHdlIGRvIHRoaXMgYmVjYXVzZSB0aGUgYXV0b3NpemluZyBzZXRzIHRoZSBoZWlnaHQgdG8gbm90aGluZ1xuICAgICAgICAgICAgICAgICAgICAjIHdoaWxlIG1lYXN1cmluZyBhbmQgdGhhdCBjYXVzZXMgdGhlIG1lc3NhZ2VzIHNjcm9sbCBhYm92ZSB0b1xuICAgICAgICAgICAgICAgICAgICAjIG1vdmUuIGJ5IHBpbm5pbmcgdGhlIGRpdiBvZiB0aGUgb3V0ZXIgaG9sZGluZyBkaXYsIHdlXG4gICAgICAgICAgICAgICAgICAgICMgYXJlIG5vdCBtb3ZpbmcgdGhlIHNjcm9sbGVyLlxuICAgICAgICAgICAgICAgICAgICB0YS5wYXJlbnROb2RlLnN0eWxlLmhlaWdodCA9ICh0YS5vZmZzZXRIZWlnaHQgKyAyNCkgKyAncHgnXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzLnNjcm9sbFRvQm90dG9tKCkgaWYgbWVzc2FnZXM/XG4gICAgICAgICAgICAsIG9ua2V5ZG93bjogKGUpIC0+XG4gICAgICAgICAgICAgICAgaWYgKGUubWV0YUtleSBvciBlLmN0cmxLZXkpIGFuZCBlLmtleSA9PSAnQXJyb3dVcCcgdGhlbiBhY3Rpb24gJ3NlbGVjdE5leHRDb252JywgLTFcbiAgICAgICAgICAgICAgICBpZiAoZS5tZXRhS2V5IG9yIGUuY3RybEtleSkgYW5kIGUua2V5ID09ICdBcnJvd0Rvd24nIHRoZW4gYWN0aW9uICdzZWxlY3ROZXh0Q29udicsICsxXG4gICAgICAgICAgICAgICAgdW5sZXNzIGlzTW9kaWZpZXJLZXkoZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgZS5rZXlDb2RlID09IDI3XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIG1vZGVscy52aWV3c3RhdGUuc2hvd3RyYXkgJiYgIW1vZGVscy52aWV3c3RhdGUuZXNjYXBlQ2xlYXJzSW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb24gJ2hpZGVXaW5kb3cnXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIyBtdXN0IGZvY3VzIG9uIGZpZWxkIGFuZCB0aGVuIGV4ZWN1dGU6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIyAgLSBzZWxlY3QgYWxsIHRleHQgaW4gaW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAjICAtIHJlcGxhY2UgdGhlbSB3aXRoIGFuIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWVzc2FnZS1pbnB1dFwiKS5mb2N1cygpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoXCJzZWxlY3RBbGxcIiwgZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoXCJpbnNlcnRUZXh0XCIsIGZhbHNlLCBcIlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICMgYWxzbyByZW1vdmUgaW1hZ2UgcHJldmlld1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFyc0ltYWdlUHJldmlldygpXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgZS5rZXlDb2RlID09IDEzXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXBhcmVtZXNzYWdlIGUudGFyZ2V0XG4gICAgICAgICAgICAgICAgICAgIGlmIGUudGFyZ2V0LnZhbHVlID09ICcnXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiBlLmtleSBpcyAnQXJyb3dVcCcgdGhlbiBoaXN0b3J5V2FsayBlLnRhcmdldCwgLTFcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIGUua2V5IGlzICdBcnJvd0Rvd24nIHRoZW4gaGlzdG9yeVdhbGsgZS50YXJnZXQsICsxXG4gICAgICAgICAgICAgICAgYWN0aW9uICdsYXN0a2V5ZG93bicsIERhdGUubm93KCkgdW5sZXNzIGlzQWx0Q3RybE1ldGEoZSlcbiAgICAgICAgICAgICwgb25rZXl1cDogKGUpIC0+XG4gICAgICAgICAgICAgICAgI2NoZWNrIGZvciBlbW9qaXMgYWZ0ZXIgcHJlc3Npbmcgc3BhY2VcbiAgICAgICAgICAgICAgICBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQgXCJtZXNzYWdlLWlucHV0XCI7XG4gICAgICAgICAgICAgICAgdW5pY29kZU1hcCA9IHJlcXVpcmUgJy4uL2Vtb2ppc2hvcnRjb2RlJztcbiAgICAgICAgICAgICAgICBlbW9qaVN1Z2dMaXN0SW5kZXggPSAtMTtcbiAgICAgICAgICAgICAgICBpZiBlLmtleUNvZGUgPT0gMzJcbiAgICAgICAgICAgICAgICAgICAgIyBDb252ZXJ0cyBlbW9qaWNvZGVzIChlLmcuIDpzbWlsZTosIDotKSApIHRvIHVuaWNvZGVcbiAgICAgICAgICAgICAgICAgICAgaWYgbW9kZWxzLnZpZXdzdGF0ZS5jb252ZXJ0RW1vamlcbiAgICAgICAgICAgICAgICAgICAgICAgICMgZ2V0IGN1cnNvciBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRTZWwgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZW4gPSBlbGVtZW50LnZhbHVlLmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC52YWx1ZSA9IGNvbnZlcnRFbW9qaShlbGVtZW50LnZhbHVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgIyBTZXQgY3Vyc29yIHBvc2l0aW9uIChvdGhlcndpc2UgaXQgd291bGQgZ28gdG8gZW5kIG9mIGlucHUpXG4gICAgICAgICAgICAgICAgICAgICAgICBsZW5BZnRlciA9IGVsZW1lbnQudmFsdWUubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnNlbGVjdGlvblN0YXJ0ID0gc3RhcnRTZWwgLSAobGVuIC0gbGVuQWZ0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnNlbGVjdGlvbkVuZCA9IGVsZW1lbnQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICAgICAgICAjIHJlbW92ZSBlbW9qaSBzdWdnZXN0aW9uIHdyYXBwZXIgZWFjaCB0aW1lXG4gICAgICAgICAgICAgICAgaWYgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJykubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbW9qaS1zdWdnLWNvbnRhaW5lcicpWzBdLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJylbMF0pXG4gICAgICAgICAgICAgICAgaWYgZWxlbWVudC52YWx1ZS5sZW5ndGggJiYgbW9kZWxzLnZpZXdzdGF0ZS5zdWdnZXN0RW1vamlcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICAjIHJlYWQgZW1vamkgdGFibGVcbiAgICAgICAgICAgICAgICAgICAgZm9yIGQsIGkgb2YgdW5pY29kZU1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgIyB1dGlsIGZ1bmN0aW9uIHRvIGtub3cgaWYgYSBlbW9qaSBpcyB0cnlpbmcgdG8gYmUgdHlwZWQsIHRvIGxhdW5jaCBzdWdnZXN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBlbW9qaUluc2VydGVkID0gKGVtb2ppLCB0ZXh0KSAtPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaGVkVGV4dCA9IHRleHQuc3Vic3RyKHRleHQubGFzdEluZGV4T2YoJzonKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiBzZWFyY2hlZFRleHQgPT0gJzonIHx8wqBzZWFyY2hlZFRleHQuaW5kZXhPZignOicpID09IC0xXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBlbW9qaS5zdGFydHNXaXRoKHNlYXJjaGVkVGV4dCkgfHwgZW1vamkuaW5kZXhPZihzZWFyY2hlZFRleHQpID4gLTFcbiAgICAgICAgICAgICAgICAgICAgICAgICMgSW5zZXJ0IHN1Z2dlc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICBlbW9qaUluc2VydGVkKGQsIGVsZW1lbnQudmFsdWUpICYmIGluZGV4IDwgNVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZW1vamktc3VnZy1jb250YWluZXInKVswXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICFlbW9qaVN1Z2dMaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3QuY2xhc3NOYW1lID0gJ2Vtb2ppLXN1Z2ctY29udGFpbmVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQoZW1vamlTdWdnTGlzdClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCsrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1vamlTdWdnSXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbW9qaVN1Z2dJdGVtLmNsYXNzTmFtZSA9ICdlbW9qaS1zdWdnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0l0ZW0uaW5uZXJIVE1MID0gJzxpPicgKyBpICsgJzwvaT4nICsgJzxzcGFuPicgKyBkICsgJzwvc3Bhbj4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3QuYXBwZW5kQ2hpbGQoZW1vamlTdWdnSXRlbSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbW9qaVN1Z2dJdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKC0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppVmFsdWUgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ2knKS5pbm5lckhUTUw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmFsVGV4dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXNzYWdlLWlucHV0JykudmFsdWUuc3Vic3RyKDAsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXNzYWdlLWlucHV0JykudmFsdWUubGFzdEluZGV4T2YoJzonKSkgKyBlbW9qaVZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtZXNzYWdlLWlucHV0JykudmFsdWUgPSBmaW5hbFRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJykubGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZW1vamktc3VnZy1jb250YWluZXInKVswXS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbW9qaS1zdWdnLWNvbnRhaW5lcicpWzBdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCktPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbW9qaVN1Z2dMaXN0LmNsYXNzTGlzdC50b2dnbGUoJ2FuaW1hdGUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICwgb25wYXN0ZTogKGUpIC0+XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCAoKSAtPlxuICAgICAgICAgICAgICAgICAgICBpZiBub3QgY2xpcGJvYXJkLnJlYWRJbWFnZSgpLmlzRW1wdHkoKSBhbmQgbm90IGNsaXBib2FyZC5yZWFkVGV4dCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb24gJ29ucGFzdGVpbWFnZSdcbiAgICAgICAgICAgICAgICAsIDJcblxuICAgICAgICAgICAgc3BhbiBjbGFzczonYnV0dG9uLWNvbnRhaW5lcicsIC0+XG4gICAgICAgICAgICAgICAgYnV0dG9uIHRpdGxlOiBpMThuLl9fKCdpbnB1dC5lbW90aWNvbnM6U2hvdyBlbW90aWNvbnMnKSwgb25jbGljazogKGVmKSAtPlxuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZW1vamktY29udGFpbmVyJykuY2xhc3NMaXN0LnRvZ2dsZSgnb3BlbicpXG4gICAgICAgICAgICAgICAgICAgIHNjcm9sbFRvQm90dG9tKClcbiAgICAgICAgICAgICAgICAsIC0+XG4gICAgICAgICAgICAgICAgICAgIHNwYW4gY2xhc3M6J21hdGVyaWFsLWljb25zJywgXCJtb29kXCJcbiAgICAgICAgICAgICwgLT5cbiAgICAgICAgICAgICAgICBidXR0b24gdGl0bGU6IGkxOG4uX18oJ2lucHV0LmltYWdlOkF0dGFjaCBpbWFnZScpLCBvbmNsaWNrOiAoZXYpIC0+XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhdHRhY2hGaWxlJykuY2xpY2soKVxuICAgICAgICAgICAgICAgICwgLT5cbiAgICAgICAgICAgICAgICAgICAgc3BhbiBjbGFzczonbWF0ZXJpYWwtaWNvbnMnLCAncGhvdG8nXG4gICAgICAgICAgICAgICAgaW5wdXQgdHlwZTonZmlsZScsIGlkOidhdHRhY2hGaWxlJywgYWNjZXB0OicuanBnLC5qcGVnLC5wbmcsLmdpZicsIG9uY2hhbmdlOiAoZXYpIC0+XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbiAndXBsb2FkaW1hZ2UnLCBldi50YXJnZXQuZmlsZXNcblxuICAgICMgZm9jdXMgd2hlbiBzd2l0Y2hpbmcgY29udnNcbiAgICBpZiBsYXN0Q29udiAhPSBtb2RlbHMudmlld3N0YXRlLnNlbGVjdGVkQ29udlxuICAgICAgICBsYXN0Q29udiA9IG1vZGVscy52aWV3c3RhdGUuc2VsZWN0ZWRDb252XG4gICAgICAgIGxhdGVyTWF5YmVGb2N1cygpXG5cbiNzdWdnZXN0RW1vamkgOiBhZGRlZCBlbnRlciBoYW5kbGUgYW5kIHRhYiBoYW5kbGUgdG8gbmF2aWdhdGUgYW5kIHNlbGVjdCBlbW9qaSB3aGVuIHN1Z2dlc3RlZFxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoKGUpIC0+XG4gICAgaWYgbW9kZWxzLnZpZXdzdGF0ZS5zdWdnZXN0RW1vamlcbiAgICAgICAgaWYgZS5rZXlDb2RlID09IDkgJiYgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJylbMF1cbiAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3RJbmRleCsrXG4gICAgICAgICAgICBpZiBlbW9qaVN1Z2dMaXN0SW5kZXggPT0gNVxuICAgICAgICAgICAgICAgIGVtb2ppU3VnZ0xpc3RJbmRleCA9IDBcbiAgICAgICAgICAgIGZvciBlbCBpbiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZW1vamktc3VnZycpXG4gICAgICAgICAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZhdGVkJylcbiAgICAgICAgICAgIGlmIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbW9qaS1zdWdnJylbZW1vamlTdWdnTGlzdEluZGV4XVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbW9qaS1zdWdnJylbZW1vamlTdWdnTGlzdEluZGV4XS5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmF0ZWQnKVxuICAgICAgICBpZiBlLmtleUNvZGUgPT0gMTMgJiYgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXN1Z2ctY29udGFpbmVyJylbMF0gJiYgZW1vamlTdWdnTGlzdEluZGV4ICE9IC0xXG4gICAgICAgICAgICBuZXdUZXh0ID0gKG9yaWdpbmFsVGV4dCkgLT5cbiAgICAgICAgICAgICAgICBuZXdFbW9qaSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbW9qaS1zdWdnJylbZW1vamlTdWdnTGlzdEluZGV4XS5xdWVyeVNlbGVjdG9yKCdpJykuaW5uZXJUZXh0XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsVGV4dC5zdWJzdHIoMCwgb3JpZ2luYWxUZXh0Lmxhc3RJbmRleE9mKCc6JykpICsgbmV3RW1vamk7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWVzc2FnZS1pbnB1dCcpLnZhbHVlID0gbmV3VGV4dChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWVzc2FnZS1pbnB1dCcpLnZhbHVlLnRyaW0oKSlcbikuYmluZCh0aGlzKSlcblxuY2xlYXJzSW1hZ2VQcmV2aWV3ID0gLT5cbiAgICBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQgJ3ByZXZpZXctaW1nJ1xuICAgIGVsZW1lbnQuc3JjID0gJydcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXR0YWNoRmlsZScpLnZhbHVlID0gJydcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJldmlldy1jb250YWluZXInKVxuICAgICAgICAuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpXG5cbmxhdGVyTWF5YmVGb2N1cyA9IC0+IGxhdGVyIG1heWJlRm9jdXNcblxubWF5YmVGb2N1cyA9IC0+XG4gICAgIyBubyBhY3RpdmUgZWxlbWVudD8gb3Igbm90IGZvY3VzaW5nIHNvbWV0aGluZyByZWxldmFudC4uLlxuICAgIGVsID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudFxuICAgIGlmICFlbCBvciBub3QgKGVsLm5vZGVOYW1lIGluIFsnSU5QVVQnLCAnVEVYVEFSRUEnXSlcbiAgICAgICAgIyBzdGVhbCBpdCEhIVxuICAgICAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5pbnB1dCB0ZXh0YXJlYScpXG4gICAgICAgIGVsLmZvY3VzKCkgaWYgZWxcblxucHJlcGFyZW1lc3NhZ2UgPSAoZXYpIC0+XG4gICAgaWYgbW9kZWxzLnZpZXdzdGF0ZS5jb252ZXJ0RW1vamlcbiAgICAgICAgIyBiZWZvcmUgc2VuZGluZyBtZXNzYWdlLCBjaGVjayBmb3IgZW1vamlcbiAgICAgICAgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkIFwibWVzc2FnZS1pbnB1dFwiXG4gICAgICAgICMgQ29udmVydHMgZW1vamljb2RlcyAoZS5nLiA6c21pbGU6LCA6LSkgKSB0byB1bmljb2RlXG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSBjb252ZXJ0RW1vamkoZWxlbWVudC52YWx1ZSlcbiAgICAjXG4gICAgYWN0aW9uICdzZW5kbWVzc2FnZScsIGV2LnZhbHVlXG4gICAgI1xuICAgICMgY2hlY2sgaWYgdGhlcmUgaXMgYW4gaW1hZ2UgaW4gcHJldmlld1xuICAgIGltZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkIFwicHJldmlldy1pbWdcIlxuICAgIGFjdGlvbiAndXBsb2FkcHJldmlld2ltYWdlJyBpZiBpbWcuZ2V0QXR0cmlidXRlKCdzcmMnKSAhPSAnJ1xuICAgICNcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZW1vamktY29udGFpbmVyJykuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpXG4gICAgaGlzdG9yeVB1c2ggZXYudmFsdWVcbiAgICBldi52YWx1ZSA9ICcnXG4gICAgYXV0b3NpemUudXBkYXRlIGV2XG5cbmhhbmRsZSAnbm9pbnB1dGtleWRvd24nLCAoZXYpIC0+XG4gICAgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuaW5wdXQgdGV4dGFyZWEnKVxuICAgIGVsLmZvY3VzKCkgaWYgZWwgYW5kIG5vdCBpc0FsdEN0cmxNZXRhKGV2KVxuXG5vcGVuRW1vdGljb25EcmF3ZXIgPSAoZHJhd2VyTmFtZSkgLT5cbiAgICBmb3IgcmFuZ2UgaW4gZW1vamlDYXRlZ29yaWVzXG4gICAgICAgIHNldCA9IChyYW5nZVsndGl0bGUnXSA9PSBkcmF3ZXJOYW1lKVxuICAgICAgICBzZXRDbGFzcyBzZXQsIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yICcjJytyYW5nZVsndGl0bGUnXSksICd2aXNpYmxlJ1xuICAgICAgICBzZXRDbGFzcyBzZXQsIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yICcjJytyYW5nZVsndGl0bGUnXSsnLWJ1dHRvbicpLCAnZ2xvdydcblxuXG5zZXRDbGFzcyA9IChib29sZWFuLCBlbGVtZW50LCBjbGFzc05hbWUpIC0+XG4gICAgaWYgZWxlbWVudCA9PSB1bmRlZmluZWQgb3IgZWxlbWVudCA9PSBudWxsXG4gICAgICAgIGNvbnNvbGUuZXJyb3IgXCJDYW5ub3Qgc2V0IHZpc2liaWxpdHkgZm9yIHVuZGVmaW5lZCB2YXJpYWJsZVwiXG4gICAgZWxzZVxuICAgICAgICBpZiBib29sZWFuXG4gICAgICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKVxuIl19
