// Admin notification bell. Checks the server every few seconds (no page refresh needed) and lets the
// administrator mark notifications as read. All data comes from /admin/api/..., which only administrators can open.
(function () {
    var root = document.querySelector('[data-notifications]');
    if (!root) return;

    var POLL_MS = 10000;
    var csrf = root.getAttribute('data-csrf');
    var button = root.querySelector('.notif-button');
    var panel = root.querySelector('.notif-panel');
    var badge = root.querySelector('[data-notif-count]');
    var list = root.querySelector('[data-notif-list]');
    var markAll = root.querySelector('[data-notif-readall]');
    var announce = root.querySelector('[data-notif-announce]');
    var lastUnread = parseInt(badge.textContent, 10) || 0;
    var timer = null;

    var timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

    function send(method, url) {
        var options = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
        if (method === 'POST') {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.body = '_csrf=' + encodeURIComponent(csrf);
        }
        return fetch(url, options).then(function (response) {
            if (response.status === 401 || response.status === 403) { window.location.href = '/admin/login'; throw new Error('not allowed'); }
            if (!response.ok) throw new Error('request failed');
            return response.json();
        });
    }

    function render(data) {
        var unread = data.unread;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.hidden = unread === 0;
        button.setAttribute('aria-label', 'Notifications, ' + unread + ' unread');
        markAll.disabled = unread === 0;
        if (unread > lastUnread) announce.textContent = 'New notification. ' + unread + ' unread.';
        lastUnread = unread;

        list.textContent = '';
        if (data.notifications.length === 0) {
            var empty = document.createElement('li');
            empty.className = 'notif-empty';
            empty.textContent = 'No notifications yet.';
            list.appendChild(empty);
            return;
        }
        data.notifications.forEach(function (n) {
            var item = document.createElement('li');
            item.className = 'notif-item' + (n.isRead ? '' : ' unread');

            var text = document.createElement('div');
            text.className = 'notif-text';
            var message = document.createElement('span');
            message.textContent = n.message;
            var when = document.createElement('small');
            when.textContent = timeFormat.format(new Date(n.createdAt)) + ' (CAT)' + (n.page ? ' · ' + n.page : '');
            text.appendChild(message);
            text.appendChild(when);
            item.appendChild(text);

            if (!n.isRead) {
                var read = document.createElement('button');
                read.type = 'button';
                read.className = 'notif-read';
                read.textContent = 'Mark read';
                read.setAttribute('aria-label', 'Mark as read: ' + n.message);
                read.addEventListener('click', function () {
                    send('POST', '/admin/api/notifications/' + n.id + '/read').then(render).catch(function () {});
                });
                item.appendChild(read);
            }
            list.appendChild(item);
        });
    }

    function refresh() {
        return send('GET', '/admin/api/notifications').then(render).catch(function () {});
    }

    function startPolling() {
        stopPolling();
        timer = setInterval(refresh, POLL_MS);
    }
    function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

    function setOpen(open) {
        panel.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) refresh();
    }

    button.addEventListener('click', function () { setOpen(panel.hidden); });
    markAll.addEventListener('click', function () {
        send('POST', '/admin/api/notifications/read-all').then(render).catch(function () {});
    });
    document.addEventListener('click', function (event) { if (!root.contains(event.target)) setOpen(false); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !panel.hidden) { setOpen(false); button.focus(); }
    });

    // Do not ask the server while the tab is in the background; catch up as soon as it is visible again.
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopPolling();
        else { refresh(); startPolling(); }
    });

    refresh();
    if (!document.hidden) startPolling();
})();
