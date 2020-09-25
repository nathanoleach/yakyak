(function() {
  var Menu, check, i18n, ipc, path, remote, versionToInt;

  ipc = require('electron').ipcRenderer;

  path = require('path');

  i18n = require('i18n');

  remote = require('electron').remote;

  Menu = remote.Menu;

  ({check, versionToInt} = require('../version'));

  module.exports = view(function(models) {
    var localVersion, releasedVersion, shouldUpdate;
    
    // decide if should update
    localVersion = remote.require('electron').app.getVersion();
    releasedVersion = window.localStorage.versionAdvertised;
    shouldUpdate = (releasedVersion != null) && (localVersion != null) && versionToInt(releasedVersion) > versionToInt(localVersion);
    
    return div({
      class: 'about'
    }, function() {
      div(function() {
        return img({
          src: path.join(YAKYAK_ROOT_DIR, '..', 'icons', 'icon@8.png')
        });
      });
      div({
        class: 'name'
      }, function() {
        return h2(function() {
          span('YakYak v' + localVersion);
          if (!shouldUpdate) {
            return span({
              class: 'f-small f-no-bold'
            }, ' (latest)');
          }
        });
      });
      // TODO: if objects are undefined then it should check again on next
      //        time about window is opened
      //        releasedVersion = window.localStorage.versionAdvertised
      if (shouldUpdate) {
        div({
          class: 'update'
        }, function() {
          return span(i18n.__('menu.help.about.newer:A newer version is available, please upgrade from %s to %s', localVersion, releasedVersion));
        });
      }
      div({
        class: 'description'
      }, function() {
        return span(i18n.__('title:YakYak - Hangouts Client'));
      });
      div({
        class: 'license'
      }, function() {
        return span(function() {
          em(`${i18n.__('menu.help.about.license:License')}: `);
          return span('MIT');
        });
      });
      div({
        class: 'devs'
      }, function() {
        div(function() {
          h3(i18n.__('menu.help.about.authors:Main authors'));
          return ul(function() {
            li('Davide Bertola');
            li('Martin Algesten');
            return li('André Veríssimo');
          });
        });
        return div(function() {
          h3(i18n.__('menu.help.about.contributors:Contributors'));
          return ul(function() {
            li('David Banham');
            li('Max Kueng');
            li('Arnaud Riu');
            li('Austin Guevara');
            return li('Mathias Tillman');
          });
        });
      });
      return div({
        class: 'home'
      }, function() {
        var href;
        href = "https://github.com/yakyak/yakyak";
        return a({
          href: href,
          onclick: function(ev) {
            var address;
            ev.preventDefault();
            address = ev.currentTarget.getAttribute('href');
            require('electron').shell.openExternal(address);
            return false;
          }
        }, href);
      });
    });
  });

  //$('document').on 'click', '.link-out', (ev)->


}).call(this);

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkvdmlld3MvYWJvdXQuanMiLCJzb3VyY2VzIjpbInVpL3ZpZXdzL2Fib3V0LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLE1BQUEsSUFBQSxFQUFBLEtBQUEsRUFBQSxJQUFBLEVBQUEsR0FBQSxFQUFBLElBQUEsRUFBQSxNQUFBLEVBQUE7O0VBQUEsR0FBQSxHQUFPLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQzNCLElBQUEsR0FBTyxPQUFBLENBQVEsTUFBUjs7RUFDUCxJQUFBLEdBQU8sT0FBQSxDQUFRLE1BQVI7O0VBQ1AsTUFBQSxHQUFTLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUM7O0VBQzdCLElBQUEsR0FBUyxNQUFNLENBQUM7O0VBRWhCLENBQUEsQ0FBQyxLQUFELEVBQVEsWUFBUixDQUFBLEdBQXdCLE9BQUEsQ0FBUSxZQUFSLENBQXhCOztFQUVBLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLElBQUEsQ0FBSyxRQUFBLENBQUMsTUFBRCxDQUFBO0FBQ3RCLFFBQUEsWUFBQSxFQUFBLGVBQUEsRUFBQSxZQUFBOzs7SUFFSSxZQUFBLEdBQWtCLE1BQU0sQ0FBQyxPQUFQLENBQWUsVUFBZixDQUEwQixDQUFDLEdBQUcsQ0FBQyxVQUEvQixDQUFBO0lBQ2xCLGVBQUEsR0FBa0IsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUN0QyxZQUFBLEdBQWtCLHlCQUFBLElBQW9CLHNCQUFwQixJQUNBLFlBQUEsQ0FBYSxlQUFiLENBQUEsR0FBZ0MsWUFBQSxDQUFhLFlBQWI7O1dBRWxELEdBQUEsQ0FBSTtNQUFBLEtBQUEsRUFBTztJQUFQLENBQUosRUFBb0IsUUFBQSxDQUFBLENBQUE7TUFDaEIsR0FBQSxDQUFJLFFBQUEsQ0FBQSxDQUFBO2VBQ0EsR0FBQSxDQUFJO1VBQUEsR0FBQSxFQUFLLElBQUksQ0FBQyxJQUFMLENBQVUsZUFBVixFQUEyQixJQUEzQixFQUFpQyxPQUFqQyxFQUEwQyxZQUExQztRQUFMLENBQUo7TUFEQSxDQUFKO01BRUEsR0FBQSxDQUFJO1FBQUEsS0FBQSxFQUFPO01BQVAsQ0FBSixFQUFtQixRQUFBLENBQUEsQ0FBQTtlQUNmLEVBQUEsQ0FBRyxRQUFBLENBQUEsQ0FBQTtVQUNDLElBQUEsQ0FBSyxVQUFBLEdBQWEsWUFBbEI7VUFDQSxLQUFvRCxZQUFwRDttQkFBQSxJQUFBLENBQUs7Y0FBQSxLQUFBLEVBQU87WUFBUCxDQUFMLEVBQWlDLFdBQWpDLEVBQUE7O1FBRkQsQ0FBSDtNQURlLENBQW5CLEVBRlI7Ozs7TUFTUSxJQUFHLFlBQUg7UUFDSSxHQUFBLENBQUk7VUFBQSxLQUFBLEVBQU87UUFBUCxDQUFKLEVBQXFCLFFBQUEsQ0FBQSxDQUFBO2lCQUNqQixJQUFBLENBQUssSUFBSSxDQUFDLEVBQUwsQ0FBUSxrRkFBUixFQUNVLFlBRFYsRUFFVSxlQUZWLENBQUw7UUFEaUIsQ0FBckIsRUFESjs7TUFLQSxHQUFBLENBQUk7UUFBQSxLQUFBLEVBQU87TUFBUCxDQUFKLEVBQTBCLFFBQUEsQ0FBQSxDQUFBO2VBQ3RCLElBQUEsQ0FBSyxJQUFJLENBQUMsRUFBTCxDQUFRLGdDQUFSLENBQUw7TUFEc0IsQ0FBMUI7TUFFQSxHQUFBLENBQUk7UUFBQSxLQUFBLEVBQU87TUFBUCxDQUFKLEVBQXNCLFFBQUEsQ0FBQSxDQUFBO2VBQ2xCLElBQUEsQ0FBSyxRQUFBLENBQUEsQ0FBQTtVQUNELEVBQUEsQ0FBRyxDQUFBLENBQUEsQ0FBRyxJQUFJLENBQUMsRUFBTCxDQUFRLGlDQUFSLENBQUgsQ0FBQSxFQUFBLENBQUg7aUJBQ0EsSUFBQSxDQUFLLEtBQUw7UUFGQyxDQUFMO01BRGtCLENBQXRCO01BSUEsR0FBQSxDQUFJO1FBQUEsS0FBQSxFQUFPO01BQVAsQ0FBSixFQUFtQixRQUFBLENBQUEsQ0FBQTtRQUNmLEdBQUEsQ0FBSSxRQUFBLENBQUEsQ0FBQTtVQUNBLEVBQUEsQ0FBRyxJQUFJLENBQUMsRUFBTCxDQUFRLHNDQUFSLENBQUg7aUJBQ0EsRUFBQSxDQUFHLFFBQUEsQ0FBQSxDQUFBO1lBQ0MsRUFBQSxDQUFHLGdCQUFIO1lBQ0EsRUFBQSxDQUFHLGlCQUFIO21CQUNBLEVBQUEsQ0FBRyxpQkFBSDtVQUhELENBQUg7UUFGQSxDQUFKO2VBTUEsR0FBQSxDQUFJLFFBQUEsQ0FBQSxDQUFBO1VBQ0EsRUFBQSxDQUFHLElBQUksQ0FBQyxFQUFMLENBQVEsMkNBQVIsQ0FBSDtpQkFDQSxFQUFBLENBQUcsUUFBQSxDQUFBLENBQUE7WUFDQyxFQUFBLENBQUcsY0FBSDtZQUNBLEVBQUEsQ0FBRyxXQUFIO1lBQ0EsRUFBQSxDQUFHLFlBQUg7WUFDQSxFQUFBLENBQUcsZ0JBQUg7bUJBQ0EsRUFBQSxDQUFHLGlCQUFIO1VBTEQsQ0FBSDtRQUZBLENBQUo7TUFQZSxDQUFuQjthQWdCQSxHQUFBLENBQUk7UUFBQSxLQUFBLEVBQU87TUFBUCxDQUFKLEVBQW1CLFFBQUEsQ0FBQSxDQUFBO0FBQzNCLFlBQUE7UUFBWSxJQUFBLEdBQU87ZUFDUCxDQUFBLENBQUU7VUFBQSxJQUFBLEVBQU0sSUFBTjtVQUNBLE9BQUEsRUFBUyxRQUFBLENBQUMsRUFBRCxDQUFBO0FBQ3ZCLGdCQUFBO1lBQWdCLEVBQUUsQ0FBQyxjQUFILENBQUE7WUFDQSxPQUFBLEdBQVUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxZQUFqQixDQUE4QixNQUE5QjtZQUNWLE9BQUEsQ0FBUSxVQUFSLENBQW1CLENBQUMsS0FBSyxDQUFDLFlBQTFCLENBQXVDLE9BQXZDO21CQUNBO1VBSk87UUFEVCxDQUFGLEVBTUUsSUFORjtNQUZlLENBQW5CO0lBckNnQixDQUFwQjtFQVJrQixDQUFMOztFQVJqQjs7QUFBQSIsInNvdXJjZXNDb250ZW50IjpbImlwYyAgPSByZXF1aXJlKCdlbGVjdHJvbicpLmlwY1JlbmRlcmVyXG5wYXRoID0gcmVxdWlyZSAncGF0aCdcbmkxOG4gPSByZXF1aXJlICdpMThuJ1xucmVtb3RlID0gcmVxdWlyZSgnZWxlY3Ryb24nKS5yZW1vdGVcbk1lbnUgICA9IHJlbW90ZS5NZW51XG5cbntjaGVjaywgdmVyc2lvblRvSW50fSA9IHJlcXVpcmUgJy4uL3ZlcnNpb24nXG5cbm1vZHVsZS5leHBvcnRzID0gdmlldyAobW9kZWxzKSAtPlxuICAgICNcbiAgICAjIGRlY2lkZSBpZiBzaG91bGQgdXBkYXRlXG4gICAgbG9jYWxWZXJzaW9uICAgID0gcmVtb3RlLnJlcXVpcmUoJ2VsZWN0cm9uJykuYXBwLmdldFZlcnNpb24oKVxuICAgIHJlbGVhc2VkVmVyc2lvbiA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UudmVyc2lvbkFkdmVydGlzZWRcbiAgICBzaG91bGRVcGRhdGUgICAgPSByZWxlYXNlZFZlcnNpb24/ICYmIGxvY2FsVmVyc2lvbj8gJiZcbiAgICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uVG9JbnQocmVsZWFzZWRWZXJzaW9uKSA+IHZlcnNpb25Ub0ludChsb2NhbFZlcnNpb24pXG4gICAgI1xuICAgIGRpdiBjbGFzczogJ2Fib3V0JywgLT5cbiAgICAgICAgZGl2IC0+XG4gICAgICAgICAgICBpbWcgc3JjOiBwYXRoLmpvaW4gWUFLWUFLX1JPT1RfRElSLCAnLi4nLCAnaWNvbnMnLCAnaWNvbkA4LnBuZydcbiAgICAgICAgZGl2IGNsYXNzOiAnbmFtZScsIC0+XG4gICAgICAgICAgICBoMiAtPlxuICAgICAgICAgICAgICAgIHNwYW4gJ1lha1lhayB2JyArIGxvY2FsVmVyc2lvblxuICAgICAgICAgICAgICAgIHNwYW4gY2xhc3M6ICdmLXNtYWxsIGYtbm8tYm9sZCcsICcgKGxhdGVzdCknIHVubGVzcyBzaG91bGRVcGRhdGVcbiAgICAgICAgIyBUT0RPOiBpZiBvYmplY3RzIGFyZSB1bmRlZmluZWQgdGhlbiBpdCBzaG91bGQgY2hlY2sgYWdhaW4gb24gbmV4dFxuICAgICAgICAjICAgICAgICB0aW1lIGFib3V0IHdpbmRvdyBpcyBvcGVuZWRcbiAgICAgICAgIyAgICAgICAgcmVsZWFzZWRWZXJzaW9uID0gd2luZG93LmxvY2FsU3RvcmFnZS52ZXJzaW9uQWR2ZXJ0aXNlZFxuICAgICAgICBpZiBzaG91bGRVcGRhdGVcbiAgICAgICAgICAgIGRpdiBjbGFzczogJ3VwZGF0ZScsIC0+XG4gICAgICAgICAgICAgICAgc3BhbiBpMThuLl9fKCdtZW51LmhlbHAuYWJvdXQubmV3ZXI6QSBuZXdlciB2ZXJzaW9uIGlzIGF2YWlsYWJsZSwgcGxlYXNlIHVwZ3JhZGUgZnJvbSAlcyB0byAlcydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCBsb2NhbFZlcnNpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLCByZWxlYXNlZFZlcnNpb24pXG4gICAgICAgIGRpdiBjbGFzczogJ2Rlc2NyaXB0aW9uJywgLT5cbiAgICAgICAgICAgIHNwYW4gaTE4bi5fXygndGl0bGU6WWFrWWFrIC0gSGFuZ291dHMgQ2xpZW50JylcbiAgICAgICAgZGl2IGNsYXNzOiAnbGljZW5zZScsIC0+XG4gICAgICAgICAgICBzcGFuIC0+XG4gICAgICAgICAgICAgICAgZW0gXCIje2kxOG4uX18gJ21lbnUuaGVscC5hYm91dC5saWNlbnNlOkxpY2Vuc2UnfTogXCJcbiAgICAgICAgICAgICAgICBzcGFuICdNSVQnXG4gICAgICAgIGRpdiBjbGFzczogJ2RldnMnLCAtPlxuICAgICAgICAgICAgZGl2IC0+XG4gICAgICAgICAgICAgICAgaDMgaTE4bi5fXygnbWVudS5oZWxwLmFib3V0LmF1dGhvcnM6TWFpbiBhdXRob3JzJylcbiAgICAgICAgICAgICAgICB1bCAtPlxuICAgICAgICAgICAgICAgICAgICBsaSAnRGF2aWRlIEJlcnRvbGEnXG4gICAgICAgICAgICAgICAgICAgIGxpICdNYXJ0aW4gQWxnZXN0ZW4nXG4gICAgICAgICAgICAgICAgICAgIGxpICdBbmRyw6kgVmVyw61zc2ltbydcbiAgICAgICAgICAgIGRpdiAtPlxuICAgICAgICAgICAgICAgIGgzIGkxOG4uX18oJ21lbnUuaGVscC5hYm91dC5jb250cmlidXRvcnM6Q29udHJpYnV0b3JzJylcbiAgICAgICAgICAgICAgICB1bCAtPlxuICAgICAgICAgICAgICAgICAgICBsaSAnRGF2aWQgQmFuaGFtJ1xuICAgICAgICAgICAgICAgICAgICBsaSAnTWF4IEt1ZW5nJ1xuICAgICAgICAgICAgICAgICAgICBsaSAnQXJuYXVkIFJpdSdcbiAgICAgICAgICAgICAgICAgICAgbGkgJ0F1c3RpbiBHdWV2YXJhJ1xuICAgICAgICAgICAgICAgICAgICBsaSAnTWF0aGlhcyBUaWxsbWFuJ1xuXG4gICAgICAgIGRpdiBjbGFzczogJ2hvbWUnLCAtPlxuICAgICAgICAgICAgaHJlZiA9IFwiaHR0cHM6Ly9naXRodWIuY29tL3lha3lhay95YWt5YWtcIlxuICAgICAgICAgICAgYSBocmVmOiBocmVmXG4gICAgICAgICAgICAsIG9uY2xpY2s6IChldikgLT5cbiAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICAgICAgYWRkcmVzcyA9IGV2LmN1cnJlbnRUYXJnZXQuZ2V0QXR0cmlidXRlICdocmVmJ1xuICAgICAgICAgICAgICAgIHJlcXVpcmUoJ2VsZWN0cm9uJykuc2hlbGwub3BlbkV4dGVybmFsIGFkZHJlc3NcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgLCBocmVmXG5cbiMkKCdkb2N1bWVudCcpLm9uICdjbGljaycsICcubGluay1vdXQnLCAoZXYpLT5cbiNcbiJdfQ==
