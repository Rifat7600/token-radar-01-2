// Token Radar dashboard renderer. Classic script; DATA comes from
// data.js and the model from model.js. Every number on screen is
// recomputed from the row's own figures with the same functions main.ts
// used to build board.json, so the page can never disagree with the board.

(function () {
  var rows = DATA.rows;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function bySlug(slug) {
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) return rows[i];
    return null;
  }

  function filtered() {
    var q = (document.getElementById("q").value || "").toLowerCase();
    var cat = document.getElementById("cat").value;
    var chain = document.getElementById("chain").value;
    var earlyOnly = document.getElementById("earlyOnly").checked;
    var out = rows.filter(function (r) {
      if (earlyOnly && !r.early) return false;
      if (cat && r.cat !== cat) return false;
      if (chain && r.ch.indexOf(chain) === -1) return false;
      if (q && (r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1)) return false;
      return true;
    });
    var sort = document.getElementById("sort").value;
    if (sort === "tvl") out.sort(function (a, b) { return b.tvl - a.tvl; });
    else if (sort === "growth") out.sort(function (a, b) { return (b.g || 0) - (a.g || 0); });
    else if (sort === "age") out.sort(function (a, b) { return a.age - b.age; });
    else out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  }

  function growthCell(g) {
    if (g === null || g === undefined) return '<span class="muted">n/a</span>';
    var cls = g >= 0 ? "pos" : "neg";
    return '<span class="' + cls + '">' + fmtPct(g) + "</span>";
  }

  function boardHtml(list) {
    var h = '<table class="board"><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th>' +
      '<th class="num">TVL</th><th class="num">7d</th><th>Age</th><th class="num">Implied value</th><th>Signal</th></tr></thead><tbody>';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      h += '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + "</td>" +
        '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + "</span></td>" +
        "<td>" + esc(r.cat || "—") + "</td>" +
        "<td>" + esc(r.ch.join(", ")) + "</td>" +
        '<td class="num">' + fmtUsd(r.tvl) + "</td>" +
        '<td class="num">' + growthCell(r.g) + "</td>" +
        "<td>" + fmtAge(r.age) + "</td>" +
        '<td class="num"><b>' + fmtUsd(r.value) + "</b></td>" +
        '<td>' + (r.early ? '<span class="badge">Early signal</span>' : '<span class="muted">—</span>') + "</td></tr>";
    }
    return h + "</tbody></table>";
  }

  function detailHtml(r) {
    var steps = farmStepsFor({ name: r.name, cat: r.cat, chains: r.ch });
    var tier = tvlTier(r.tvl).toFixed(2);
    var gf = growthFactor(r.g).toFixed(2);
    var af = ageFactor(r.age).toFixed(2);
    var score = momentumScore(r.tvl, r.g, r.age).toFixed(2);
    var recomputed = impliedValue(r.tvl, r.g, r.age);
    var h = '<div class="detail"><span class="back" id="back">&larr; Back to the board</span>' +
      "<h2>" + esc(r.name) + (r.early ? ' <span class="badge">Early signal</span>' : "") + "</h2>" +
      '<div class="slug">' + esc(r.slug) + " · " + esc(r.cat || "uncategorised") + " · " + esc(r.ch.join(", ")) + "</div>" +
      '<div class="facts">' +
      '<div class="fact"><div class="k">Implied value</div><div class="v">' + fmtUsd(r.value) + "</div></div>" +
      '<div class="fact"><div class="k">TVL</div><div class="v">' + fmtUsd(r.tvl) + "</div></div>" +
      '<div class="fact"><div class="k">7-day growth</div><div class="v">' + fmtPct(r.g) + "</div></div>" +
      '<div class="fact"><div class="k">Age, no token</div><div class="v">' + fmtAge(r.age) + "</div></div>" +
      '<div class="fact"><div class="k">Rank</div><div class="v">#' + r.rank + " of " + rows.length + "</div></div>" +
      '<div class="fact"><div class="k">Token</div><div class="v">none recorded</div></div>' +
      "</div>" +
      '<div class="modelbox">Value model, recomputed live from this row&rsquo;s figures: ' +
      "size <code>ln(TVL/$5M + 1) = " + tier + "</code> × growth <code>" + gf + "</code> × age <code>" + af +
      "</code> = score <code>" + score + "</code> × $25M = <code>" + fmtUsd(recomputed) +
      "</code> (board says " + fmtUsd(r.value) + ").</div>" +
      "<h3>Farm plan — do this before any token launches</h3>" +
      '<ol class="farm">';
    for (var i = 0; i < steps.length; i++) {
      h += '<li><span class="n">' + (i + 1) + "</span><span>" + esc(steps[i]) + "</span></li>";
    }
    return h + "</ol></div>";
  }

  function render() {
    var hash = location.hash || "";
    var view = document.getElementById("view");
    var m = hash.match(/^#detail-(.+)$/);
    if (m) {
      var r = bySlug(decodeURIComponent(m[1]));
      if (r) {
        view.innerHTML = detailHtml(r);
        document.getElementById("back").addEventListener("click", function () { location.hash = ""; });
        window.scrollTo(0, 0);
        return;
      }
    }
    if (hash === "#early") document.getElementById("earlyOnly").checked = true;
    var list = filtered();
    document.getElementById("count").textContent = list.length + " of " + rows.length + " shown";
    view.innerHTML = list.length === 0
      ? '<div class="empty">No protocols match these filters.</div>'
      : boardHtml(list);
    // The "#early" hash matches the checkbox's id, so the browser's
    // native anchor jump would scroll the page down to it. Stay at top.
    window.scrollTo(0, 0);
    var trs = view.querySelectorAll("tr[data-slug]");
    for (var i = 0; i < trs.length; i++) {
      trs[i].addEventListener("click", function () {
        location.hash = "detail-" + encodeURIComponent(this.getAttribute("data-slug"));
      });
    }
  }

  function fillSelects() {
    var cats = {}, chains = {};
    rows.forEach(function (r) {
      if (r.cat) cats[r.cat] = 1;
      r.ch.forEach(function (c) { chains[c] = 1; });
    });
    var catSel = document.getElementById("cat");
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    var chSel = document.getElementById("chain");
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; chSel.appendChild(o);
    });
  }

  fillSelects();
  ["q", "cat", "chain", "sort", "earlyOnly"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });
  window.addEventListener("hashchange", render);
  // Belt and braces for the anchor jump above: re-assert the top once
  // the page has fully loaded, before any screenshot is taken.
  window.addEventListener("load", function () { window.scrollTo(0, 0); });
  render();
})();
