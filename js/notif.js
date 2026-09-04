// OneSignal — chargement + synchro robuste du player_id vers profils.onesignal_id
(function () {
  var APP_ID = '8c4f2a28-64eb-4417-85c9-20bda4365e45';
  var loaded = false;

  function loadSDK(afterInit) {
    if (loaded) {
      if (afterInit && window.OneSignalDeferred) window.OneSignalDeferred.push(afterInit);
      return;
    }
    loaded = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: APP_ID,
        notifyButton: { enable: true, size: 'small', position: 'bottom-left' },
        welcomeNotification: {
          title: 'BDE CREAD Lyon',
          message: 'Tu recevras les notifs des soirées, annonces et actus du BDE !'
        }
      });
      // Écoute les changements d'abonnement (grant permission, désabo, changement device)
      // et resync immédiatement le player_id vers profils.onesignal_id
      try {
        OneSignal.User.PushSubscription.addEventListener('change', function (event) {
          if (event && event.current && event.current.id && window.syncOneSignalId) {
            window.syncOneSignalId();
          }
        });
      } catch (_) {}
      // Sync immédiate au chargement (si déjà abonné)
      if (window.syncOneSignalId) window.syncOneSignalId();
      if (afterInit) afterInit(OneSignal);
    });
    var s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    s.defer = true;
    document.head.appendChild(s);
  }

  // Auto-charge si permission déjà donnée
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    loadSDK();
  }

  // Bouton "Activer 🔔" : charge SDK + demande permission (listener fait le reste)
  window.loadAndSubscribeOneSignal = function () {
    loadSDK(function (OS) { OS.Notifications.requestPermission(); });
  };
})();
