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
