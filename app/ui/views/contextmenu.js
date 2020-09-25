(function() {
  var ContextMenu, availableLanguages, clipboard, contents, isContentPasteable, remote, session, templateAboutContext, templateContext;

  remote = require('electron').remote;

  clipboard = require('electron').clipboard;

  // {download}  = require('electron-dl') # See IMPORTANT below
  ContextMenu = remote.Menu;

  ({isContentPasteable} = require('../util'));

  contents = remote.getCurrentWindow().webContents;

  session = contents.session;

  availableLanguages = session.availableSpellCheckerLanguages;

  templateContext = function(params, viewstate) {
    var canShowCopyImgLink, canShowCopyLink, canShowSaveImg, langMenu, ref, spellCheck, spellcheckLanguage;
    
    //          IMPORTANT: currently save images is disabled as there
    //            are exceptions being thrown from the electron-dl module

    canShowSaveImg = params.mediaType === 'image' && false;
    canShowCopyImgLink = params.mediaType === 'image' && params.srcURL !== '';
    canShowCopyLink = params.linkURL !== '' && params.mediaType === 'none';
    
    spellcheckLanguage = viewstate.spellcheckLanguage;
    spellCheck = spellcheckLanguage === 'none' ? i18n.__('menu.edit.spell_check.off:Spellcheck is off') : i18n.__('menu.edit.spell_check.title:Spellcheck') + ': ' + spellcheckLanguage;
    langMenu = availableLanguages.map(function(el) {
      var label;
      label = el;
      return {
        label: label,
        click: function() {
          return action('setspellchecklanguage', el);
        }
      };
    });
    return [
      ...params.dictionarySuggestions.map(function(el) {
        return {
          label: el,
          click: function() {
            return contents.replaceMisspelling(el);
          }
        };
      }),
      {
        type: 'separator',
        visible: (params != null ? (ref = params.dictionarySuggestions) != null ? ref.length : void 0 : void 0) > 0
      },
      {
        label: i18n.__('menu.edit.spell_check.title:Spellcheck'),
        submenu: [
          {
            label: spellCheck,
            enabled: false,
            checked: spellcheckLanguage !== 'none',
            click: function() {
              return action('setspellchecklanguage',
          'none');
            }
          },
          {
            label: i18n.__('menu.edit.spell_check.turn_off:Turn spellcheck off'),
            visible: spellcheckLanguage !== 'none',
            click: function() {
              return action('setspellchecklanguage',
          'none');
            }
          },
          {
            label: i18n.__('menu.edit.spell_check.available:Available languages'),
            submenu: langMenu
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.edit.save_image:Save Image'),
        visible: canShowSaveImg,
        click: function(item,
      win) {
          try {
            return download(win,
      params.srcURL);
          } catch (error) {
            return console.log('Possible problem with saving image. ',
      err);
          }
        }
      },
      canShowSaveImg ? {
        type: 'separator'
      } : void 0,
      {
        label: i18n.__('menu.edit.undo:Undo'),
        role: 'undo',
        enabled: params.editFlags.canUndo,
        visible: true
      },
      {
        label: i18n.__('menu.edit.redo:Redo'),
        role: 'redo',
        enabled: params.editFlags.canRedo,
        visible: true
      },
      {
        type: 'separator'
      },
      {
        label: i18n.__('menu.edit.cut:Cut'),
        role: 'cut',
        enabled: params.editFlags.canCut,
        visible: true
      },
      {
        label: i18n.__('menu.edit.copy:Copy'),
        role: 'copy',
        enabled: params.editFlags.canCopy,
        visible: true
      },
      {
        label: i18n.__('menu.edit.copy_link:Copy Link'),
        visible: canShowCopyLink,
        click: function() {
          if (process.platform === 'darwin') {
            return clipboard.writeBookmark(params.linkText,
      params.linkText);
          } else {
            return clipboard.writeText(params.linkText);
          }
        }
      },
      {
        label: i18n.__('menu.edit.copy_image_link:Copy Image Link'),
        visible: canShowCopyImgLink,
        click: function(item,
      win) {
          if (process.platform === 'darwin') {
            return clipboard.writeBookmark(params.srcURL,
      params.srcURL);
          } else {
            return clipboard.writeText(params.srcURL);
          }
        }
      },
      {
        label: i18n.__('menu.edit.paste:Paste'),
        role: 'paste',
        visible: (isContentPasteable() && viewstate.state === viewstate.STATE_NORMAL) || params.isEditable
      }
    ].filter(function(n) {
      return n !== void 0;
    });
  };

  templateAboutContext = function(params, viewstate) {
    return [
      {
        label: i18n.__('menu.edit.copy'),
        role: 'copy',
        enabled: params.editFlags.canCopy
      },
      {
        label: i18n.__('menu.edit.copy_link'),
        visible: params.linkURL !== '' && params.mediaType === 'none',
        click: function() {
          if (process.platform === 'darwin') {
            return clipboard.writeBookmark(params.linkText,
      params.linkText);
          } else {
            return clipboard.writeText(params.linkText);
          }
        }
      }
    ];
  };

  module.exports = function(params, viewstate) {
    if (viewstate.state === viewstate.STATE_ABOUT) {
      return ContextMenu.buildFromTemplate(templateAboutContext(params, viewstate));
    } else {
      return ContextMenu.buildFromTemplate(templateContext(params, viewstate));
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvY29udGV4dG1lbnUuanMiLCJzb3VyY2VzIjpbInVpL3ZpZXdzL2NvbnRleHRtZW51LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsV0FBQSxFQUFBLGtCQUFBLEVBQUEsU0FBQSxFQUFBLFFBQUEsRUFBQSxrQkFBQSxFQUFBLE1BQUEsRUFBQSxPQUFBLEVBQUEsb0JBQUEsRUFBQTs7RUFBQSxNQUFBLEdBQWdCLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQ3BDLFNBQUEsR0FBZ0IsT0FBQSxDQUFRLFVBQVIsQ0FBbUIsQ0FBQyxVQURwQzs7O0VBR0EsV0FBQSxHQUFjLE1BQU0sQ0FBQzs7RUFFckIsQ0FBQSxDQUFDLGtCQUFELENBQUEsR0FBdUIsT0FBQSxDQUFRLFNBQVIsQ0FBdkI7O0VBRUEsUUFBQSxHQUFXLE1BQU0sQ0FBQyxnQkFBUCxDQUFBLENBQXlCLENBQUM7O0VBQ3JDLE9BQUEsR0FBVSxRQUFRLENBQUM7O0VBQ25CLGtCQUFBLEdBQXFCLE9BQU8sQ0FBQzs7RUFFN0IsZUFBQSxHQUFrQixRQUFBLENBQUMsTUFBRCxFQUFTLFNBQVQsQ0FBQTtBQUNsQixRQUFBLGtCQUFBLEVBQUEsZUFBQSxFQUFBLGNBQUEsRUFBQSxRQUFBLEVBQUEsR0FBQSxFQUFBLFVBQUEsRUFBQSxrQkFBQTs7Ozs7SUFJSSxjQUFBLEdBQWlCLE1BQU0sQ0FBQyxTQUFQLEtBQW9CLE9BQXBCLElBQStCO0lBQ2hELGtCQUFBLEdBQXFCLE1BQU0sQ0FBQyxTQUFQLEtBQW9CLE9BQXBCLElBQStCLE1BQU0sQ0FBQyxNQUFQLEtBQWlCO0lBQ3JFLGVBQUEsR0FBa0IsTUFBTSxDQUFDLE9BQVAsS0FBa0IsRUFBbEIsSUFBd0IsTUFBTSxDQUFDLFNBQVAsS0FBb0I7O0lBRzlELGtCQUFBLEdBQXFCLFNBQVMsQ0FBQztJQUMvQixVQUFBLEdBQWdCLGtCQUFBLEtBQXNCLE1BQXpCLEdBQ1QsSUFBSSxDQUFDLEVBQUwsQ0FBUSw2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cGJvYXJkICAgICA9IHJlcXVpcmUoJ2VsZWN0cm9uJykuY2xpcGJvYXJkXG4jIHtkb3dubG9hZH0gID0gcmVxdWlyZSgnZWxlY3Ryb24tZGwnKSAjIFNlZSBJTVBPUlRBTlQgYmVsb3dcbkNvbnRleHRNZW51ID0gcmVtb3RlLk1lbnVcblxue2lzQ29udGVudFBhc3RlYWJsZX0gPSByZXF1aXJlICcuLi91dGlsJ1xuXG5jb250ZW50cyA9IHJlbW90ZS5nZXRDdXJyZW50V2luZG93KCkud2ViQ29udGVudHNcbnNlc3Npb24gPSBjb250ZW50cy5zZXNzaW9uXG5hdmFpbGFibGVMYW5ndWFnZXMgPSBzZXNzaW9uLmF2YWlsYWJsZVNwZWxsQ2hlY2tlckxhbmd1YWdlc1xuXG50ZW1wbGF0ZUNvbnRleHQgPSAocGFyYW1zLCB2aWV3c3RhdGUpIC0+XG4gICAgI1xuICAgICMgICAgICAgICAgSU1QT1JUQU5UOiBjdXJyZW50bHkgc2F2ZSBpbWFnZXMgaXMgZGlzYWJsZWQgYXMgdGhlcmVcbiAgICAjICAgICAgICAgICAgYXJlIGV4Y2VwdGlvbnMgYmVpbmcgdGhyb3duIGZyb20gdGhlIGVsZWN0cm9uLWRsIG1vZHVsZVxuICAgICNcbiAgICBjYW5TaG93U2F2ZUltZyA9IHBhcmFtcy5tZWRpYVR5cGUgPT0gJ2ltYWdlJyAmJiBmYWxzZVxuICAgIGNhblNob3dDb3B5SW1nTGluayA9IHBhcmFtcy5tZWRpYVR5cGUgPT0gJ2ltYWdlJyAmJiBwYXJhbXMuc3JjVVJMICE9ICcnXG4gICAgY2FuU2hvd0NvcHlMaW5rID0gcGFyYW1zLmxpbmtVUkwgIT0gJycgJiYgcGFyYW1zLm1lZGlhVHlwZSA9PSAnbm9uZSdcbiAgICAjXG5cbiAgICBzcGVsbGNoZWNrTGFuZ3VhZ2UgPSB2aWV3c3RhdGUuc3BlbGxjaGVja0xhbmd1YWdlXG4gICAgc3BlbGxDaGVjayA9IGlmIHNwZWxsY2hlY2tMYW5ndWFnZSA9PSAnbm9uZSdcbiAgICAgICAgaTE4bi5fXygnbWVudS5lZGl0LnNwZWxsX2NoZWNrLm9mZjpTcGVsbGNoZWNrIGlzIG9mZicpXG4gICAgZWxzZVxuICAgICAgICBpMThuLl9fKCdtZW51LmVkaXQuc3BlbGxfY2hlY2sudGl0bGU6U3BlbGxjaGVjaycpICsgJzogJyArIHNwZWxsY2hlY2tMYW5ndWFnZVxuXG4gICAgbGFuZ01lbnUgPSBhdmFpbGFibGVMYW5ndWFnZXMubWFwIChlbCkgLT5cbiAgICAgICAgbGFiZWwgPSBlbFxuICAgICAgICB7IGxhYmVsOiBsYWJlbCwgY2xpY2s6IC0+IGFjdGlvbiAnc2V0c3BlbGxjaGVja2xhbmd1YWdlJywgZWx9XG5cbiAgICBbXG4gICAgICAuLi5wYXJhbXMuZGljdGlvbmFyeVN1Z2dlc3Rpb25zLm1hcCAoZWwpIC0+IHsgbGFiZWw6IGVsLCBjbGljazogLT4gY29udGVudHMucmVwbGFjZU1pc3NwZWxsaW5nKGVsKX1cbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ3NlcGFyYXRvcidcbiAgICAgICAgdmlzaWJsZTogcGFyYW1zPy5kaWN0aW9uYXJ5U3VnZ2VzdGlvbnM/Lmxlbmd0aCA+IDBcbiAgICAgIH1cbiAgICAgIHtcbiAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZWRpdC5zcGVsbF9jaGVjay50aXRsZTpTcGVsbGNoZWNrJylcbiAgICAgICAgc3VibWVudTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxhYmVsOiBzcGVsbENoZWNrXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogZmFsc2VcbiAgICAgICAgICAgICAgICBjaGVja2VkOiBzcGVsbGNoZWNrTGFuZ3VhZ2UgIT0gJ25vbmUnXG4gICAgICAgICAgICAgICAgY2xpY2s6IC0+IGFjdGlvbiAnc2V0c3BlbGxjaGVja2xhbmd1YWdlJywgJ25vbmUnXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZWRpdC5zcGVsbF9jaGVjay50dXJuX29mZjpUdXJuIHNwZWxsY2hlY2sgb2ZmJylcbiAgICAgICAgICAgICAgdmlzaWJsZTogc3BlbGxjaGVja0xhbmd1YWdlICE9ICdub25lJ1xuICAgICAgICAgICAgICBjbGljazogLT4gYWN0aW9uICdzZXRzcGVsbGNoZWNrbGFuZ3VhZ2UnLCAnbm9uZSdcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmVkaXQuc3BlbGxfY2hlY2suYXZhaWxhYmxlOkF2YWlsYWJsZSBsYW5ndWFnZXMnKVxuICAgICAgICAgICAgICAgIHN1Ym1lbnU6IGxhbmdNZW51XG4gICAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICB9XG4gICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9XG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS5lZGl0LnNhdmVfaW1hZ2U6U2F2ZSBJbWFnZScpXG4gICAgICAgIHZpc2libGU6IGNhblNob3dTYXZlSW1nXG4gICAgICAgIGNsaWNrOiAoaXRlbSwgd2luKSAtPlxuICAgICAgICAgICAgdHJ5XG4gICAgICAgICAgICAgICAgZG93bmxvYWQgd2luLCBwYXJhbXMuc3JjVVJMXG4gICAgICAgICAgICBjYXRjaFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nICdQb3NzaWJsZSBwcm9ibGVtIHdpdGggc2F2aW5nIGltYWdlLiAnLCBlcnJcbiAgICB9XG4gICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9IGlmIGNhblNob3dTYXZlSW1nXG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS5lZGl0LnVuZG86VW5kbycpXG4gICAgICAgIHJvbGU6ICd1bmRvJ1xuICAgICAgICBlbmFibGVkOiBwYXJhbXMuZWRpdEZsYWdzLmNhblVuZG9cbiAgICAgICAgdmlzaWJsZTogdHJ1ZVxuICAgIH1cbiAgICB7XG4gICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmVkaXQucmVkbzpSZWRvJylcbiAgICAgICAgcm9sZTogJ3JlZG8nXG4gICAgICAgIGVuYWJsZWQ6IHBhcmFtcy5lZGl0RmxhZ3MuY2FuUmVkb1xuICAgICAgICB2aXNpYmxlOiB0cnVlXG4gICAgfVxuICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfVxuICAgIHtcbiAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZWRpdC5jdXQ6Q3V0JylcbiAgICAgICAgcm9sZTogJ2N1dCdcbiAgICAgICAgZW5hYmxlZDogcGFyYW1zLmVkaXRGbGFncy5jYW5DdXRcbiAgICAgICAgdmlzaWJsZTogdHJ1ZVxuICAgIH1cbiAgICB7XG4gICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmVkaXQuY29weTpDb3B5JylcbiAgICAgICAgcm9sZTogJ2NvcHknXG4gICAgICAgIGVuYWJsZWQ6IHBhcmFtcy5lZGl0RmxhZ3MuY2FuQ29weVxuICAgICAgICB2aXNpYmxlOiB0cnVlXG4gICAgfVxuICAgIHtcbiAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZWRpdC5jb3B5X2xpbms6Q29weSBMaW5rJylcbiAgICAgICAgdmlzaWJsZTogY2FuU2hvd0NvcHlMaW5rXG4gICAgICAgIGNsaWNrOiAoKSAtPlxuICAgICAgICAgICAgaWYgcHJvY2Vzcy5wbGF0Zm9ybSA9PSAnZGFyd2luJ1xuICAgICAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZUJvb2ttYXJrIHBhcmFtcy5saW5rVGV4dCwgcGFyYW1zLmxpbmtUZXh0XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgY2xpcGJvYXJkLndyaXRlVGV4dCBwYXJhbXMubGlua1RleHRcbiAgICB9XG4gICAge1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS5lZGl0LmNvcHlfaW1hZ2VfbGluazpDb3B5IEltYWdlIExpbmsnKVxuICAgICAgICB2aXNpYmxlOiBjYW5TaG93Q29weUltZ0xpbmtcbiAgICAgICAgY2xpY2s6IChpdGVtLCB3aW4pIC0+XG4gICAgICAgICAgICBpZiBwcm9jZXNzLnBsYXRmb3JtID09ICdkYXJ3aW4nXG4gICAgICAgICAgICAgICAgY2xpcGJvYXJkLndyaXRlQm9va21hcmsgcGFyYW1zLnNyY1VSTCwgcGFyYW1zLnNyY1VSTFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGNsaXBib2FyZC53cml0ZVRleHQgcGFyYW1zLnNyY1VSTFxuICAgIH1cbiAgICB7XG4gICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmVkaXQucGFzdGU6UGFzdGUnKVxuICAgICAgICByb2xlOiAncGFzdGUnXG4gICAgICAgIHZpc2libGU6IChpc0NvbnRlbnRQYXN0ZWFibGUoKSAmJlxuICAgICAgICAgICAgdmlld3N0YXRlLnN0YXRlID09IHZpZXdzdGF0ZS5TVEFURV9OT1JNQUwpIHx8IHBhcmFtcy5pc0VkaXRhYmxlXG4gICAgfV0uZmlsdGVyIChuKSAtPiBuICE9IHVuZGVmaW5lZFxuXG50ZW1wbGF0ZUFib3V0Q29udGV4dCA9IChwYXJhbXMsIHZpZXdzdGF0ZSkgLT5cbiAgICBbe1xuICAgICAgICBsYWJlbDogaTE4bi5fXygnbWVudS5lZGl0LmNvcHknKVxuICAgICAgICByb2xlOiAnY29weSdcbiAgICAgICAgZW5hYmxlZDogcGFyYW1zLmVkaXRGbGFncy5jYW5Db3B5XG4gICAgfVxuICAgIHtcbiAgICAgICAgbGFiZWw6IGkxOG4uX18oJ21lbnUuZWRpdC5jb3B5X2xpbmsnKVxuICAgICAgICB2aXNpYmxlOiBwYXJhbXMubGlua1VSTCAhPSAnJyBhbmQgcGFyYW1zLm1lZGlhVHlwZSA9PSAnbm9uZSdcbiAgICAgICAgY2xpY2s6ICgpIC0+XG4gICAgICAgICAgICBpZiBwcm9jZXNzLnBsYXRmb3JtID09ICdkYXJ3aW4nXG4gICAgICAgICAgICAgICAgY2xpcGJvYXJkXG4gICAgICAgICAgICAgICAgLndyaXRlQm9va21hcmsgcGFyYW1zLmxpbmtUZXh0LCBwYXJhbXMubGlua1RleHRcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjbGlwYm9hcmQud3JpdGVUZXh0IHBhcmFtcy5saW5rVGV4dFxuICAgIH1dXG5tb2R1bGUuZXhwb3J0cyA9IChwYXJhbXMsIHZpZXdzdGF0ZSkgLT5cbiAgICBpZiB2aWV3c3RhdGUuc3RhdGUgPT0gdmlld3N0YXRlLlNUQVRFX0FCT1VUXG4gICAgICAgIENvbnRleHRNZW51LmJ1aWxkRnJvbVRlbXBsYXRlIHRlbXBsYXRlQWJvdXRDb250ZXh0KHBhcmFtcywgdmlld3N0YXRlKVxuICAgIGVsc2VcbiAgICAgICAgQ29udGV4dE1lbnUuYnVpbGRGcm9tVGVtcGxhdGUgdGVtcGxhdGVDb250ZXh0KHBhcmFtcywgdmlld3N0YXRlKVxuIl19
