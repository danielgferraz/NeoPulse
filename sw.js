
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Escuta atualizações do Timer vindas do App
self.addEventListener('message', (event) => {
  const data = event.data;
  
  if (data.type === 'UPDATE_TIMER') {
    const { timeLeft, exerciseName, isActive } = data;
    
    // Se o timer parar ou não estiver ativo, removemos a notificação
    if (!isActive) {
      self.registration.getNotifications({ tag: 'workout-timer' }).then(notifications => {
        notifications.forEach(n => n.close());
      });
      return;
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    const isFinished = timeLeft === 0;
    const title = isFinished ? '🔥 DESCANSO FINALIZADO!' : `Descanso: ${timeStr}`;
    
    const options = {
      body: isFinished ? `Hora de voltar para: ${exerciseName}` : `Próxima série: ${exerciseName}`,
      icon: 'https://cdn-icons-png.flaticon.com/512/6556/6556219.png', // Ícone genérico de treino
      badge: 'https://cdn-icons-png.flaticon.com/512/6556/6556219.png',
      tag: 'workout-timer',
      renotify: isFinished, // Toca/Vibra novamente apenas quando chega a zero
      requireInteraction: !isFinished, // No Android, mantém a notificação até o usuário interagir
      silent: !isFinished, // Não bipa a cada segundo para não irritar
      vibrate: isFinished ? [500, 110, 500, 110, 450] : [],
      data: {
        url: self.location.origin
      }
    };

    // Só mostra se houver permissão (segurança extra)
    if (Notification.permission === 'granted') {
      self.registration.showNotification(title, options);
    }
  }
});
