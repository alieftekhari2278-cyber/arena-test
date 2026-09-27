/* منطق مشترک فروشگاه: سبد خرید، قالب‌بندی، هدر و فوتر */
(function () {
  'use strict';

  var CART_KEY = 'zamana_cart_v1';

  /* ---------- ابزارها ---------- */
  function toFa(n) {
    return Number(n).toLocaleString('fa-IR');
  }
  function price(n) {
    return toFa(n) + ' تومان';
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  /* ---------- سبد خرید ---------- */
  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
  function addToCart(id, qty) {
    qty = qty || 1;
    var items = readCart();
    var row = items.filter(function (i) { return i.id === id; })[0];
    if (row) { row.qty += qty; } else { items.push({ id: id, qty: qty }); }
    writeCart(items);
    toast('محصول به سبد خرید اضافه شد');
  }
  function setQty(id, qty) {
    var items = readCart().map(function (i) {
      if (i.id === id) i.qty = Math.max(1, Math.min(20, qty));
      return i;
    });
    writeCart(items);
  }
  function removeFromCart(id) {
    writeCart(readCart().filter(function (i) { return i.id !== id; }));
  }
  function clearCart() { writeCart([]); }

  function cartDetailed() {
    var map = {};
    (window.PRODUCTS || []).forEach(function (p) { map[p.id] = p; });
    return readCart()
      .filter(function (i) { return map[i.id]; })
      .map(function (i) {
        var p = map[i.id];
        return { product: p, qty: i.qty, total: p.price * i.qty };
      });
  }
  function cartCount() {
    return readCart().reduce(function (s, i) { return s + i.qty; }, 0);
  }
  function cartSubtotal() {
    return cartDetailed().reduce(function (s, r) { return s + r.total; }, 0);
  }
  function shippingCost(sub) {
    if (sub === 0) return 0;
    return sub >= 30000000 ? 0 : 450000;
  }

  function updateCartBadge() {
    var c = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (n) {
      n.textContent = toFa(c);
      n.classList.toggle('is-empty', c === 0);
    });
  }

  /* ---------- اعلان ---------- */
  var toastTimer;
  function toast(msg) {
    var box = document.querySelector('.toast');
    if (!box) {
      box = el('<div class="toast" role="status" aria-live="polite"></div>');
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, 2400);
  }

  /* ---------- هدر و فوتر مشترک ---------- */
  var NAV = [
    { href: 'index.html', label: 'خانه' },
    { href: 'shop.html', label: 'فروشگاه' },
    { href: 'shop.html?cat=men', label: 'مردانه' },
    { href: 'shop.html?cat=women', label: 'زنانه' },
    { href: 'shop.html?cat=smart', label: 'هوشمند' },
    { href: 'about.html', label: 'درباره ما' }
  ];

  function renderChrome() {
    var page = location.pathname.split('/').pop() || 'index.html';
    var header = document.querySelector('[data-site-header]');
    if (header) {
      header.innerHTML =
        '<div class="topbar"><div class="container topbar__in">' +
        '<span>ارسال رایگان برای خریدهای بالای ۳۰ میلیون تومان</span>' +
        '<span class="topbar__sep"></span>' +
        '<span>۷ روز ضمانت بازگشت کالا</span>' +
        '<span class="topbar__sep"></span>' +
        '<span>پشتیبانی: ۰۲۱-۹۱۰۰۰۰۰۰</span>' +
        '</div></div>' +
        '<div class="nav"><div class="container nav__in">' +
        '<a class="logo" href="index.html"><span class="logo__mark">Z</span><span class="logo__txt">زمانا<small>ساعت‌های اصل</small></span></a>' +
        '<nav class="nav__links" aria-label="منوی اصلی">' +
        NAV.map(function (n) {
          var active = n.href === page ? ' class="is-active"' : '';
          return '<a href="' + n.href + '"' + active + '>' + n.label + '</a>';
        }).join('') +
        '</nav>' +
        '<div class="nav__actions">' +
        '<form class="search" action="shop.html" role="search"><input type="search" name="q" placeholder="جستجوی ساعت..." aria-label="جستجو"><button type="submit" aria-label="جستجو">⌕</button></form>' +
        '<a class="icon-btn" href="cart.html" aria-label="سبد خرید">🛒<span class="badge" data-cart-count>۰</span></a>' +
        '<button class="icon-btn nav__burger" type="button" aria-label="منو">☰</button>' +
        '</div>' +
        '</div></div>';

      var burger = header.querySelector('.nav__burger');
      var links = header.querySelector('.nav__links');
      burger.addEventListener('click', function () { links.classList.toggle('open'); });
    }

    var footer = document.querySelector('[data-site-footer]');
    if (footer) {
      footer.innerHTML =
        '<div class="container footer__grid">' +
        '<div><a class="logo logo--light" href="index.html"><span class="logo__mark">Z</span><span class="logo__txt">زمانا<small>ساعت‌های اصل</small></span></a>' +
        '<p class="footer__about">زمانا از سال ۱۳۹۲ نماینده رسمی برندهای معتبر ساعت است. تمام محصولات با گارانتی اصالت و خدمات پس از فروش تخصصی عرضه می‌شوند.</p></div>' +
        '<div><h4>دسترسی سریع</h4><ul><li><a href="shop.html">همه محصولات</a></li><li><a href="shop.html?cat=luxury">مجموعه لاکچری</a></li><li><a href="about.html">درباره ما</a></li><li><a href="cart.html">سبد خرید</a></li></ul></div>' +
        '<div><h4>خدمات مشتریان</h4><ul><li><a href="about.html#faq">پرسش‌های متداول</a></li><li><a href="about.html#warranty">گارانتی و اصالت</a></li><li><a href="about.html#shipping">ارسال و مرجوعی</a></li><li><a href="about.html#contact">تماس با ما</a></li></ul></div>' +
        '<div><h4>خبرنامه</h4><p class="footer__about">از تخفیف‌ها و کالکشن‌های جدید باخبر شوید.</p>' +
        '<form class="newsletter" data-newsletter><input type="email" required placeholder="ایمیل شما"><button type="submit">عضویت</button></form></div>' +
        '</div>' +
        '<div class="container footer__bottom"><span>© ۱۴۰۴ فروشگاه زمانا — تمامی حقوق محفوظ است.</span>' +
        '<span class="pay">پرداخت امن: شتاب · سامان · ملت</span></div>';

      var nl = footer.querySelector('[data-newsletter]');
      nl.addEventListener('submit', function (e) {
        e.preventDefault();
        nl.reset();
        toast('عضویت شما در خبرنامه ثبت شد');
      });
    }
    updateCartBadge();
  }

  /* ---------- کارت محصول ---------- */
  function stars(rating) {
    var full = Math.round(rating);
    return '<span class="stars" title="' + toFa(rating) + ' از ۵">' +
      '★★★★★'.slice(0, full) + '<span class="stars__off">' + '★★★★★'.slice(0, 5 - full) + '</span></span>';
  }

  function productCard(p) {
    var off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return '' +
      '<article class="card" data-id="' + p.id + '">' +
      '<a class="card__media" href="product.html?id=' + p.id + '">' +
      '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy">' +
      (p.badge ? '<span class="chip chip--badge">' + p.badge + '</span>' : '') +
      (off ? '<span class="chip chip--off">٪' + toFa(off) + '−</span>' : '') +
      '</a>' +
      '<div class="card__body">' +
      '<span class="card__brand">' + p.brand + '</span>' +
      '<h3 class="card__title"><a href="product.html?id=' + p.id + '">' + p.name + '</a></h3>' +
      '<div class="card__rate">' + stars(p.rating) + '<small>(' + toFa(p.reviews) + ' نظر)</small></div>' +
      '<div class="card__price">' +
      (p.oldPrice ? '<del>' + toFa(p.oldPrice) + '</del>' : '') +
      '<strong>' + price(p.price) + '</strong></div>' +
      '<button class="btn btn--primary btn--block" data-add="' + p.id + '">افزودن به سبد</button>' +
      '</div></article>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b) { addToCart(b.getAttribute('data-add'), 1); }
  });

  window.Store = {
    toFa: toFa, price: price, qs: qs, el: el, stars: stars,
    productCard: productCard, toast: toast,
    addToCart: addToCart, setQty: setQty, removeFromCart: removeFromCart,
    clearCart: clearCart, cartDetailed: cartDetailed, cartCount: cartCount,
    cartSubtotal: cartSubtotal, shippingCost: shippingCost,
    updateCartBadge: updateCartBadge
  };

  document.addEventListener('DOMContentLoaded', renderChrome);
})();
