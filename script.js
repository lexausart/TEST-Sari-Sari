// script.js

// --- Hamburger menu (categories) ---
(() => {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;

    const btn = nav.querySelector(".hamburger");
    const panel = nav.querySelector(".navMenu__panel");
    if (!btn || !panel) return;

    const open = () => {
        nav.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("aria-label", "Close menu");
        const first = panel.querySelector("a");
        first && first.focus();
    };

    const close = () => {
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", "Open menu");
    };

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        nav.classList.contains("is-open") ? close() : open();
    });

    document.addEventListener("click", (e) => {
        if (!nav.classList.contains("is-open")) return;
        if (!nav.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && nav.classList.contains("is-open")) {
            close();
            btn.focus();
        }
    });
})();


// --- Store interactions (search, sort, filters, cart toast) ---
(() => {
    const grid = document.querySelector(".grid");
    if (!grid) return;

    const cardsAll = Array.from(grid.querySelectorAll(".card"));
    const featuredOrder = [...cardsAll];

    const sortSelect = document.getElementById("sort");
    const cartBadge = document.querySelector(".cart__count");
    const searchForm = document.querySelector("form.search");
    const searchInput = document.getElementById("q");
    const deptSelect = document.querySelector(".search__select");

    const countShownEl = document.getElementById("countShown");
    const queryLabelEl = document.getElementById("queryLabel");
    const noResultsEl = document.getElementById("noResults");

    const applyPriceBtn = document.getElementById("applyPrice");
    const clearFiltersBtn = document.getElementById("clearFilters");
    const minPriceEl = document.getElementById("minPrice");
    const maxPriceEl = document.getElementById("maxPrice");

    // Toast styles
    const style = document.createElement("style");
    style.textContent = `
      .toast{
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translate(-50%, 12px);
        opacity: 0;
        pointer-events: none;
        background: rgba(17,24,39,.92);
        color: #fff;
        padding: 10px 12px;
        border-radius: 999px;
        box-shadow: 0 10px 28px rgba(0,0,0,.22);
        font: 800 13px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        z-index: 9999;
        max-width: calc(100vw - 24px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: opacity .18s ease, transform .18s ease;
      }
      .toast--show{ opacity: 1; transform: translate(-50%, 0); }
    `;
    document.head.appendChild(style);

    const norm = (s) => (s ?? "").toString().toLowerCase().replace(/\s+/g, " ").trim();

    function toast(message) {
        const el = document.createElement("div");
        el.className = "toast";
        el.textContent = message;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add("toast--show"));
        setTimeout(() => {
            el.classList.remove("toast--show");
            setTimeout(() => el.remove(), 200);
        }, 1400);
    }

    // Cart
    let cartCount = Number(cartBadge?.textContent || 0);
    function setCartCount(n) {
        cartCount = n;
        if (cartBadge) cartBadge.textContent = String(cartCount);
    }

    grid.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn--add");
        if (!btn) return;

        const card = btn.closest(".card");
        const title = card?.querySelector(".card__title")?.textContent?.trim() || "Item";
        setCartCount(cartCount + 1);
        toast(`Added: ${title}`);
    });

    // Sorting helpers
    const numAttr = (card, name, fallback = 0) => {
        const n = Number(card.getAttribute(name));
        return Number.isFinite(n) ? n : fallback;
    };

    const dateAttr = (card, name, fallback = "1970-01-01") => {
        const t = Date.parse(card.getAttribute(name) || fallback);
        return Number.isFinite(t) ? t : Date.parse(fallback);
    };

    const chaosScore = (card) => {
        const rating = numAttr(card, "data-rating", 0);
        const reviews = numAttr(card, "data-reviews", 0);
        return rating * 1_000_000 + reviews;
    };

    function applySort(mode) {
        const visible = cardsAll.filter((c) => !c.classList.contains("is-hidden"));
        const hidden = cardsAll.filter((c) => c.classList.contains("is-hidden"));

        let ordered;
        if (mode === "featured") {
            ordered = featuredOrder.filter((c) => !c.classList.contains("is-hidden"));
        } else {
            ordered = [...visible].sort((a, b) => {
                if (mode === "priceAsc") return numAttr(a, "data-price") - numAttr(b, "data-price");
                if (mode === "priceDesc") return numAttr(b, "data-price") - numAttr(a, "data-price");
                if (mode === "ratingDesc") return chaosScore(b) - chaosScore(a);
                if (mode === "newest") return dateAttr(b, "data-date") - dateAttr(a, "data-date");
                return 0;
            });
        }

        const frag = document.createDocumentFragment();
        ordered.forEach((c) => frag.appendChild(c));
        hidden.forEach((c) => frag.appendChild(c));
        grid.appendChild(frag);
    }

    if (sortSelect) sortSelect.addEventListener("change", () => applySort(sortSelect.value));

    // Filters + Search state
    const state = {
        q: "",
        deptDropdown: "all",
        deptChecks: new Set(),
        flags: new Set(),
        ratingMin: 0,
        minPrice: null,
        maxPrice: null,
    };

    function cardText(card) {
        const title = card.querySelector(".card__title")?.textContent || "";
        const meta = card.querySelector(".card__meta")?.textContent || "";
        const note = card.querySelector(".card__note")?.textContent || "";
        const tags = card.getAttribute("data-tags") || "";
        return norm(`${title} ${meta} ${note} ${tags}`);
    }

    function deptKeyFromDropdown(raw) {
        const d = norm(raw);
        if (d === "all") return "all";
        if (d.includes("snack")) return "snacks";
        if (d.includes("drink")) return "drinks";
        if (d.includes("house")) return "household";
        if (d.includes("gacha")) return "trinkets";
        if (d.includes("not cursed")) return "notcursed";
        return d;
    }

    function applyAllFilters() {
        const q = state.q;
        const deptDrop = state.deptDropdown;
        const deptChecks = state.deptChecks;
        const flags = state.flags;
        const ratingMin = state.ratingMin;
        const minP = state.minPrice;
        const maxP = state.maxPrice;

        let shown = 0;

        for (const card of cardsAll) {
            const dept = norm(card.getAttribute("data-dept") || "");
            const cardFlags = new Set(norm(card.getAttribute("data-flags") || "").split(" ").filter(Boolean));
            const price = numAttr(card, "data-price", 0);
            const rating = numAttr(card, "data-rating", 0);

            const matchesText = !q || cardText(card).includes(q);
            const matchesDeptDrop = deptDrop === "all" || dept === deptDrop;
            const matchesDeptChecks = deptChecks.size === 0 || deptChecks.has(dept);

            let matchesFlags = true;
            for (const f of flags) {
                if (!cardFlags.has(f)) { matchesFlags = false; break; }
            }

            const matchesRating = rating >= ratingMin;
            const matchesMin = minP == null || price >= minP;
            const matchesMax = maxP == null || price <= maxP;

            const show =
                matchesText &&
                matchesDeptDrop &&
                matchesDeptChecks &&
                matchesFlags &&
                matchesRating &&
                matchesMin &&
                matchesMax;

            card.classList.toggle("is-hidden", !show);
            if (show) shown++;
        }

        if (countShownEl) countShownEl.textContent = String(shown);
        if (queryLabelEl) queryLabelEl.textContent = `“${(state.q || "").trim()}”`;
        if (noResultsEl) noResultsEl.hidden = shown !== 0;

        applySort(sortSelect?.value || "featured");
    }

    // Search submit + live typing debounce
    let t = null;
    function debounceApply() {
        clearTimeout(t);
        t = setTimeout(applyAllFilters, 120);
    }

    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            state.q = norm(searchInput?.value || "");
            applyAllFilters();
            if ((searchInput?.value || "").trim()) toast(`Searching: ${(searchInput.value || "").trim()}`);
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.q = norm(searchInput.value);
            debounceApply();
        });
    }

    if (deptSelect) {
        deptSelect.addEventListener("change", () => {
            state.deptDropdown = deptKeyFromDropdown(deptSelect.value);
            applyAllFilters();
        });
    }

    // Filter inputs (checkboxes + radios)
    document.addEventListener("change", (e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement)) return;

        const kind = el.getAttribute("data-filter");
        if (!kind) return;

        if (kind === "dept") {
            if (el.checked) state.deptChecks.add(norm(el.value));
            else state.deptChecks.delete(norm(el.value));
            applyAllFilters();
            return;
        }

        if (kind === "flag") {
            if (el.checked) state.flags.add(norm(el.value));
            else state.flags.delete(norm(el.value));
            applyAllFilters();
            return;
        }

        if (kind === "ratingMin") {
            state.ratingMin = Number(el.value) || 0;
            applyAllFilters();
            return;
        }
    });

    function parseMoney(input) {
        const s = (input || "").toString().replace(/[^\d]/g, "");
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    if (applyPriceBtn) {
        applyPriceBtn.addEventListener("click", () => {
            state.minPrice = parseMoney(minPriceEl?.value);
            state.maxPrice = parseMoney(maxPriceEl?.value);
            applyAllFilters();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", () => {
            state.deptChecks.clear();
            state.flags.clear();
            state.ratingMin = 0;
            state.minPrice = null;
            state.maxPrice = null;

            document
                .querySelectorAll('input[data-filter="dept"], input[data-filter="flag"]')
                .forEach((i) => (i.checked = false));

            const anyRadio = document.querySelector('input[data-filter="ratingMin"][value="0"]');
            if (anyRadio) anyRadio.checked = true;

            if (minPriceEl) minPriceEl.value = "";
            if (maxPriceEl) maxPriceEl.value = "";

            applyAllFilters();
            toast("Filters cleared.");
        });
    }

    // Initial
    state.q = norm(searchInput?.value || "");
    state.deptDropdown = deptKeyFromDropdown(deptSelect?.value || "All");
    applyAllFilters();
})();

