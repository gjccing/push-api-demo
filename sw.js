
self.addEventListener('push', function(event) {
  var obj = event.data.json();
  fireNotification(obj, event);
});

function fireNotification(obj, event) {
  var title = obj.name;
  var body = obj.msg || (obj.name + ' has ' + obj.action + 'd.');
  var icon = 'push-icon.png';
  var tag = obj.action+'-'+obj.name;
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: icon,
    tag: tag
  }));
}
