/**
 * ماشین‌حساب درآمد واقعی فریلنسر ایرانی
 * همه محاسبات سمت مرورگر انجام می‌شود؛ هیچ داده‌ای ارسال نمی‌شود.
 * اعداد مبنا (مهر ۱۴۰۵) در docs/README.md مستند شده‌اند.
 */

(function () {
  "use strict";

  var DEFAULTS = {
    mode: "hourly",
    rate: 25,
    hours: 60,
    price: 800,
    count: 2,
    projectHours: 35,
    platformFee: 0,
    cashoutFee: 8,
    tools: 60,
    usdRate: 235800,
    targetToman: 300000000,
  };

  // میلیون تومان در ماه — مبنای مقایسه، از docs/market-prices.md
  var LOCAL_MID = 42;
  var LOCAL_SENIOR = 110;

  var el = function (id) {
    return document.getElementById(id);
  };

  var faNumber = function (value, digits) {
    return new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: digits === undefined ? 0 : digits,
    }).format(value);
  };

  var usd = function (value) {
    return "$" + faNumber(Math.round(value));
  };

  var toman = function (value) {
    return faNumber(Math.round(value)) + " تومان";
  };

  var million = function (value) {
    return faNumber(value / 1e6, 1) + " میلیون تومان";
  };

  var num = function (id) {
    var v = parseFloat(el(id).value);
    return isNaN(v) || v < 0 ? 0 : v;
  };

  function currentMode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : "hourly";
  }

  function compute() {
    var mode = currentMode();
    var hours;
    var gross;

    if (mode === "hourly") {
      hours = num("hours");
      gross = num("rate") * hours;
    } else {
      var count = num("count");
      hours = num("projectHours") * count;
      gross = num("price") * count;
    }

    var feeRate = Math.min(num("platformFee"), 100) / 100;
    var cashRate = Math.min(num("cashoutFee"), 100) / 100;
    var toolsCost = num("tools");
    var usdRate = num("usdRate");

    var feeAmount = gross * feeRate;
    var afterFee = gross - feeAmount;
    var cashoutAmount = afterFee * cashRate;
    var netUsd = afterFee - cashoutAmount - toolsCost;
    var netTomanValue = netUsd * usdRate;
    var leak = gross > 0 ? (gross - netUsd) / gross : 0;

    return {
      mode: mode,
      hours: hours,
      gross: gross,
      feeAmount: feeAmount,
      cashoutAmount: cashoutAmount,
      toolsCost: toolsCost,
      netUsd: netUsd,
      netToman: netTomanValue,
      leak: leak,
      usdRate: usdRate,
      effectiveRate: hours > 0 ? netUsd / hours : 0,
      netFactor: (1 - feeRate) * (1 - cashRate),
    };
  }

  function renderBenchmark(netTomanValue) {
    var millions = netTomanValue / 1e6;
    if (millions <= 0) {
      return "با این ورودی‌ها درآمد خالصی باقی نمی‌ماند؛ کارمزدها و هزینه ابزارها از درآمد بیشتر است.";
    }
    var vsMid = millions / LOCAL_MID;
    var vsSenior = millions / LOCAL_SENIOR;
    return (
      "این مبلغ حدود " +
      faNumber(vsMid, 1) +
      " برابر میانگین حقوق یک توسعه‌دهنده میان‌رده و " +
      faNumber(vsSenior, 1) +
      " برابر کف حقوق یک سینیور در بازار داخلی است."
    );
  }

  function renderReverse(result) {
    var target = num("targetToman");
    if (target <= 0 || result.usdRate <= 0) {
      return "—";
    }
    var neededNetUsd = target / result.usdRate;
    var neededGross =
      result.netFactor > 0
        ? (neededNetUsd + result.toolsCost) / result.netFactor
        : 0;

    if (neededGross <= 0) {
      return "با این کارمزدها رسیدن به مبلغ هدف ممکن نیست.";
    }

    var line =
      "برای " +
      million(target) +
      " خالص، باید ماهانه حدود " +
      usd(neededGross) +
      " فاکتور کنید.";

    if (result.mode === "hourly") {
      var h = num("hours");
      if (h > 0) {
        line +=
          " با " + faNumber(h) + " ساعت کار در ماه، یعنی نرخ ساعتی " +
          usd(neededGross / h) + ".";
      }
    } else {
      var c = num("count");
      if (c > 0) {
        line +=
          " با " + faNumber(c) + " پروژه در ماه، یعنی هر پروژه " +
          usd(neededGross / c) + ".";
      }
    }
    return line;
  }

  function render() {
    var r = compute();

    el("netToman").textContent = toman(r.netToman);
    el("netUsd").textContent = "معادل " + usd(r.netUsd) + " در ماه، خالص";

    el("gross").textContent = usd(r.gross);
    el("feeAmount").textContent = "−" + usd(r.feeAmount);
    el("cashoutAmount").textContent = "−" + usd(r.cashoutAmount);
    el("toolsAmount").textContent = "−" + usd(r.toolsCost);
    el("netUsdRow").textContent = usd(r.netUsd);
    el("effective").textContent =
      r.hours > 0 ? usd(r.effectiveRate) + " در ساعت" : "—";
    el("leak").textContent =
      faNumber(r.leak * 100, 1) + "٪ از درآمد ناخالص (" + usd(r.gross - r.netUsd) + ")";

    el("benchmark").textContent = renderBenchmark(r.netToman);
    el("reverseResult").textContent = renderReverse(r);
  }

  function syncMode() {
    var mode = currentMode();
    el("hourly-fields").hidden = mode !== "hourly";
    el("project-fields").hidden = mode !== "project";
    render();
  }

  function resetAll() {
    Object.keys(DEFAULTS).forEach(function (key) {
      if (key === "mode") {
        document.querySelector('input[name="mode"][value="hourly"]').checked = true;
        return;
      }
      var input = el(key);
      if (input) {
        input.value = DEFAULTS[key];
      }
    });
    syncMode();
  }

  document.addEventListener("input", function (event) {
    if (event.target.matches('input[type="number"]')) {
      render();
    }
  });

  Array.prototype.forEach.call(
    document.querySelectorAll('input[name="mode"]'),
    function (input) {
      input.addEventListener("change", syncMode);
    }
  );

  Array.prototype.forEach.call(
    document.querySelectorAll(".chip"),
    function (chip) {
      chip.addEventListener("click", function () {
        el("platformFee").value = chip.dataset.fee;
        render();
      });
    }
  );

  el("reset").addEventListener("click", resetAll);

  syncMode();
})();
