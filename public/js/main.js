// Small helpers for the interface. The site's real logic runs on the server.

// Mobile menu button
var toggle = document.querySelector('.menu-toggle');
var nav = document.getElementById('main-nav');
if (toggle && nav) {
    toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
}

// Ask "Are you sure?" before dangerous actions (forms with data-confirm="...")
document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
        if (!window.confirm(form.getAttribute('data-confirm'))) event.preventDefault();
    });
});

// Close button on notification messages
document.querySelectorAll('.flash-close').forEach(function (button) {
    button.addEventListener('click', function () {
        button.parentElement.remove();
    });
});

// Live picture preview in the admin product form
document.querySelectorAll('select[data-preview]').forEach(function (select) {
    var image = document.getElementById(select.getAttribute('data-preview'));
    select.addEventListener('change', function () {
        if (select.value) { image.src = '/images/' + select.value; image.hidden = false; }
        else { image.hidden = true; }
    });
});

// After a failed form submit, take the user to the list of problems (the server decides what is wrong).
var errorSummary = document.querySelector('[data-error-summary]');
if (errorSummary) {
    errorSummary.focus();
    errorSummary.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function (event) {
            var target = document.getElementById(link.getAttribute('href').slice(1));
            if (!target) return;
            event.preventDefault();
            target.focus();
        });
    });
}

// Add to Cart without leaving the page. This sends the same form to the same address the browser would use,
// so the server does exactly the same checks. Without JavaScript the form simply works the old way.
var toastHost = document.querySelector('[data-toast-host]');

function showToast(type, text) {
    if (!toastHost) return;
    toastHost.textContent = '';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    var message = document.createElement('span');
    message.textContent = text;
    toast.appendChild(message);
    if (type === 'success') {
        var link = document.createElement('a');
        link.href = '/cart';
        link.className = 'toast-link';
        link.textContent = 'View cart';
        toast.appendChild(link);
    }
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss message');
    close.textContent = '\u00d7';
    close.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(close);
    toastHost.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 6000);
}

function updateCartCount(count) {
    document.querySelectorAll('.cart-badge').forEach(function (badge) {
        if (badge.textContent === count) return;
        badge.textContent = count;
        badge.classList.remove('bump');
        void badge.offsetWidth; // restart the animation
        badge.classList.add('bump');
    });
}

document.querySelectorAll('form[action="/cart/add"]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
        if (!window.fetch || !window.DOMParser || !toastHost) return; // old browser: normal form submit
        event.preventDefault();
        var button = form.querySelector('button[type="submit"]');
        if (button.disabled) return;
        var body = new URLSearchParams(new FormData(form));
        button.disabled = true;
        button.classList.add('is-busy');
        fetch(form.action, { method: 'POST', body: body, credentials: 'same-origin' })
            .then(function (response) {
                if (!response.ok) throw new Error('Add to cart failed');
                return response.text();
            })
            .then(function (html) {
                // The server answers with the page it would have shown: read the new count and its message from there.
                var page = new DOMParser().parseFromString(html, 'text/html');
                var badge = page.querySelector('.cart-badge');
                var flash = page.querySelector('.flash');
                if (badge) updateCartCount(badge.textContent);
                var isError = flash && flash.classList.contains('flash-error');
                showToast(isError ? 'error' : 'success', flash ? flash.querySelector('span').textContent : 'Added to your cart.');
            })
            .catch(function () {
                showToast('error', 'That could not be added. Please refresh the page and try again.');
            })
            .finally(function () {
                button.disabled = false;
                button.classList.remove('is-busy');
            });
    });
});