// --- Random RP Hook Generator ---
(() => {
    const btn = document.getElementById("randomHookBtn");
    const box = document.getElementById("randomHookBox");
    const text = document.getElementById("randomHookText");
    if (!btn || !box || !text) return;

    const hooks = [
        "You receive the wrong order. It contains something humming softly.",
        "Tang insists you pay with a story instead of gil.",
        "A trinket glows when you walk past the counter.",
        "Euclid needs help testing something that absolutely will not explode.",
        "One of the twins claims you promised them candy.",
        "Sunny hands you a drink and says, 'This one chooses people.'",
        "Tito Whiskey is already mid-sentence when you walk in.",
        "A note pinned to the wall has your name on it.",
        "The shop lights flicker when you enter.",
        "You overhear your own name in a whispered argument.",
        "A delivery crate arrives addressed to you.",
        "Tang greets you like she’s been expecting you.",
        "Someone storms out of the shop just as you arrive.",
        "The twins are running a 'totally legal' side business.",
        "A shelf collapses at the exact moment you look at it."
    ];

    btn.addEventListener("click", () => {
        const random = hooks[Math.floor(Math.random() * hooks.length)];
        text.textContent = random;
        box.hidden = false;

        // Re-trigger animation
        box.style.animation = "none";
        box.offsetHeight; // force reflow
        box.style.animation = "";
    });
})();
