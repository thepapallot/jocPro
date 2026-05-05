(function () {
    if (window.self !== window.top) {
        return;
    }

    const current = new URL(window.location.href);
    if (current.pathname === "/") {
        return;
    }

    const shellUrl = new URL("/", window.location.origin);
    shellUrl.searchParams.set("shell_target", `${current.pathname}${current.search}${current.hash}`);
    window.location.replace(shellUrl.toString());
})();
