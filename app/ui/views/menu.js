(function() {
  var Menu, acceleratorMap, getAccelerator, isDarwin, isLinux, isNotDarwin, notificationCenterSupportsSound, notifierSupportsSound, platform, remote, templateEdit, templateMenu, templateView, templateWindow, templateYakYak;

  remote = require('electron').remote;

  Menu = remote.Menu;

  ({notificationCenterSupportsSound} = require('../util'));

  platform = require('os').platform();

  // to reduce number of == comparisons
  isDarwin = platform === 'darwin';

  isLinux = platform === 'linux';

  isNotDarwin = platform !== 'darwin';

  // true if it does, false otherwise
  notifierSupportsSound = notificationCenterSupportsSound();

  acceleratorMap = {
    // MacOSX specific
    hideyakyak: {
      default: 'CmdOrCtrl+H'
    },
    hideothers: {
      default: '',
      darwin: 'Command+Shift+H'
    },
    showall: {
      default: '',
      darwin: ''
    },
    openinspector: {
      default: 'CmdOrCtrl+Alt+I'
    },
    close: {
      default: '',
      darwin: 'Command+W'
    },
    // Common shortcuts
    quit: {
      default: 'CmdOrCtrl+Q'
    },
    zoomin: {
      default: 'CmdOrCtrl+Plus'
    },
    toggleimagepreview: {
      default: 'CmdOrCtrl+P'
    },
    // Platform specific
    previousconversation: {
      default: 'Ctrl+K',
      darwin: 'Ctrl+Shift+Tab'
    },
    nextconversation: {
      default: 'Ctrl+J',
      darwin: 'Ctrl+Tab'
    },
    newconversation: {
      default: 'CmdOrCtrl+N'
    },
    conversation1: {
      default: 'Alt+1',
      darwin: 'Command+1'
    },
    conversation2: {
      default: 'Alt+2',
      darwin: 'Command+2'
    },
    conversation3: {
      default: 'Alt+3',
      darwin: 'Command+3'
    },
    conversation4: {
      default: 'Alt+4',
      darwin: 'Command+4'
    },
    conversation5: {
      default: 'Alt+5',
      darwin: 'Command+5'
    },
    conversation6: {
      default: 'Alt+6',
      darwin: 'Command+6'
    },
    conversation7: {
      default: 'Alt+7',
      darwin: 'Command+7'
    },
    conversation8: {
      default: 'Alt+8',
      darwin: 'Command+8'
    },
    conversation9: {
      default: 'Alt+9',
      darwin: 'Command+9'
    }
  };

  getAccelerator = function(key) {
    if (acceleratorMap[key][platform] != null) {
      return acceleratorMap[key][platform];
    } else {
      return acceleratorMap[key]['default'];
    }
  };

  templateYakYak = function(viewstate) {
    return [
      isDarwin ? {
        label: i18n.__('menu.help.about.title:About YakYak'),
        click: function(it) {
          return action('show-about');
        }
      } : void 0,
      {
        type: 'checkbox',
        label: i18n.__('menu.help.about.startup:Open on Startup'),
        checked: viewstate.openOnSystemStartup,
        click: function(it) {
          return action('openonsystemstartup',
      it.checked);
        }
      },
      isDarwin ? {
        //{ type: 'separator' }
        // { label: 'Preferences...', accelerator: 'Command+,',
        // click: => delegate.openConfig() }
        type: 'separator'
      } : void 0,
      {
        label: i18n.__('menu.file.hide:Hide YakYak'),
        accelerator: getAccelerator('hideyakyak'),
        role: isDarwin ? 'hide' : 'minimize'
      },
      isDarwin ? {
        label: i18n.__('menu.file.hide_others:Hide Others'),
        accelerator: getAccelerator('hideothers'),
        role: 'hideothers'
      } : void 0,
      isDarwin ? { // old show all
        label: i18n.__("menu.file.show:Show All"),
        role: 'unhide'
      } : void 0,
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.file.inspector:Open Inspector'),
        accelerator: getAccelerator('openinspector'),
        click: function() {
          return action('devtools');
        }
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.file.logout:Logout'),
        click: function() {
          return action('logout');
        },
        enabled: viewstate.loggedin
      },
      {
        label: i18n.__('menu.file.quit:Quit'),
        accelerator: getAccelerator('quit'),
        click: function() {
          return action('quit');
        }
      }
    ].filter(function(n) {
      return n !== void 0;
    });
  };

  templateEdit = function(viewstate) {
    var languages, loc;
    languages = (function() {
      var i, len, ref, results;
      ref = i18n.getLocales();
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        loc = ref[i];
        if (loc.length < 2) {
          continue;
        }
        results.push({
          label: i18n.getCatalog(loc).__MyLocaleLanguage__,
          type: 'radio',
          checked: viewstate.language === loc,
          value: loc,
          click: function(it) {
            return action('changelanguage', it.value);
          }
        });
      }
      return results;
    })();
    languages = languages.filter(function(n) {
      return n !== void 0;
    });
    return [
      {
        label: i18n.__('menu.edit.undo:Undo'),
        role: 'undo'
      },
      {
        label: i18n.__('menu.edit.redo:Redo'),
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.edit.cut:Cut'),
        role: 'cut'
      },
      {
        label: i18n.__('menu.edit.copy:Copy'),
        role: 'copy'
      },
      {
        label: i18n.__('menu.edit.paste:Paste'),
        role: 'paste'
      },
      {
        label: i18n.__('menu.edit.select_all:Select All'),
        role: 'selectall'
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.edit.language:Language'),
        submenu: languages
      },
      {
        label: i18n.__('menu.edit.dateformat:Use system date format'),
        type: 'checkbox',
        checked: viewstate.useSystemDateFormat,
        enabled: true,
        click: function(it) {
          return action('setusesystemdateformat',
      it.checked);
        }
      }
    ].filter(function(n) {
      return n !== void 0;
    });
  };

  templateView = function(viewstate) {
    return [
      {
        label: i18n.__('menu.view.conversation.title:Conversation List'),
        submenu: [
          {
            type: 'checkbox',
            label: i18n.__('menu.view.conversation.thumbnails.show:Show Thumbnails'),
            checked: viewstate.showConvThumbs,
            enabled: viewstate.loggedin,
            click: function(it) {
              return action('showconvthumbs',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.conversation.thumbnails.only:Show Thumbnails Only'),
            checked: viewstate.showConvMin,
            enabled: viewstate.loggedin,
            click: function(it) {
              return action('showconvmin',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.conversation.thumbnails.animated:Show Animated Thumbnails'),
            checked: viewstate.showAnimatedThumbs,
            enabled: viewstate.loggedin,
            click: function(it) {
              return action('showanimatedthumbs',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.conversation.timestamp:Show Conversation Timestamp'),
            checked: viewstate.showConvTime,
            enabled: viewstate.loggedin && !viewstate.showConvMin,
            click: function(it) {
              return action('showconvtime',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.conversation.last:Show Conversation Last Message'),
            checked: viewstate.showConvLast,
            enabled: viewstate.loggedin && !viewstate.showConvMin,
            click: function(it) {
              return action('showconvlast',
          it.checked);
            }
          }
        ]
      },
      {
        label: i18n.__('menu.view.notification.title:Pop-Up Notification'),
        submenu: [
          {
            type: 'checkbox',
            label: i18n.__('menu.view.notification.show:Show notifications'),
            checked: viewstate.showPopUpNotifications,
            enabled: viewstate.loggedin,
            click: function(it) {
              return action('showpopupnotifications',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.notification.message:Show message in notifications'),
            checked: viewstate.showMessageInNotification,
            enabled: viewstate.loggedin && viewstate.showPopUpNotifications,
            click: function(it) {
              return action('showmessageinnotification',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.notification.username:Show username in notifications'),
            checked: viewstate.showUsernameInNotification,
            enabled: viewstate.loggedin && viewstate.showPopUpNotifications,
            click: function(it) {
              return action('showusernameinnotification',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__((isDarwin ? 'menu.view.notification.avatar:Show user avatar icon in notifications' : 'menu.view.notification.icon:Show YakYak icon in notifications')),
            enabled: viewstate.loggedin && viewstate.showPopUpNotifications,
            checked: viewstate.showIconNotification,
            click: function(it) {
              return action('showiconnotification',
          it.checked);
            }
          },
          {
            type: 'checkbox',
            label: i18n.__('menu.view.notification.mute:Disable sound in notifications'),
            checked: viewstate.muteSoundNotification,
            enabled: viewstate.loggedin && viewstate.showPopUpNotifications,
            click: function(it) {
              return action('mutesoundnotification',
          it.checked);
            }
          },
          notifierSupportsSound ? {
            // Only show option if notifier backend supports sound, otherwise custom sound is always used
            type: 'checkbox',
            label: i18n.__('menu.view.notification.custom_sound:Use YakYak custom sound for notifications'),
            checked: viewstate.forceCustomSound,
            enabled: viewstate.loggedin && viewstate.showPopUpNotifications && !viewstate.muteSoundNotification,
            click: function(it) {
              return action('forcecustomsound',
          it.checked);
            }
          } : void 0
        ].filter(function(n) {
          return n !== void 0;
        })
      },
      {
        type: 'checkbox',
        label: i18n.__('menu.view.emoji:Convert text to emoji'),
        checked: viewstate.convertEmoji,
        enabled: viewstate.loggedin,
        click: function(it) {
          return action('convertemoji',
      it.checked);
        }
      },
      {
        type: 'checkbox',
        label: i18n.__('menu.view.suggestemoji:Suggest emoji on typing'),
        checked: viewstate.suggestEmoji,
        enabled: viewstate.loggedin,
        click: function(it) {
          return action('suggestemoji',
      it.checked);
        }
      },
      {
        type: 'checkbox',
        accelerator: getAccelerator('toggleimagepreview'),
        label: i18n.__('menu.view.showimagepreview:Show image preview'),
        checked: viewstate.showImagePreview,
        enabled: viewstate.loggedin,
        click: function(it) {
          return action('showimagepreview',
      it.checked);
        }
      },
      {
        label: i18n.__('menu.view.color_scheme.title:Color Scheme'),
        submenu: [
          {
            label: i18n.__('menu.view.color_scheme.default:Original'),
            type: 'radio',
            checked: viewstate.colorScheme === 'default',
            click: function() {
              return action('changetheme',
          'default');
            }
          },
          {
            label: i18n.__('menu.view.color_scheme.blue:Blue'),
            type: 'radio',
            checked: viewstate.colorScheme === 'blue',
            click: function() {
              return action('changetheme',
          'blue');
            }
          },
          {
            label: i18n.__('menu.view.color_scheme.dark:Dark'),
            type: 'radio',
            checked: viewstate.colorScheme === 'dark',
            click: function() {
              return action('changetheme',
          'dark');
            }
          },
          {
            label: i18n.__('menu.view.color_scheme.material:Material'),
            type: 'radio',
            checked: viewstate.colorScheme === 'material',
            click: function() {
              return action('changetheme',
          'material');
            }
          },
          {
            label: i18n.__('menu.view.color_scheme.pop:Pop'),
            type: 'radio',
            checked: viewstate.colorScheme === 'pop',
            click: function() {
              return action('changetheme',
          'pop');
            }
          },
          {
            label: i18n.__('menu.view.color_scheme.gruvy:Gruvy'),
            type: 'radio',
            checked: viewstate.colorScheme === 'gruvy',
            click: function() {
              return action('changetheme',
          'gruvy');
            }
          }
        ]
      },
      {
        label: i18n.__('menu.view.font.title:Font Size'),
        submenu: [
          {
            label: i18n.__('menu.view.font.extra_small:Extra Small'),
            type: 'radio',
            checked: viewstate.fontSize === 'x-small',
            click: function() {
              return action('changefontsize',
          'x-small');
            }
          },
          {
            label: i18n.__('menu.view.font.small:Small'),
            type: 'radio',
            checked: viewstate.fontSize === 'small',
            click: function() {
              return action('changefontsize',
          'small');
            }
          },
          {
            label: i18n.__('menu.view.font.medium:Medium'),
            type: 'radio',
            checked: viewstate.fontSize === 'medium',
            click: function() {
              return action('changefontsize',
          'medium');
            }
          },
          {
            label: i18n.__('menu.view.font.large:Large'),
            type: 'radio',
            checked: viewstate.fontSize === 'large',
            click: function() {
              return action('changefontsize',
          'large');
            }
          },
          {
            label: i18n.__('menu.view.font.extra_large:Extra Large'),
            type: 'radio',
            checked: viewstate.fontSize === 'x-large',
            click: function() {
              return action('changefontsize',
          'x-large');
            }
          }
        ]
      },
      {
        label: i18n.__('menu.view.fullscreen:Toggle Fullscreen'),
        role: 'togglefullscreen'
      },
      {
        label: i18n.__('menu.view.zoom.in:Zoom in'),
        // seee https://github.com/atom/electron/issues/1507
        role: 'zoomin'
      },
      {
        label: i18n.__('menu.view.zoom.out:Zoom out'),
        role: 'zoomout'
      },
      {
        label: i18n.__('menu.view.zoom.reset:Actual size'),
        role: 'resetzoom'
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.view.conversation.new:New conversation'),
        accelerator: getAccelerator('newconversation'),
        enabled: viewstate.loggedin,
        click: function() {
          return action('addconversation');
        }
      },
      {
        label: i18n.__('menu.view.conversation.previous:Previous Conversation'),
        accelerator: getAccelerator('previousconversation'),
        enabled: viewstate.loggedin,
        click: function() {
          return action('selectNextConv',
      -1);
        }
      },
      {
        label: i18n.__('menu.view.conversation.next:Next Conversation'),
        accelerator: getAccelerator('nextconversation'),
        enabled: viewstate.loggedin,
        click: function() {
          return action('selectNextConv',
      +1);
        }
      },
      {
        label: i18n.__('menu.view.conversation.select:Select Conversation'),
        enabled: viewstate.loggedin,
        submenu: [
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          1),
            accelerator: getAccelerator('conversation1'),
            click: function() {
              return action('selectConvIndex',
          0);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          2),
            accelerator: getAccelerator('conversation2'),
            click: function() {
              return action('selectConvIndex',
          1);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          3),
            accelerator: getAccelerator('conversation3'),
            click: function() {
              return action('selectConvIndex',
          2);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          4),
            accelerator: getAccelerator('conversation4'),
            click: function() {
              return action('selectConvIndex',
          3);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          5),
            accelerator: getAccelerator('conversation5'),
            click: function() {
              return action('selectConvIndex',
          4);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          6),
            accelerator: getAccelerator('conversation6'),
            click: function() {
              return action('selectConvIndex',
          5);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          7),
            accelerator: getAccelerator('conversation7'),
            click: function() {
              return action('selectConvIndex',
          6);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          8),
            accelerator: getAccelerator('conversation8'),
            click: function() {
              return action('selectConvIndex',
          7);
            }
          },
          {
            label: i18n.__('conversation.numbered:Conversation %d',
          9),
            accelerator: getAccelerator('conversation9'),
            click: function() {
              return action('selectConvIndex',
          8);
            }
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.view.tray.main:Tray icon'),
        submenu: [
          {
            label: i18n.__('menu.view.tray.show_tray:Show tray icon'),
            type: 'checkbox',
            enabled: !viewstate.hidedockicon,
            checked: viewstate.showtray,
            click: function() {
              return action('toggleshowtray');
            }
          },
          {
            label: i18n.__("menu.view.tray.start_minimize:Start minimized to tray"),
            type: "checkbox",
            enabled: viewstate.showtray,
            checked: viewstate.startminimizedtotray,
            click: function() {
              return action('togglestartminimizedtotray');
            }
          },
          {
            label: i18n.__("menu.view.tray.close:Close to tray"),
            type: "checkbox",
            enabled: viewstate.showtray,
            checked: viewstate.closetotray,
            click: function() {
              return action('toggleclosetotray');
            }
          },
          {
            label: i18n.__('menu.view.tray.colorblind:Use colorblind tray icon'),
            type: 'checkbox',
            checked: viewstate.colorblind,
            click: function() {
              return action('togglecolorblind');
            }
          }
        ]
      },
      {
        label: i18n.__('menu.view.escape.title:Escape key behavior'),
        submenu: [
          {
            label: i18n.__('menu.view.escape.hide:Hides window'),
            type: 'radio',
            enabled: viewstate.showtray,
            checked: viewstate.showtray && !viewstate.escapeClearsInput,
            click: function() {
              return action('setescapeclearsinput',
          false);
            }
          },
          {
            label: i18n.__('menu.view.escape.clear:Clears input') + (!viewstate.showtray ? ` (${i18n.__('menu.view.escape.default:default when tray is not showing')})` : ''),
            type: 'radio',
            enabled: viewstate.showtray,
            checked: !viewstate.showtray || viewstate.escapeClearsInput,
            click: function() {
              return action('setescapeclearsinput',
          true);
            }
          }
        ]
      },
      isDarwin ? {
        label: i18n.__('menu.view.hide_dock:Hide Dock icon'),
        type: 'checkbox',
        enabled: viewstate.showtray,
        checked: viewstate.hidedockicon,
        click: function() {
          return action('togglehidedockicon');
        }
      } : void 0
    ].filter(function(n) {
      return n !== void 0;
    });
  };

  templateWindow = function(viewstate) {
    return [
      {
        label: i18n.__('menu.window.minimize:Minimize'),
        role: 'minimize'
      },
      {
        label: i18n.__('menu.window.close:Close'),
        accelerator: getAccelerator('close'),
        role: 'close'
      },
      {
        label: i18n.__('menu.view.tray.toggle_minimize:Toggle window show/hide'),
        click: function() {
          return action('togglewindow');
        }
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.window.front:Bring All to Front'),
        role: 'front'
      }
    ];
  };

  // note: electron framework currently does not support undefined Menu
  //  entries, which requires a filter for undefined at menu/submenu entry
  //  to remove them

  //  [.., undefined, ..., undefined,.. ].filter (n) -> n != undefined

  templateMenu = function(viewstate) {
    return [
      isLinux ? {
        label: ''
      } : void 0,
      {
        label: i18n.__('menu.file.title:YakYak'),
        submenu: templateYakYak(viewstate)
      },
      {
        label: i18n.__('menu.edit.title:Edit'),
        submenu: templateEdit(viewstate)
      },
      {
        label: i18n.__('menu.view.title:View'),
        submenu: templateView(viewstate)
      },
      !isDarwin ? {
        label: i18n.__('menu.help.title:Help'),
        submenu: [
          {
            label: i18n.__('menu.help.about.title:About YakYak'),
            click: function() {
              return action('show-about');
            }
          }
        ]
      } : void 0,
      isDarwin ? {
        label: i18n.__('menu.window.title:Window'),
        submenu: templateWindow(viewstate)
      } : void 0
    ].filter(function(n) {
      return n !== void 0;
    });
  };

  module.exports = function(viewstate) {
    // Deprecated in electron >= 7.0.0
    return Menu.setApplicationMenu(Menu.buildFromTemplate(templateMenu(viewstate)));
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvbWVudS5qcyIsInNvdXJjZXMiOlsidWkvdmlld3MvbWVudS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFBQSxNQUFBLElBQUEsRUFBQSxjQUFBLEVBQUEsY0FBQSxFQUFBLFFBQUEsRUFBQSxPQUFBLEVBQUEsV0FBQSxFQUFBLCtCQUFBLEVBQUEscUJBQUEsRUFBQSxRQUFBLEVBQUEsTUFBQSxFQUFBLFlBQUEsRUFBQSxZQUFBLEVBQUEsWUFBQSxFQUFBLGNBQUEsRUFBQTs7RUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQzs7RUFDN0IsSUFBQSxHQUFPLE1BQU0sQ0FBQzs7RUFFZCxDQUFBLENBQUMsK0JBQUQsQ0FBQSxHQUFvQyxPQUFBLENBQVEsU0FBUixDQUFwQzs7RUFFQSxRQUFBLEdBQVcsT0FBQSxDQUFRLElBQVIsQ0FBYSxDQUFDLFFBQWQsQ0FBQSxFQUxYOzs7RUFPQSxRQUFBLEdBQVcsUUFBQSxLQUFZOztFQUN2QixPQUFBLEdBQVUsUUFBQSxLQUFZOztFQUN0QixXQUFBLEdBQWMsUUFBQSxLQUFZLFNBVDFCOzs7RUFZQSxxQkFBQSxHQUF3QiwrQkFBQSxDQUFBOztFQUV4QixjQUFBLEdBQWlCLENBQUE7O0lBRWIsVUFBQSxFQUFZO01BQUUsT0FBQSxFQUFTO0lBQVgsQ0FGQztJQUdiLFVBQUEsRUFBWTtNQUFFLE9BQUEsRUFBUyxFQUFYO01BQWUsTUFBQSxFQUFPO0lBQXRCLENBSEM7SUFJYixPQUFBLEVBQVM7TUFBRSxPQUFBLEVBQVMsRUFBWDtNQUFlLE1BQUEsRUFBTztJQUF0QixDQUpJO0lBS2IsYUFBQSxFQUFlO01BQUUsT0FBQSxFQUFTO0lBQVgsQ0FMRjtJQU1iLEtBQUEsRUFBTztNQUFFLE9BQUEsRUFBUyxFQUFYO01BQWUsTUFBQSxFQUFPO0lBQXRCLENBTk07O0lBUWIsSUFBQSxFQUFNO01BQUUsT0FBQSxFQUFTO0lBQVgsQ0FSTztJQVNiLE1BQUEsRUFBUTtNQUFFLE9B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Q0FBQSxDQUFBO3FCQUFNLE1BQUEsQ0FBTyxZQUFQO1lBQU47VUFGVCxDQURPOztNQUZYLENBQUEsR0FBQSxNQWhCSjtNQTRCUyxRQUhMLEdBQUE7UUFDSSxLQUFBLEVBQU8sSUFBSSxDQUFDLEVBQUwsQ0FBUSwwQkFBUixDQURYO1FBRUksT0FBQSxFQUFTLGNBQUEsQ0FBZSxTQUFmO01BRmIsQ0FBQSxHQUFBLE1BekJKO0tBNkJDLENBQUMsTUE3QkYsQ0E2QlMsUUFBQSxDQUFDLENBQUQsQ0FBQTthQUFPLENBQUEsS0FBSztJQUFaLENBN0JUO0VBRFc7O0VBZ0NmLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLFFBQUEsQ0FBQyxTQUFELENBQUEsRUFBQTs7V0FFYixJQUFJLENBQUMsa0JBQUwsQ0FBd0IsSUFBSSxDQUFDLGlCQUFMLENBQXVCLFlBQUEsQ0FBYSxTQUFiLENBQXZCLENBQXhCO0VBRmE7QUEvaEJqQiIsInNvdXJjZXNDb250ZW50IjpbInJlbW90ZSA9IHJlcXVpcmUoJ2VsZWN0cm9uJykucmVtb3RlXG5NZW51ID0gcmVtb3RlLk1lbnVcblxue25vdGlmaWNhdGlvbkNlbnRlclN1cHBvcnRzU291bmR9ID0gcmVxdWlyZSAnLi4vdXRpbCdcblxucGxhdGZvcm0gPSByZXF1aXJlKCdvcycpLnBsYXRmb3JtKClcbiMgdG8gcmVkdWNlIG51bWJlciBvZiA9PSBjb21wYXJpc29uc1xuaXNEYXJ3aW4gPSBwbGF0Zm9ybSA9PSAnZGFyd2luJ1xuaXNMaW51eCA9IHBsYXRmb3JtID09ICdsaW51eCdcbmlzTm90RGFyd2luID0gcGxhdGZvcm0gIT0gJ2RhcndpbidcblxuIyB0cnVlIGlmIGl0IGRvZXMsIGZhbHNlIG90aGVyd2lzZVxubm90aWZpZXJTdXBwb3J0c1NvdW5kID0gbm90aWZpY2F0aW9uQ2VudGVyU3VwcG9ydHNTb3VuZCgpXG5cbmFjY2VsZXJhdG9yTWFwID0ge1xuICAgICMgTWFjT1NYIHNwZWNpZmljXG4gICAgaGlkZXlha3lhazogeyBkZWZhdWx0OiAnQ21kT3JDdHJsK0gnIH1cbiAgICBoaWRlb3RoZXJzOiB7IGRlZmF1bHQ6ICcnLCBkYXJ3aW46J0NvbW1hbmQrU2hpZnQrSCcgfVxuICAgIHNob3dhbGw6IHsgZGVmYXVsdDogJycsIGRhcndpbjonJyB9XG4gICAgb3Blbmluc3BlY3RvcjogeyBkZWZhdWx0OiAnQ21kT3JDdHJsK0FsdCtJJyB9XG4gICAgY2xvc2U6IHsgZGVmYXVsdDogJycsIGRhcndpbjonQ29tbWFuZCtXJyB9XG4gICAgIyBDb21tb24gc2hvcnRjdXRzXG4gICAgcXVpdDogeyBkZWZhdWx0OiAnQ21kT3JDdHJsK1EnIH1cbiAgICB6b29taW46IHsgZGVmYXVsdDogJ0NtZE9yQ3RybCtQbHVzJyB9XG4gICAgdG9nZ2xlaW1hZ2VwcmV2aWV3OiB7IGRlZmF1bHQ6ICdDbWRPckN0cmwrUCcgfVxuICAgICMgUGxhdGZvcm0gc3BlY2lmaWNcbiAgICBwcmV2aW91c2NvbnZlcnNhdGlvbjogeyBkZWZhdWx0OiAnQ3RybCtLJywgZGFyd2luOidDdHJsK1NoaWZ0K1RhYicgfVxuICAgIG5leHRjb252ZXJzYXRpb246ICB7IGRlZmF1bHQ6ICdDdHJsK0onLCBkYXJ3aW46J0N0cmwrVGFiJyB9XG4gICAgbmV3Y29udmVyc2F0aW9uOiB7IGRlZmF1bHQ6ICdDbWRPckN0cmwrTicgfVxuICAgIGNvbnZlcnNhdGlvbjE6IHsgZGVmYXVsdDogJ0FsdCsxJywgZGFyd2luOidDb21tYW5kKzEnIH1cbiAgICBjb252ZXJzYXRpb24yOiB7IGRlZmF1bHQ6ICdBbHQrMicsIGRhcndpbjonQ29tbWFuZCsyJyB9XG4gICAgY29udmVyc2F0aW9uMzogeyBkZWZhdWx0OiAnQWx0KzMnLCBkYXJ3aW46J0NvbW1hbmQrMycgfVxuICAgIGNvbnZlcnNhdGlvbjQ6IHsgZGVmYXVsdDogJ0FsdCs0JywgZGFyd2luOidDb21tYW5kKzQnIH1cbiAgICBjb252ZXJzYXRpb241OiB7IGRlZmF1bHQ6ICdBbHQrNScsIGRhcndpbjonQ29tbWFuZCs1JyB9XG4gICAgY29udmVyc2F0aW9uNjogeyBkZWZhdWx0OiAnQWx0KzYnLCBkYXJ3aW46J0NvbW1hbmQrNicgfVxuICAgIGNvbnZlcnNhdGlvbjc6IHsgZGVmYXVsdDogJ0FsdCs3JywgZGFyd2luOidDb21tYW5kKzcnIH1cbiAgICBjb252ZXJzYXRpb244OiB7IGRlZmF1bHQ6ICdBbHQrOCcsIGRhcndpbjonQ29tbWFuZCs4JyB9XG4gICAgY29udmVyc2F0aW9uOTogeyBkZWZhdWx0OiAnQWx0KzknLCBkYXJ3aW46J0NvbW1hbmQrOScgfVxufVxuXG5nZXRBY2NlbGVyYXRvciA9IChrZXkpIC0+XG4gICAgaWYgKGFjY2VsZXJhdG9yTWFwW2tleV1bcGxhdGZvcm1dKT9cbiAgICAgICAgYWNjZWxlcmF0b3JNYXBba2V5XVtwbGF0Zm9ybV1cbiAgICBlbHNlXG4gICAgICAgIGFjY2VsZXJhdG9yTWFwW2tleV1bJ2RlZmF1bHQnXVxuXG50ZW1wbGF0ZVlha1lhayA9ICh2aWV3c3RhdGUpIC0+XG5cbiAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LmhlbHAuYWJvdXQudGl0bGU6QWJvdXQgWWFrWWFrJ1xuICAgICAgICAgICAgY2xpY2s6IChpdCkgLT4gYWN0aW9uICdzaG93LWFib3V0J1xuICAgICAgICB9IGlmIGlzRGFyd2luXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmhlbHAuYWJvdXQuc3RhcnR1cDpPcGVuIG9uIFN0YXJ0dXAnKVxuICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLm9wZW5PblN5c3RlbVN0YXJ0dXBcbiAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnb3Blbm9uc3lzdGVtc3RhcnR1cCcsIGl0LmNoZWNrZWRcbiAgICAgICAgfVxuICAgICAgICAjeyB0eXBlOiAnc2VwYXJhdG9yJyB9XG4gICAgICAgICMgeyBsYWJlbDogJ1ByZWZlcmVuY2VzLi4uJywgYWNjZWxlcmF0b3I6ICdDb21tYW5kKywnLFxuICAgICAgICAjIGNsaWNrOiA9PiBkZWxlZ2F0ZS5vcGVuQ29uZmlnKCkgfVxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0gaWYgaXNEYXJ3aW5cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZmlsZS5oaWRlOkhpZGUgWWFrWWFrJ1xuICAgICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCdoaWRleWFreWFrJylcbiAgICAgICAgICAgIHJvbGU6IGlmIGlzRGFyd2luIHRoZW4gJ2hpZGUnIGVsc2UgJ21pbmltaXplJ1xuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LmZpbGUuaGlkZV9vdGhlcnM6SGlkZSBPdGhlcnMnXG4gICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ2hpZGVvdGhlcnMnKVxuICAgICAgICAgICAgcm9sZTogJ2hpZGVvdGhlcnMnXG4gICAgICAgIH0gaWYgaXNEYXJ3aW5cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gXCJtZW51LmZpbGUuc2hvdzpTaG93IEFsbFwiXG4gICAgICAgICAgICByb2xlOiAndW5oaWRlJ1xuICAgICAgICB9IGlmIGlzRGFyd2luICMgb2xkIHNob3cgYWxsXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfVxuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZmlsZS5pbnNwZWN0b3I6T3BlbiBJbnNwZWN0b3InXG4gICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCdvcGVuaW5zcGVjdG9yJylcbiAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdkZXZ0b29scydcbiAgICAgICAgfVxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZmlsZS5sb2dvdXQ6TG9nb3V0JylcbiAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2xvZ291dCdcbiAgICAgICAgICAgIGVuYWJsZWQ6IHZpZXdzdGF0ZS5sb2dnZWRpblxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmZpbGUucXVpdDpRdWl0JylcbiAgICAgICAgICAgIGFjY2VsZXJhdG9yOiBnZXRBY2NlbGVyYXRvcigncXVpdCcpXG4gICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdxdWl0J1xuICAgICAgICB9XG4gICAgXS5maWx0ZXIgKG4pIC0+IG4gIT0gdW5kZWZpbmVkXG5cbnRlbXBsYXRlRWRpdCA9ICh2aWV3c3RhdGUpIC0+XG4gICAgbGFuZ3VhZ2VzID0gZm9yIGxvYyBpbiBpMThuLmdldExvY2FsZXMoKVxuICAgICAgICBpZiBsb2MubGVuZ3RoIDwgMlxuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uZ2V0Q2F0YWxvZyhsb2MpLl9fTXlMb2NhbGVMYW5ndWFnZV9fXG4gICAgICAgICAgICB0eXBlOiAncmFkaW8nXG4gICAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUubGFuZ3VhZ2UgPT0gbG9jXG4gICAgICAgICAgICB2YWx1ZTogbG9jXG4gICAgICAgICAgICBjbGljazogKGl0KSAtPlxuICAgICAgICAgICAgICAgIGFjdGlvbiAnY2hhbmdlbGFuZ3VhZ2UnLCBpdC52YWx1ZVxuICAgICAgICB9XG4gICAgbGFuZ3VhZ2VzID0gbGFuZ3VhZ2VzLmZpbHRlciAobikgLT4gbiAhPSB1bmRlZmluZWRcbiAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LmVkaXQudW5kbzpVbmRvJ1xuICAgICAgICAgICAgcm9sZTogJ3VuZG8nXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZWRpdC5yZWRvOlJlZG8nXG4gICAgICAgICAgICByb2xlOiAncmVkbydcbiAgICAgICAgfVxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZWRpdC5jdXQ6Q3V0J1xuICAgICAgICAgICAgcm9sZTogJ2N1dCdcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS5lZGl0LmNvcHk6Q29weSdcbiAgICAgICAgICAgIHJvbGU6ICdjb3B5J1xuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LmVkaXQucGFzdGU6UGFzdGUnXG4gICAgICAgICAgICByb2xlOiAncGFzdGUnXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZWRpdC5zZWxlY3RfYWxsOlNlbGVjdCBBbGwnXG4gICAgICAgICAgICByb2xlOiAnc2VsZWN0YWxsJ1xuICAgICAgICB9XG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS5lZGl0Lmxhbmd1YWdlOkxhbmd1YWdlJylcbiAgICAgICAgICAgIHN1Ym1lbnU6IGxhbmd1YWdlc1xuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmVkaXQuZGF0ZWZvcm1hdDpVc2Ugc3lzdGVtIGRhdGUgZm9ybWF0JylcbiAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS51c2VTeXN0ZW1EYXRlRm9ybWF0XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlXG4gICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3NldHVzZXN5c3RlbWRhdGVmb3JtYXQnLCBpdC5jaGVja2VkXG4gICAgICAgIH1cblxuICAgIF0uZmlsdGVyIChuKSAtPiBuICE9IHVuZGVmaW5lZFxuXG50ZW1wbGF0ZVZpZXcgPSAodmlld3N0YXRlKSAtPlxuICAgIFtcbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb252ZXJzYXRpb24udGl0bGU6Q29udmVyc2F0aW9uIExpc3QnKVxuICAgICAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmNvbnZlcnNhdGlvbi50aHVtYm5haWxzLnNob3c6U2hvdyBUaHVtYm5haWxzJylcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5zaG93Q29udlRodW1ic1xuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3Nob3djb252dGh1bWJzJywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuY29udmVyc2F0aW9uLnRodW1ibmFpbHMub25seTpTaG93IFRodW1ibmFpbHMgT25seScpXG4gICAgICAgICAgICAgICAgICBjaGVja2VkOnZpZXdzdGF0ZS5zaG93Q29udk1pblxuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3Nob3djb252bWluJywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuY29udmVyc2F0aW9uLnRodW1ibmFpbHMuYW5pbWF0ZWQ6U2hvdyBBbmltYXRlZCBUaHVtYm5haWxzJylcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6dmlld3N0YXRlLnNob3dBbmltYXRlZFRodW1ic1xuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3Nob3dhbmltYXRlZHRodW1icycsIGl0LmNoZWNrZWRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmNvbnZlcnNhdGlvbi50aW1lc3RhbXA6U2hvdyBDb252ZXJzYXRpb24gVGltZXN0YW1wJylcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6dmlld3N0YXRlLnNob3dDb252VGltZVxuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluICYmICF2aWV3c3RhdGUuc2hvd0NvbnZNaW5cbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnc2hvd2NvbnZ0aW1lJywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuY29udmVyc2F0aW9uLmxhc3Q6U2hvdyBDb252ZXJzYXRpb24gTGFzdCBNZXNzYWdlJylcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6dmlld3N0YXRlLnNob3dDb252TGFzdFxuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluICYmICF2aWV3c3RhdGUuc2hvd0NvbnZNaW5cbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnc2hvd2NvbnZsYXN0JywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LnZpZXcubm90aWZpY2F0aW9uLnRpdGxlOlBvcC1VcCBOb3RpZmljYXRpb24nXG4gICAgICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcubm90aWZpY2F0aW9uLnNob3c6U2hvdyBub3RpZmljYXRpb25zJylcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLnNob3dQb3BVcE5vdGlmaWNhdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnc2hvd3BvcHVwbm90aWZpY2F0aW9ucycsIGl0LmNoZWNrZWRcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5ub3RpZmljYXRpb24ubWVzc2FnZTpTaG93IG1lc3NhZ2UgaW4gbm90aWZpY2F0aW9ucycpXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5zaG93TWVzc2FnZUluTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHZpZXdzdGF0ZS5sb2dnZWRpbiAmJiB2aWV3c3RhdGUuc2hvd1BvcFVwTm90aWZpY2F0aW9uc1xuICAgICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3Nob3dtZXNzYWdlaW5ub3RpZmljYXRpb24nLCBpdC5jaGVja2VkXG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcubm90aWZpY2F0aW9uLnVzZXJuYW1lOlNob3cgdXNlcm5hbWUgaW4gbm90aWZpY2F0aW9ucycpXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5zaG93VXNlcm5hbWVJbk5vdGlmaWNhdGlvblxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUubG9nZ2VkaW4gJiYgdmlld3N0YXRlLnNob3dQb3BVcE5vdGlmaWNhdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgY2xpY2s6IChpdCkgLT4gYWN0aW9uICdzaG93dXNlcm5hbWVpbm5vdGlmaWNhdGlvbicsIGl0LmNoZWNrZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdHlwZTogJ2NoZWNrYm94J1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gKGlmIGlzRGFyd2luIHRoZW4gJ21lbnUudmlldy5ub3RpZmljYXRpb24uYXZhdGFyOlNob3cgdXNlciBhdmF0YXIgaWNvbiBpbiBub3RpZmljYXRpb25zJyBlbHNlICdtZW51LnZpZXcubm90aWZpY2F0aW9uLmljb246U2hvdyBZYWtZYWsgaWNvbiBpbiBub3RpZmljYXRpb25zJylcbiAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHZpZXdzdGF0ZS5sb2dnZWRpbiAmJiB2aWV3c3RhdGUuc2hvd1BvcFVwTm90aWZpY2F0aW9uc1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLnNob3dJY29uTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3Nob3dpY29ubm90aWZpY2F0aW9uJywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3Lm5vdGlmaWNhdGlvbi5tdXRlOkRpc2FibGUgc291bmQgaW4gbm90aWZpY2F0aW9ucycpXG4gICAgICAgICAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUubXV0ZVNvdW5kTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUubG9nZ2VkaW4gJiYgdmlld3N0YXRlLnNob3dQb3BVcE5vdGlmaWNhdGlvbnNcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnbXV0ZXNvdW5kbm90aWZpY2F0aW9uJywgaXQuY2hlY2tlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAjIE9ubHkgc2hvdyBvcHRpb24gaWYgbm90aWZpZXIgYmFja2VuZCBzdXBwb3J0cyBzb3VuZCwgb3RoZXJ3aXNlIGN1c3RvbSBzb3VuZCBpcyBhbHdheXMgdXNlZFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcubm90aWZpY2F0aW9uLmN1c3RvbV9zb3VuZDpVc2UgWWFrWWFrIGN1c3RvbSBzb3VuZCBmb3Igbm90aWZpY2F0aW9ucycpXG4gICAgICAgICAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUuZm9yY2VDdXN0b21Tb3VuZFxuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluICYmIHZpZXdzdGF0ZS5zaG93UG9wVXBOb3RpZmljYXRpb25zICYmICF2aWV3c3RhdGUubXV0ZVNvdW5kTm90aWZpY2F0aW9uXG4gICAgICAgICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ2ZvcmNlY3VzdG9tc291bmQnLCBpdC5jaGVja2VkXG4gICAgICAgICAgICAgICAgfSBpZiBub3RpZmllclN1cHBvcnRzU291bmRcbiAgICAgICAgICAgIF0uZmlsdGVyIChuKSAtPiBuICE9IHVuZGVmaW5lZFxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuZW1vamk6Q29udmVydCB0ZXh0IHRvIGVtb2ppJylcbiAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5jb252ZXJ0RW1vamlcbiAgICAgICAgICAgIGVuYWJsZWQ6IHZpZXdzdGF0ZS5sb2dnZWRpblxuICAgICAgICAgICAgY2xpY2s6IChpdCkgLT4gYWN0aW9uICdjb252ZXJ0ZW1vamknLCBpdC5jaGVja2VkXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2NoZWNrYm94J1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5zdWdnZXN0ZW1vamk6U3VnZ2VzdCBlbW9qaSBvbiB0eXBpbmcnKVxuICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLnN1Z2dlc3RFbW9qaVxuICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICBjbGljazogKGl0KSAtPiBhY3Rpb24gJ3N1Z2dlc3RlbW9qaScsIGl0LmNoZWNrZWRcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ3RvZ2dsZWltYWdlcHJldmlldycpXG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LnNob3dpbWFnZXByZXZpZXc6U2hvdyBpbWFnZSBwcmV2aWV3JylcbiAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5zaG93SW1hZ2VQcmV2aWV3XG4gICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUubG9nZ2VkaW5cbiAgICAgICAgICAgIGNsaWNrOiAoaXQpIC0+IGFjdGlvbiAnc2hvd2ltYWdlcHJldmlldycsIGl0LmNoZWNrZWRcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmNvbG9yX3NjaGVtZS50aXRsZTpDb2xvciBTY2hlbWUnKVxuICAgICAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmNvbG9yX3NjaGVtZS5kZWZhdWx0Ok9yaWdpbmFsJylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5jb2xvclNjaGVtZSA9PSAnZGVmYXVsdCdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZXRoZW1lJywgJ2RlZmF1bHQnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb2xvcl9zY2hlbWUuYmx1ZTpCbHVlJylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5jb2xvclNjaGVtZSA9PSAnYmx1ZSdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZXRoZW1lJywgJ2JsdWUnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb2xvcl9zY2hlbWUuZGFyazpEYXJrJylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5jb2xvclNjaGVtZSA9PSAnZGFyaydcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZXRoZW1lJywgJ2RhcmsnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb2xvcl9zY2hlbWUubWF0ZXJpYWw6TWF0ZXJpYWwnKVxuICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhZGlvJ1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmNvbG9yU2NoZW1lID09ICdtYXRlcmlhbCdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZXRoZW1lJywgJ21hdGVyaWFsJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuY29sb3Jfc2NoZW1lLnBvcDpQb3AnKVxuICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhZGlvJ1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmNvbG9yU2NoZW1lID09ICdwb3AnXG4gICAgICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdjaGFuZ2V0aGVtZScsICdwb3AnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb2xvcl9zY2hlbWUuZ3J1dnk6R3J1dnknKVxuICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhZGlvJ1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmNvbG9yU2NoZW1lID09ICdncnV2eSdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZXRoZW1lJywgJ2dydXZ5J1xuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuZm9udC50aXRsZTpGb250IFNpemUnKVxuICAgICAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmZvbnQuZXh0cmFfc21hbGw6RXh0cmEgU21hbGwnKVxuICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhZGlvJ1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmZvbnRTaXplID09ICd4LXNtYWxsJ1xuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnY2hhbmdlZm9udHNpemUnLCAneC1zbWFsbCdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmZvbnQuc21hbGw6U21hbGwnKVxuICAgICAgICAgICAgICAgICAgdHlwZTogJ3JhZGlvJ1xuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmZvbnRTaXplID09ICdzbWFsbCdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZWZvbnRzaXplJywgJ3NtYWxsJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuZm9udC5tZWRpdW06TWVkaXVtJylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5mb250U2l6ZSA9PSAnbWVkaXVtJ1xuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnY2hhbmdlZm9udHNpemUnLCAnbWVkaXVtJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuZm9udC5sYXJnZTpMYXJnZScpXG4gICAgICAgICAgICAgICAgICB0eXBlOiAncmFkaW8nXG4gICAgICAgICAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUuZm9udFNpemUgPT0gJ2xhcmdlJ1xuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnY2hhbmdlZm9udHNpemUnLCAnbGFyZ2UnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5mb250LmV4dHJhX2xhcmdlOkV4dHJhIExhcmdlJylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6IHZpZXdzdGF0ZS5mb250U2l6ZSA9PSAneC1sYXJnZSdcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ2NoYW5nZWZvbnRzaXplJywgJ3gtbGFyZ2UnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3LmZ1bGxzY3JlZW46VG9nZ2xlIEZ1bGxzY3JlZW4nXG4gICAgICAgICAgICByb2xlOiAndG9nZ2xlZnVsbHNjcmVlbidcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3Lnpvb20uaW46Wm9vbSBpbidcbiAgICAgICAgICAgICMgc2VlZSBodHRwczovL2dpdGh1Yi5jb20vYXRvbS9lbGVjdHJvbi9pc3N1ZXMvMTUwN1xuICAgICAgICAgICAgcm9sZTogJ3pvb21pbidcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3Lnpvb20ub3V0Olpvb20gb3V0J1xuICAgICAgICAgICAgcm9sZTogJ3pvb21vdXQnXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUudmlldy56b29tLnJlc2V0OkFjdHVhbCBzaXplJ1xuICAgICAgICAgICAgcm9sZTogJ3Jlc2V0em9vbSdcbiAgICAgICAgfVxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb252ZXJzYXRpb24ubmV3Ok5ldyBjb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCduZXdjb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdhZGRjb252ZXJzYXRpb24nXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb252ZXJzYXRpb24ucHJldmlvdXM6UHJldmlvdXMgQ29udmVyc2F0aW9uJylcbiAgICAgICAgICAgIGFjY2VsZXJhdG9yOiBnZXRBY2NlbGVyYXRvcigncHJldmlvdXNjb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZWxlY3ROZXh0Q29udicsIC0xXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb252ZXJzYXRpb24ubmV4dDpOZXh0IENvbnZlcnNhdGlvbicpXG4gICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ25leHRjb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZWxlY3ROZXh0Q29udicsICsxXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUudmlldy5jb252ZXJzYXRpb24uc2VsZWN0OlNlbGVjdCBDb252ZXJzYXRpb24nKVxuICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLmxvZ2dlZGluXG4gICAgICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdjb252ZXJzYXRpb24ubnVtYmVyZWQ6Q29udmVyc2F0aW9uICVkJywgMSlcbiAgICAgICAgICAgICAgICAgIGFjY2VsZXJhdG9yOiBnZXRBY2NlbGVyYXRvcignY29udmVyc2F0aW9uMScpXG4gICAgICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZWxlY3RDb252SW5kZXgnLCAwXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5udW1iZXJlZDpDb252ZXJzYXRpb24gJWQnLCAyKVxuICAgICAgICAgICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCdjb252ZXJzYXRpb24yJylcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3NlbGVjdENvbnZJbmRleCcsIDFcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnY29udmVyc2F0aW9uLm51bWJlcmVkOkNvbnZlcnNhdGlvbiAlZCcsIDMpXG4gICAgICAgICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ2NvbnZlcnNhdGlvbjMnKVxuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnc2VsZWN0Q29udkluZGV4JywgMlxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdjb252ZXJzYXRpb24ubnVtYmVyZWQ6Q29udmVyc2F0aW9uICVkJywgNClcbiAgICAgICAgICAgICAgICAgIGFjY2VsZXJhdG9yOiBnZXRBY2NlbGVyYXRvcignY29udmVyc2F0aW9uNCcpXG4gICAgICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZWxlY3RDb252SW5kZXgnLCAzXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5udW1iZXJlZDpDb252ZXJzYXRpb24gJWQnLCA1KVxuICAgICAgICAgICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCdjb252ZXJzYXRpb241JylcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3NlbGVjdENvbnZJbmRleCcsIDRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnY29udmVyc2F0aW9uLm51bWJlcmVkOkNvbnZlcnNhdGlvbiAlZCcsIDYpXG4gICAgICAgICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ2NvbnZlcnNhdGlvbjYnKVxuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnc2VsZWN0Q29udkluZGV4JywgNVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdjb252ZXJzYXRpb24ubnVtYmVyZWQ6Q29udmVyc2F0aW9uICVkJywgNylcbiAgICAgICAgICAgICAgICAgIGFjY2VsZXJhdG9yOiBnZXRBY2NlbGVyYXRvcignY29udmVyc2F0aW9uNycpXG4gICAgICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZWxlY3RDb252SW5kZXgnLCA2XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ2NvbnZlcnNhdGlvbi5udW1iZXJlZDpDb252ZXJzYXRpb24gJWQnLCA4KVxuICAgICAgICAgICAgICAgICAgYWNjZWxlcmF0b3I6IGdldEFjY2VsZXJhdG9yKCdjb252ZXJzYXRpb244JylcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3NlbGVjdENvbnZJbmRleCcsIDdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnY29udmVyc2F0aW9uLm51bWJlcmVkOkNvbnZlcnNhdGlvbiAlZCcsIDkpXG4gICAgICAgICAgICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ2NvbnZlcnNhdGlvbjknKVxuICAgICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnc2VsZWN0Q29udkluZGV4JywgOFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9XG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcudHJheS5tYWluOlRyYXkgaWNvbicpXG4gICAgICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LnRyYXkuc2hvd190cmF5OlNob3cgdHJheSBpY29uJylcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NoZWNrYm94J1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBub3Qgdmlld3N0YXRlLmhpZGVkb2NraWNvblxuICAgICAgICAgICAgICAgICAgICBjaGVja2VkOiAgdmlld3N0YXRlLnNob3d0cmF5XG4gICAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3RvZ2dsZXNob3d0cmF5J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXyBcIm1lbnUudmlldy50cmF5LnN0YXJ0X21pbmltaXplOlN0YXJ0IG1pbmltaXplZCB0byB0cmF5XCJcbiAgICAgICAgICAgICAgICAgIHR5cGU6IFwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdmlld3N0YXRlLnNob3d0cmF5XG4gICAgICAgICAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUuc3RhcnRtaW5pbWl6ZWR0b3RyYXlcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3RvZ2dsZXN0YXJ0bWluaW1pemVkdG90cmF5J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fIFwibWVudS52aWV3LnRyYXkuY2xvc2U6Q2xvc2UgdG8gdHJheVwiXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUuc2hvd3RyYXlcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmNsb3NldG90cmF5XG4gICAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3RvZ2dsZWNsb3NldG90cmF5J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcudHJheS5jb2xvcmJsaW5kOlVzZSBjb2xvcmJsaW5kIHRyYXkgaWNvbicpXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja2JveCdcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tlZDogIHZpZXdzdGF0ZS5jb2xvcmJsaW5kXG4gICAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3RvZ2dsZWNvbG9yYmxpbmQnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmVzY2FwZS50aXRsZTpFc2NhcGUga2V5IGJlaGF2aW9yJylcbiAgICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LnZpZXcuZXNjYXBlLmhpZGU6SGlkZXMgd2luZG93JylcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdyYWRpbydcbiAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHZpZXdzdGF0ZS5zaG93dHJheVxuICAgICAgICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLnNob3d0cmF5ICYmICF2aWV3c3RhdGUuZXNjYXBlQ2xlYXJzSW5wdXRcbiAgICAgICAgICAgICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3NldGVzY2FwZWNsZWFyc2lucHV0JywgZmFsc2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmVzY2FwZS5jbGVhcjpDbGVhcnMgaW5wdXQnKSArIGlmICF2aWV3c3RhdGUuc2hvd3RyYXkgdGhlbiBcIiAoI3tpMThuLl9fICdtZW51LnZpZXcuZXNjYXBlLmRlZmF1bHQ6ZGVmYXVsdCB3aGVuIHRyYXkgaXMgbm90IHNob3dpbmcnfSlcIiBlbHNlICcnXG4gICAgICAgICAgICAgICAgICB0eXBlOiAncmFkaW8nXG4gICAgICAgICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUuc2hvd3RyYXlcbiAgICAgICAgICAgICAgICAgIGNoZWNrZWQ6ICF2aWV3c3RhdGUuc2hvd3RyYXkgfHwgdmlld3N0YXRlLmVzY2FwZUNsZWFyc0lucHV0XG4gICAgICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZXRlc2NhcGVjbGVhcnNpbnB1dCcsIHRydWVcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS52aWV3LmhpZGVfZG9jazpIaWRlIERvY2sgaWNvbicpXG4gICAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgICBlbmFibGVkOiB2aWV3c3RhdGUuc2hvd3RyYXlcbiAgICAgICAgICAgIGNoZWNrZWQ6ICB2aWV3c3RhdGUuaGlkZWRvY2tpY29uXG4gICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICd0b2dnbGVoaWRlZG9ja2ljb24nXG4gICAgICAgIH0gaWYgaXNEYXJ3aW5cbiAgICBdLmZpbHRlciAobikgLT4gbiAhPSB1bmRlZmluZWRcblxudGVtcGxhdGVXaW5kb3cgPSAodmlld3N0YXRlKSAtPiBbXG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS53aW5kb3cubWluaW1pemU6TWluaW1pemUnXG4gICAgICAgIHJvbGU6ICdtaW5pbWl6ZSdcbiAgICB9XG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS53aW5kb3cuY2xvc2U6Q2xvc2UnKVxuICAgICAgICBhY2NlbGVyYXRvcjogZ2V0QWNjZWxlcmF0b3IoJ2Nsb3NlJylcbiAgICAgICAgcm9sZTogJ2Nsb3NlJ1xuICAgIH1cbiAgICB7XG4gICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LnZpZXcudHJheS50b2dnbGVfbWluaW1pemU6VG9nZ2xlIHdpbmRvdyBzaG93L2hpZGUnXG4gICAgICAgIGNsaWNrOiAtPiBhY3Rpb24gJ3RvZ2dsZXdpbmRvdydcbiAgICB9XG4gICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9XG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS53aW5kb3cuZnJvbnQ6QnJpbmcgQWxsIHRvIEZyb250JylcbiAgICAgICAgcm9sZTogJ2Zyb250J1xuICAgIH1cbl1cblxuIyBub3RlOiBlbGVjdHJvbiBmcmFtZXdvcmsgY3VycmVudGx5IGRvZXMgbm90IHN1cHBvcnQgdW5kZWZpbmVkIE1lbnVcbiMgIGVudHJpZXMsIHdoaWNoIHJlcXVpcmVzIGEgZmlsdGVyIGZvciB1bmRlZmluZWQgYXQgbWVudS9zdWJtZW51IGVudHJ5XG4jICB0byByZW1vdmUgdGhlbVxuI1xuIyAgWy4uLCB1bmRlZmluZWQsIC4uLiwgdW5kZWZpbmVkLC4uIF0uZmlsdGVyIChuKSAtPiBuICE9IHVuZGVmaW5lZFxuI1xudGVtcGxhdGVNZW51ID0gKHZpZXdzdGF0ZSkgLT5cbiAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiAnJ1xuICAgICAgICB9IGlmIGlzTGludXhcbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUuZmlsZS50aXRsZTpZYWtZYWsnXG4gICAgICAgICAgICBzdWJtZW51OiB0ZW1wbGF0ZVlha1lhayB2aWV3c3RhdGVcbiAgICAgICAgfVxuICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS5lZGl0LnRpdGxlOkVkaXQnXG4gICAgICAgICAgICBzdWJtZW51OiB0ZW1wbGF0ZUVkaXQgdmlld3N0YXRlXG4gICAgICAgIH1cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gJ21lbnUudmlldy50aXRsZTpWaWV3J1xuICAgICAgICAgICAgc3VibWVudTogdGVtcGxhdGVWaWV3IHZpZXdzdGF0ZVxuICAgICAgICB9XG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS5oZWxwLnRpdGxlOkhlbHAnXG4gICAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS5oZWxwLmFib3V0LnRpdGxlOkFib3V0IFlha1lhaydcbiAgICAgICAgICAgICAgY2xpY2s6ICgpIC0+IGFjdGlvbiAnc2hvdy1hYm91dCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0gaWYgIWlzRGFyd2luXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fICdtZW51LndpbmRvdy50aXRsZTpXaW5kb3cnXG4gICAgICAgICAgICBzdWJtZW51OiB0ZW1wbGF0ZVdpbmRvdyB2aWV3c3RhdGVcbiAgICAgICAgfSBpZiBpc0RhcndpblxuICAgIF0uZmlsdGVyIChuKSAtPiBuICE9IHVuZGVmaW5lZFxuXG5tb2R1bGUuZXhwb3J0cyA9ICh2aWV3c3RhdGUpIC0+XG4gICAgIyBEZXByZWNhdGVkIGluIGVsZWN0cm9uID49IDcuMC4wXG4gICAgTWVudS5zZXRBcHBsaWNhdGlvbk1lbnUgTWVudS5idWlsZEZyb21UZW1wbGF0ZSB0ZW1wbGF0ZU1lbnUodmlld3N0YXRlKVxuIl19
