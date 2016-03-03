var isPushEnabled = false;
var useNotifications = false;

var subBtn = document.querySelector('.subscribe');
var sendBtn;
var sendInput;

var controlsBlock = document.querySelector('.controls');

var nameForm = document.querySelector('#form');
var nameInput = document.querySelector('#name-input');
nameForm.onsubmit = function(e) { e.preventDefault(); };

Notification.requestPermission();
window.addEventListener('load', function() {
  subBtn.addEventListener('click', function() {
    if (isPushEnabled) {
      unsubscribe();
    } else {
      subscribe();
    }
  });

  // Check that service workers are supported, if so, progressively
  // enhance and add push messaging support, otherwise continue without it.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      if(reg.installing) {
        console.log('Service worker installing');
      } else if(reg.waiting) {
        console.log('Service worker installed');
      } else if(reg.active) {
        console.log('Service worker active');
      }

      initialiseState(reg);
    });
  } else {
    console.log('Service workers aren\'t supported in this browser.');
  }
});


// Once the service worker is registered set the initial state
function initialiseState(reg) {
  // Are Notifications supported in the service worker?
  if (!(reg.showNotification)) {
    console.log('Notifications aren\'t supported on service workers.');
    useNotifications = false;
  } else {
    useNotifications = true;
  }

  // Check the current Notification permission.
  // If its denied, it's a permanent block until the
  // user changes the permission
  if (Notification.permission === 'denied') {
    console.log('The user has blocked notifications.');
    return;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    console.log('Push messaging isn\'t supported.');
    return;
  }

  // We need the service worker registration to check for a subscription
  navigator.serviceWorker.ready.then(function(reg) {
    // Do we already have a push message subscription?
    reg.pushManager.getSubscription()
      .then(function(subscription) {
        // Enable any UI which subscribes / unsubscribes from
        // push messages.

        subBtn.disabled = false;

        if (!subscription) {
          console.log('Not yet subscribed to Push');
          // We aren't subscribed to push, so set UI
          // to allow the user to enable push
          return;
        }

        // Set your UI to show they have subscribed for
        // push messages
        subBtn.textContent = 'Unsubscribe from Push Messaging';
        isPushEnabled = true;

        // initialize status, which includes setting UI elements for subscribed status
        // and updating Subscribers list via push
        console.log(subscription.toJSON());
        var endpoint = subscription.endpoint;
        var key = subscription.getKey('p256dh');
        console.log(key);
        updateStatus(endpoint,key,'init');
      })
      .catch(function(err) {
        console.log('Error during getSubscription()', err);
      });
  });
}

function subscribe() {
  subBtn.disabled = true;
  navigator.serviceWorker.ready.then(function(reg) {
    reg.pushManager.subscribe({userVisibleOnly: true})
      .then(function(subscription) {
        // The subscription was successful
        isPushEnabled = true;
        subBtn.textContent = 'Unsubscribe from Push Messaging';
        subBtn.disabled = false;

        // Update status to subscribe current user on server, and to let
        // other users know this user has subscribed
        var endpoint = subscription.endpoint;
        var key = subscription.getKey('p256dh');
        updateStatus(endpoint,key,'subscribe');
      })
      .catch(function(e) {
        if (Notification.permission === 'denied') {
          // The user denied the notification permission which
          // means we failed to subscribe and the user will need
          // to manually change the notification permission to
          // subscribe to push messages
          console.log('Permission for Notifications was denied');

        } else {
          // A problem occurred with the subscription, this can
          // often be down to an issue or lack of the gcm_sender_id
          // and / or gcm_user_visible_only
          console.log('Unable to subscribe to push.', e);
          subBtn.disabled = false;
          subBtn.textContent = 'Subscribe to Push Messaging';
        }
      });
  });
}

function unsubscribe() {
  subBtn.disabled = true;

  navigator.serviceWorker.ready.then(function(reg) {
    // To unsubscribe from push messaging, you need get the
    // subcription object, which you can call unsubscribe() on.
    reg.pushManager.getSubscription().then(
      function(subscription) {

        // Update status to unsubscribe current user from server (remove details)
        // and let other subscribers know they have unsubscribed
        var endpoint = subscription.endpoint;
        var key = subscription.getKey('p256dh');


        // Check we have a subscription to unsubscribe
        if (!subscription) {
          // No subscription object, so set the state
          // to allow the user to subscribe to push
          isPushEnabled = false;
          subBtn.disabled = false;
          subBtn.textContent = 'Subscribe to Push Messaging';
          return;
        }

        isPushEnabled = false;
        updateStatus(endpoint,key,'unsubscribe').then(function() {
          // We have a subcription, so call unsubscribe on it
          subscription.unsubscribe().then(function(successful) {
            subBtn.disabled = false;
            subBtn.textContent = 'Subscribe to Push Messaging';
            isPushEnabled = false;
          }).catch(function(e) {
            // We failed to unsubscribe, this can lead to
            // an unusual state, so may be best to remove
            // the subscription id from your data store and
            // inform the user that you disabled push

            console.log('Unsubscription error: ', e);
            subBtn.disabled = false;
          });
        });
      }).catch(function(e) {
        console.log('Error thrown while unsubscribing from ' +
          'push messaging.', e);
      });
  });
}

function updateStatus(endpoint,key,statusType) {
  // If we are subscribing to push
  if(statusType === 'subscribe') {
    setChatUI();
  } else if(statusType === 'unsubscribe') {
    setSubscribeUI();
  } else if(statusType === 'init') {
    setChatUI();
  }

  return customFatch(statusType, nameInput.value, undefined, endpoint, key);

  function setSubscribeUI() {
    controlsBlock.removeChild(sendBtn);
    controlsBlock.removeChild(sendInput);
  }
  function setChatUI() {
    sendBtn = document.createElement('button');
    sendInput = document.createElement('input');
    sendBtn.textContent = 'Send Chat Message';
    sendInput.setAttribute('type','text');
    controlsBlock.appendChild(sendBtn);
    controlsBlock.appendChild(sendInput);
    sendBtn.onclick = function() {
      sendChatMessage(sendInput.value);
    };
  }
}

function sendChatMessage(chatMsg) {
  navigator.serviceWorker.ready.then(function(reg) {
    reg.pushManager.getSubscription().then(function(subscription) {
      var endpoint = subscription.endpoint;
      var key = subscription.getKey('p256dh');
      customFatch('chatMsg', nameInput.value, chatMsg, endpoint, key);
    });
  });
}

function customFatch(statusType, name, msg, endpoint, key) {
  return fetch('https://127.0.0.1:7000', {
    method: 'POST',
    head: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      statusType: statusType,
      name: name,
      msg: msg,
      endpoint: endpoint,
      key: btoa(String.fromCharCode.apply(null, new Uint8Array(key)))
    })
  });
}
