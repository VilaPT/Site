(function () {
  var startedAt = Date.now();
  var finished = false;
  document.documentElement.classList.add('cop-booting');
  function finish() {
    if (finished) return;
    finished = true;
    document.documentElement.classList.remove('cop-booting');
  }
  // Installed before dependencies load: a failed/slow request cannot trap the user.
  setTimeout(finish, 12000);
  window.addEventListener('load', function () {
    setTimeout(finish, Math.max(0, 650 - (Date.now() - startedAt)));
  }, { once: true });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) finish();
  });
})();
