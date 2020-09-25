(function() {
  var Menu, Tray, compact, create, destroy, i18n, k, later, nativeImage, os, path, quit, trayIcons, trayIconsFile, update, v;

  path = require('path');

  os = require('os');

  i18n = require('i18n');

  ({Menu, Tray, nativeImage} = require('electron').remote);

  ({later} = require('../util'));

  trayIconsFile = os.platform() === 'darwin' ? {
    "read": 'osx-icon-read-Template.png',
    "read-colorblind": 'osx-icon-read-Template.png',
    "unread": 'osx-icon-unread-Template.png'
  } : process.env.XDG_CURRENT_DESKTOP && process.env.XDG_CURRENT_DESKTOP.match(/KDE/) ? {
    // This is to work around a bug with electron apps + KDE not showing correct icon size.
    "read": 'icon-read@20.png',
    "read-colorblind": 'icon-read@20_blue.png',
    "unread": 'icon-unread@20.png'
  } : {
    "read": 'icon-read@8x.png',
    "read-colorblind": 'icon-read@8x_blue.png',
    "unread": 'icon-unread@8x.png'
  };

  trayIcons = {};

  for (k in trayIconsFile) {
    v = trayIconsFile[k];
    trayIcons[k] = path.join(__dirname, '..', '..', 'icons', v);
  }

  // TODO: this is all WIP
  quit = function() {};

  compact = function(array) {
    var i, item, len, results;
    results = [];
    for (i = 0, len = array.length; i < len; i++) {
      item = array[i];
      if (item) {
        results.push(item);
      }
    }
    return results;
  };

  create = function(viewstate) {
    return update(0, viewstate);
  };

  destroy = function() {
    return later(function() {
      return action('destroytray');
    });
  };

  update = function(unreadCount, viewstate) {
    var e, readIconName, templateContextMenu;
    // update menu
    templateContextMenu = compact([
      {
        label: i18n.__('menu.view.tray.toggle_minimize:Toggle window show/hide'),
        click_action: 'togglewindow'
      },
      {
        label: i18n.__("menu.view.tray.start_minimize:Start minimized to tray"),
        type: "checkbox",
        checked: viewstate.startminimizedtotray,
        click_action: 'togglestartminimizedtotray'
      },
      {
        label: i18n.__('menu.view.notification.show:Show notifications'),
        type: "checkbox",
        checked: viewstate.showPopUpNotifications,
        // usage of already existing method and implements same logic
        //  as other toggle... methods
        click_action: 'togglepopupnotifications'
      },
      {
        label: i18n.__("menu.view.tray.close:Close to tray"),
        type: "checkbox",
        checked: viewstate.closetotray,
        click_action: 'toggleclosetotray'
      },
      os.platform() === 'darwin' ? {
        label: i18n.__('menu.view.hide_dock:Hide Dock icon'),
        type: 'checkbox',
        checked: viewstate.hidedockicon,
        click_action: 'togglehidedockicon'
      } : void 0,
      {
        label: i18n.__('menu.file.quit:Quit'),
        click_action: 'quit'
      }
    ]);
    try {
      // update icon
      if (unreadCount > 0) {
        return later(function() {
          return action('settray', templateContextMenu, trayIcons["unread"], i18n.__('title:YakYak - Hangouts Client'));
        });
      } else {
        readIconName = (viewstate != null ? viewstate.colorblind : void 0) ? 'read-colorblind' : 'read';
        return later(function() {
          return action('settray', templateContextMenu, trayIcons[readIconName], i18n.__('title:YakYak - Hangouts Client'));
        });
      }
    } catch (error) {
      e = error;
      return console.log('missing icons', e);
    }
  };

  module.exports = function({viewstate, conv}) {
    if (viewstate.showtray) {
      return update(conv.unreadTotal(), viewstate);
    } else {
      return destroy();
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvdHJheWljb24uanMiLCJzb3VyY2VzIjpbInVpL3ZpZXdzL3RyYXlpY29uLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxPQUFBLEVBQUEsTUFBQSxFQUFBLE9BQUEsRUFBQSxJQUFBLEVBQUEsQ0FBQSxFQUFBLEtBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsU0FBQSxFQUFBLGFBQUEsRUFBQSxNQUFBLEVBQUE7O0VBQUEsSUFBQSxHQUFPLE9BQUEsQ0FBUSxNQUFSOztFQUNQLEVBQUEsR0FBTyxPQUFBLENBQVEsSUFBUjs7RUFDUCxJQUFBLEdBQU8sT0FBQSxDQUFRLE1BQVI7O0VBRVAsQ0FBQSxDQUFFLElBQUYsRUFBUSxJQUFSLEVBQWMsV0FBZCxDQUFBLEdBQThCLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUMsTUFBbEQ7O0VBQ0EsQ0FBQSxDQUFDLEtBQUQsQ0FBQSxHQUFVLE9BQUEsQ0FBUSxTQUFSLENBQVY7O0VBRUEsYUFBQSxHQUFtQixFQUFFLENBQUMsUUFBSCxDQUFBLENBQUEsS0FBaUIsUUFBcEIsR0FDWjtJQUFBLE1BQUEsRUFBbUIsNEJBQW5CO0lBQ0EsaUJBQUEsRUFBbUIsNEJBRG5CO0lBRUEsUUFBQSxFQUFtQjtFQUZuQixDQURZLEdBSVIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBWixJQUFtQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLEtBQWhDLENBQXNDLEtBQXRDLENBQXRDLEdBRUQsQ0FBQTs7SUFBQSxNQUFBLEVBQW1CLGtCQUFuQjtJQUNBLGlCQUFBLEVBQW1CLHVCQURuQjtJQUVBLFFBQUEsRUFBbUI7RUFGbkIsQ0FGQyxHQU1EO0lBQUEsTUFBQSxFQUFtQixrQkFBbkI7SUFDQSxpQkFBQSxFQUFtQix1QkFEbkI7SUFFQSxRQUFBLEVBQW1CO0VBRm5COztFQUlKLFNBQUEsR0FBWSxDQUFBOztFQUNaLEtBQUEsa0JBQUE7O0lBQUEsU0FBUyxDQUFDLENBQUQsQ0FBVCxHQUFlLElBQUksQ0FBQyxJQUFMLENBQVUsU0FBVixFQUFxQixJQUFyQixFQUEyQixJQUEzQixFQUFpQyxPQUFqQyxFQUEwQyxDQUExQztFQUFmLENBdEJBOzs7RUF5QkEsSUFBQSxHQUFPLFFBQUEsQ0FBQSxDQUFBLEVBQUE7O0VBRVAsT0FBQSxHQUFVLFFBQUEsQ0FBQyxLQUFELENBQUE7QUFBVSxRQUFBLENBQUEsRUFBQSxJQUFBLEVBQUEsR0FBQSxFQUFBO0FBQUM7SUFBQSxLQUFBLHVDQUFBOztVQUE0QjtxQkFBNUI7O0lBQUEsQ0FBQTs7RUFBWDs7RUFFVixNQUFBLEdBQVMsUUFBQSxDQUFDLFNBQUQsQ0FBQTtXQUNMLE1BQUEsQ0FBTyxDQUFQLEVBQVUsU0FBVjtFQURLOztFQUdULE9BQUEsR0FBVSxRQUFBLENBQUEsQ0FBQTtXQUNOLEtBQUEsQ0FBTSxRQUFBLENBQUEsQ0FBQTthQUFHLE1BQUEsQ0FBTyxhQUFQO0lBQUgsQ0FBTjtFQURNOztFQUdWLE1BQUEsR0FBUyxRQUFBLENBQUMsV0FBRCxFQUFjLFNBQWQsQ0FBQTtBQUNULFFBQUEsQ0FBQSxFQUFBLFlBQUEsRUFBQSxtQkFBQTs7SUFDSSxtQkFBQSxHQUFzQixPQUFBLENBQVE7TUFDMUI7UUFDRSxLQUFBLEVBQU8sSUFBSSxDQUFDLEVBQUwsQ0FBUSx3REFBUixDQURUO1FBRUUsWUFBQSxFQUFjO01BRmhCLENBRDBCO01BTTFCO1FBQ0UsS0FBQSxFQUFPLElBQUksQ0FBQyxFQUFMLENBQVEsdURBQVIsQ0FEVDtRQUVFLElBQUEsRUFBTSxVQUZSO1FBR0UsT0FBQSxFQUFTLFNBQVMsQ0FBQyxvQkFIckI7UUFJRSxZQUFBLEVBQWM7TUFKaEIsQ0FOMEI7TUFhMUI7UUFDRSxLQUFBLEVBQU8sSUFBSSxDQUFDLEVBQUwsQ0FBUSxnREFBUixDQURUO1FBRUUsSUFBQSxFQUFNLFVBRlI7UUFHRSxPQUFBLEVBQVMsU0FBUyxDQUFDLHNCQUhyQjs7O1FBTUUsWUFBQSxFQUFjO01BTmhCLENBYjBCO01Bc0IxQjtRQUNJLEtBQUEsRUFBTyxJQUFJLENBQUMsRUFBTCxDQUFRLG9DQUFSLENBRFg7UUFFSSxJQUFBLEVBQU0sVUFGVjtRQUdJLE9BQUEsRUFBUyxTQUFTLENBQUMsV0FIdkI7UUFJSSxZQUFBLEVBQWM7TUFKbEIsQ0F0QjBCO01Ba0NyQixFQUFFLENBQUMsUUFBSCxDQUFBLENBQUEsS0FBaUIsUUFMdEIsR0FBQTtRQUNFLEtBQUEsRUFBTyxJQUFJLENBQUMsRUFBTCxDQUFRLG9DQUFSLENBRFQ7UUFFRSxJQUFBLEVBQU0sVUFGUjtRQUdFLE9BQUEsRUFBUyxTQUFTLENBQUMsWUFIckI7UUFJRSxZQUFBLEVBQWM7TUFKaEIsQ0FBQSxHQUFBLE1BN0IwQjtNQW9DMUI7UUFDRSxLQUFBLEVBQU8sSUFBSSxDQUFDLEVBQUwsQ0FBUSxxQkFBUixDQURUO1FBRUUsWUFBQSxFQUFjO01BRmhCLENBcEMwQjtLQUFSO0FBMkN0Qjs7TUFDSSxJQUFHLFdBQUEsR0FBYyxDQUFqQjtlQUNJLEtBQUEsQ0FBTSxRQUFBLENBQUEsQ0FBQTtpQkFDRixNQUFBLENBQU8sU0FBUCxFQUFrQixtQkFBbEIsRUFBdUMsU0FBUyxDQUFDLFFBQUQsQ0FBaEQsRUFBNEQsSUFBSSxDQUFDLEVBQUwsQ0FBUSxnQ0FBUixDQUE1RDtRQURFLENBQU4sRUFESjtPQUFBLE1BQUE7UUFJSSxZQUFBLHdCQUFrQixTQUFTLENBQUUsb0JBQWQsR0FBOEIsaUJBQTlCLEdBQXFEO2VBQ3BFLEtBQUEsQ0FBTSxRQUFBLENBQUEsQ0FBQTtpQkFDRixNQUFBLENBQU8sU0FBUCxFQUFrQixtQkFBbEIsRUFBdUMsU0FBUyxDQUFDLFlBQUQsQ0FBaEQsRUFBZ0UsSUFBSSxDQUFDLEVBQUwsQ0FBUSxnQ0FBUixDQUFoRTtRQURFLENBQU4sRUFMSjtPQURKO0tBUUEsYUFBQTtNQUFNO2FBQ0YsT0FBTyxDQUFDLEdBQVIsQ0FBWSxlQUFaLEVBQTZCLENBQTdCLEVBREo7O0VBckRLOztFQXlEVCxNQUFNLENBQUMsT0FBUCxHQUFpQixRQUFBLENBQUMsQ0FBQyxTQUFELEVBQVksSUFBWixDQUFELENBQUE7SUFDYixJQUFHLFNBQVMsQ0FBQyxRQUFiO2FBQ0ksTUFBQSxDQUFPLElBQUksQ0FBQyxXQUFMLENBQUEsQ0FBUCxFQUEyQixTQUEzQixFQURKO0tBQUEsTUFBQTthQUdJLE9BQUEsQ0FBQSxFQUhKOztFQURhO0FBNUZqQiIsInNvdXJjZXNDb250ZW50IjpbInBhdGggPSByZXF1aXJlICdwYXRoJ1xub3MgICA9IHJlcXVpcmUgJ29zJ1xuaTE4biA9IHJlcXVpcmUgJ2kxOG4nXG5cbnsgTWVudSwgVHJheSwgbmF0aXZlSW1hZ2UgfSA9IHJlcXVpcmUoJ2VsZWN0cm9uJykucmVtb3RlXG57bGF0ZXJ9ID0gcmVxdWlyZSAnLi4vdXRpbCdcblxudHJheUljb25zRmlsZSA9IGlmIG9zLnBsYXRmb3JtKCkgPT0gJ2RhcndpbidcbiAgICBcInJlYWRcIjogICAgICAgICAgICAnb3N4LWljb24tcmVhZC1UZW1wbGF0ZS5wbmcnXG4gICAgXCJyZWFkLWNvbG9yYmxpbmRcIjogJ29zeC1pY29uLXJlYWQtVGVtcGxhdGUucG5nJ1xuICAgIFwidW5yZWFkXCI6ICAgICAgICAgICdvc3gtaWNvbi11bnJlYWQtVGVtcGxhdGUucG5nJ1xuZWxzZSBpZiBwcm9jZXNzLmVudi5YREdfQ1VSUkVOVF9ERVNLVE9QICYmIHByb2Nlc3MuZW52LlhER19DVVJSRU5UX0RFU0tUT1AubWF0Y2goL0tERS8pXG4gICAgIyBUaGlzIGlzIHRvIHdvcmsgYXJvdW5kIGEgYnVnIHdpdGggZWxlY3Ryb24gYXBwcyArIEtERSBub3Qgc2hvd2luZyBjb3JyZWN0IGljb24gc2l6ZS5cbiAgICBcInJlYWRcIjogICAgICAgICAgICAnaWNvbi1yZWFkQDIwLnBuZydcbiAgICBcInJlYWQtY29sb3JibGluZFwiOiAnaWNvbi1yZWFkQDIwX2JsdWUucG5nJ1xuICAgIFwidW5yZWFkXCI6ICAgICAgICAgICdpY29uLXVucmVhZEAyMC5wbmcnXG5lbHNlXG4gICAgXCJyZWFkXCI6ICAgICAgICAgICAgJ2ljb24tcmVhZEA4eC5wbmcnXG4gICAgXCJyZWFkLWNvbG9yYmxpbmRcIjogJ2ljb24tcmVhZEA4eF9ibHVlLnBuZydcbiAgICBcInVucmVhZFwiOiAgICAgICAgICAnaWNvbi11bnJlYWRAOHgucG5nJ1xuXG50cmF5SWNvbnMgPSB7fVxudHJheUljb25zW2tdID0gcGF0aC5qb2luIF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ2ljb25zJywgdiBmb3Igayx2IG9mIHRyYXlJY29uc0ZpbGVcblxuIyBUT0RPOiB0aGlzIGlzIGFsbCBXSVBcbnF1aXQgPSAtPlxuXG5jb21wYWN0ID0gKGFycmF5KSAtPiBpdGVtIGZvciBpdGVtIGluIGFycmF5IHdoZW4gaXRlbVxuXG5jcmVhdGUgPSAodmlld3N0YXRlKSAtPlxuICAgIHVwZGF0ZSgwLCB2aWV3c3RhdGUpXG5cbmRlc3Ryb3kgPSAtPlxuICAgIGxhdGVyIC0+IGFjdGlvbiAnZGVzdHJveXRyYXknXG5cbnVwZGF0ZSA9ICh1bnJlYWRDb3VudCwgdmlld3N0YXRlKSAtPlxuICAgICMgdXBkYXRlIG1lbnVcbiAgICB0ZW1wbGF0ZUNvbnRleHRNZW51ID0gY29tcGFjdChbXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3LnRyYXkudG9nZ2xlX21pbmltaXplOlRvZ2dsZSB3aW5kb3cgc2hvdy9oaWRlJ1xuICAgICAgICAgIGNsaWNrX2FjdGlvbjogJ3RvZ2dsZXdpbmRvdydcbiAgICAgICAgfVxuXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXyBcIm1lbnUudmlldy50cmF5LnN0YXJ0X21pbmltaXplOlN0YXJ0IG1pbmltaXplZCB0byB0cmF5XCJcbiAgICAgICAgICB0eXBlOiBcImNoZWNrYm94XCJcbiAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUuc3RhcnRtaW5pbWl6ZWR0b3RyYXlcbiAgICAgICAgICBjbGlja19hY3Rpb246ICd0b2dnbGVzdGFydG1pbmltaXplZHRvdHJheSdcbiAgICAgICAgfVxuXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3Lm5vdGlmaWNhdGlvbi5zaG93OlNob3cgbm90aWZpY2F0aW9ucydcbiAgICAgICAgICB0eXBlOiBcImNoZWNrYm94XCJcbiAgICAgICAgICBjaGVja2VkOiB2aWV3c3RhdGUuc2hvd1BvcFVwTm90aWZpY2F0aW9uc1xuICAgICAgICAgICMgdXNhZ2Ugb2YgYWxyZWFkeSBleGlzdGluZyBtZXRob2QgYW5kIGltcGxlbWVudHMgc2FtZSBsb2dpY1xuICAgICAgICAgICMgIGFzIG90aGVyIHRvZ2dsZS4uLiBtZXRob2RzXG4gICAgICAgICAgY2xpY2tfYWN0aW9uOiAndG9nZ2xlcG9wdXBub3RpZmljYXRpb25zJ1xuICAgICAgICB9XG5cbiAgICAgICAge1xuICAgICAgICAgICAgbGFiZWw6IGkxOG4uX18gXCJtZW51LnZpZXcudHJheS5jbG9zZTpDbG9zZSB0byB0cmF5XCJcbiAgICAgICAgICAgIHR5cGU6IFwiY2hlY2tib3hcIlxuICAgICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmNsb3NldG90cmF5XG4gICAgICAgICAgICBjbGlja19hY3Rpb246ICd0b2dnbGVjbG9zZXRvdHJheSdcbiAgICAgICAgfVxuXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogaTE4bi5fXyAnbWVudS52aWV3LmhpZGVfZG9jazpIaWRlIERvY2sgaWNvbidcbiAgICAgICAgICB0eXBlOiAnY2hlY2tib3gnXG4gICAgICAgICAgY2hlY2tlZDogdmlld3N0YXRlLmhpZGVkb2NraWNvblxuICAgICAgICAgIGNsaWNrX2FjdGlvbjogJ3RvZ2dsZWhpZGVkb2NraWNvbidcbiAgICAgICAgfSBpZiBvcy5wbGF0Zm9ybSgpID09ICdkYXJ3aW4nXG5cbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiBpMThuLl9fKCdtZW51LmZpbGUucXVpdDpRdWl0JyksXG4gICAgICAgICAgY2xpY2tfYWN0aW9uOiAncXVpdCdcbiAgICAgICAgfVxuICAgIF0pXG5cbiAgICAjIHVwZGF0ZSBpY29uXG4gICAgdHJ5XG4gICAgICAgIGlmIHVucmVhZENvdW50ID4gMFxuICAgICAgICAgICAgbGF0ZXIgLT5cbiAgICAgICAgICAgICAgICBhY3Rpb24gJ3NldHRyYXknLCB0ZW1wbGF0ZUNvbnRleHRNZW51LCB0cmF5SWNvbnNbXCJ1bnJlYWRcIl0sIGkxOG4uX18oJ3RpdGxlOllha1lhayAtIEhhbmdvdXRzIENsaWVudCcpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJlYWRJY29uTmFtZSA9IGlmIHZpZXdzdGF0ZT8uY29sb3JibGluZCB0aGVuICdyZWFkLWNvbG9yYmxpbmQnIGVsc2UgJ3JlYWQnXG4gICAgICAgICAgICBsYXRlciAtPlxuICAgICAgICAgICAgICAgIGFjdGlvbiAnc2V0dHJheScsIHRlbXBsYXRlQ29udGV4dE1lbnUsIHRyYXlJY29uc1tyZWFkSWNvbk5hbWVdLCBpMThuLl9fKCd0aXRsZTpZYWtZYWsgLSBIYW5nb3V0cyBDbGllbnQnKVxuICAgIGNhdGNoIGVcbiAgICAgICAgY29uc29sZS5sb2cgJ21pc3NpbmcgaWNvbnMnLCBlXG5cblxubW9kdWxlLmV4cG9ydHMgPSAoe3ZpZXdzdGF0ZSwgY29udn0pIC0+XG4gICAgaWYgdmlld3N0YXRlLnNob3d0cmF5XG4gICAgICAgIHVwZGF0ZShjb252LnVucmVhZFRvdGFsKCksIHZpZXdzdGF0ZSlcbiAgICBlbHNlXG4gICAgICAgIGRlc3Ryb3koKVxuIl19
