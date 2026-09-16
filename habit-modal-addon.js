/* ==========================================================================
   Habit Tracker — Add/Edit Habit modal add-on
   --------------------------------------------------------------------------
   Drop this file in next to your index.html and add ONE line before
   </body>:

       <script src="habit-modal-addon.js"></script>

   Load it AFTER your existing inline <script> (the one that already
   defines `habits`, `renderHabits`, `saveAndRender`, etc). This file does
   not touch or replace any of that code — it injects its own CSS and
   HTML, then hooks into your existing renderHabits() from the outside.
   Your original script stays exactly as it is.
   ========================================================================== */
(function () {
  "use strict";

  if (window.__habitModalAddonLoaded) return;
  window.__habitModalAddonLoaded = true;

  /* ---------- data ---------- */

  var CATEGORIES = [
    { id: "health", label: "Health", icon: "💊" },
    { id: "fitness", label: "Fitness", icon: "🏋️" },
    { id: "mindfulness", label: "Mindfulness", icon: "🧘" },
    { id: "learning", label: "Learning", icon: "📚" },
    { id: "work", label: "Work", icon: "💼" },
    { id: "creative", label: "Creative", icon: "🎨" },
    { id: "social", label: "Social", icon: "👥" },
    { id: "other", label: "Other", icon: "✨" }
  ];
  var HABIT_COLORS = ["#FF7A45", "#E63946", "#FFC857", "#4ECDC4", "#6C5CE7", "#2ECC71", "#3498DB", "#FF6FA5"];
  var DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
  var DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var editingIndex = null;

  /* ---------- inject CSS ---------- */

  var style = document.createElement("style");
  style.textContent =
    "#habitModal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;z-index:100;padding:20px;}" +
    "#habitModal .box{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:26px;text-align:left;max-width:340px;width:85%;max-height:85vh;overflow-y:auto;}" +
    "#habitModal .modal-title{font-weight:600;font-size:16px;margin-bottom:4px;color:var(--text);}" +
    ".add-habit-btn{width:100%;padding:14px 16px;border:1px dashed var(--line);border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;background:var(--surface);color:var(--text);margin-bottom:24px;}" +
    ".habit-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);margin-top:8px;}" +
    ".meta-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}" +
    ".modal-label{display:block;font-size:12px;color:var(--text-muted);margin:16px 0 6px 0;font-weight:600;}" +
    ".modal-input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:14px;}" +
    ".color-grid{display:flex;gap:8px;flex-wrap:wrap;}" +
    ".color-swatch{width:32px;height:32px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;}" +
    ".color-swatch.selected{border-color:var(--text);}" +
    ".freq-options{display:flex;flex-direction:column;gap:10px;}" +
    ".freq-radio{display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;color:var(--text);}" +
    ".day-picker-row{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;}" +
    ".day-toggle{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text-muted);font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;}" +
    ".day-toggle.selected{background:var(--flame-grad);color:white;border-color:transparent;}" +
    ".modal-actions{display:flex;gap:10px;margin-top:22px;}" +
    ".modal-btn-secondary{flex:1;padding:12px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--text);cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;font-size:14px;}" +
    ".modal-btn-primary{flex:1;padding:12px;border-radius:10px;border:none;background:var(--flame-grad);color:white;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;font-size:14px;}";
  document.head.appendChild(style);

  /* ---------- inject modal markup ---------- */

  document.body.insertAdjacentHTML("beforeend",
    "<div id=\"habitModal\">" +
      "<div class=\"box\">" +
        "<div class=\"modal-title\" id=\"habitModalTitle\">Add Habit</div>" +
        "<label class=\"modal-label\" for=\"modalHabitName\">Name</label>" +
        "<input type=\"text\" id=\"modalHabitName\" class=\"modal-input\" placeholder=\"e.g. Drink water\">" +
        "<label class=\"modal-label\" for=\"modalCategory\">Category</label>" +
        "<select id=\"modalCategory\" class=\"modal-input\"></select>" +
        "<label class=\"modal-label\">Color</label>" +
        "<div id=\"modalColorGrid\" class=\"color-grid\"></div>" +
        "<label class=\"modal-label\">Frequency</label>" +
        "<div class=\"freq-options\">" +
          "<label class=\"freq-radio\"><input type=\"radio\" name=\"freqType\" value=\"daily\" checked> Every day</label>" +
          "<label class=\"freq-radio\"><input type=\"radio\" name=\"freqType\" value=\"custom\"> Specific days</label>" +
        "</div>" +
        "<div id=\"dayPickerRow\" class=\"day-picker-row\"></div>" +
        "<div class=\"modal-actions\">" +
          "<button id=\"modalCancelBtn\" class=\"modal-btn-secondary\">Cancel</button>" +
          "<button id=\"modalSaveBtn\" class=\"modal-btn-primary\">Save</button>" +
        "</div>" +
      "</div>" +
    "</div>"
  );

  /* ---------- helpers ---------- */

  function categoryInfo(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[CATEGORIES.length - 1];
  }

  function frequencyLabel(habit) {
    if (!habit.frequency || habit.frequency.type === "daily") return "Daily";
    var days = (habit.frequency.days || []).slice().sort();
    if (days.length === 0 || days.length === 7) return "Daily";
    return days.map(function (d) { return DAY_NAMES_FULL[d]; }).join(", ");
  }

  function isScheduledDay(habit, dateStr) {
    if (!habit.frequency || habit.frequency.type === "daily") return true;
    var days = habit.frequency.days || [];
    if (days.length === 0) return true;
    return days.indexOf(new Date(dateStr).getDay()) !== -1;
  }

  function hasMissedScheduledDay(habit, fromDateStr, toDateStr) {
    var d = new Date(fromDateStr);
    d.setDate(d.getDate() + 1);
    var end = new Date(toDateStr);
    while (d < end) {
      var ds = d.toISOString().split("T")[0];
      if (isScheduledDay(habit, ds) && habit.history.indexOf(ds) === -1) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  }

  function todayStr() {
    return (typeof window.todayString === "function") ? window.todayString() : new Date().toISOString().split("T")[0];
  }

  function migrate() {
    if (typeof window.habits === "undefined") return;
    window.habits.forEach(function (h) {
      if (!h.category) h.category = "other";
      if (!h.color) h.color = HABIT_COLORS[0];
      if (!h.frequency) h.frequency = { type: "daily" };
    });
  }

  /* ---------- modal wiring ---------- */

  function buildCategorySelect() {
    var select = document.getElementById("modalCategory");
    select.innerHTML = "";
    CATEGORIES.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.icon + " " + cat.label;
      select.appendChild(opt);
    });
  }

  function buildDayPicker() {
    var row = document.getElementById("dayPickerRow");
    row.innerHTML = "";
    DAY_NAMES_SHORT.forEach(function (label, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-toggle";
      btn.dataset.day = i;
      btn.textContent = label;
      btn.addEventListener("click", function () { btn.classList.toggle("selected"); });
      row.appendChild(btn);
    });
  }

  function renderColorGrid(selectedColor) {
    var grid = document.getElementById("modalColorGrid");
    grid.innerHTML = "";
    HABIT_COLORS.forEach(function (color) {
      var swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch" + (color === selectedColor ? " selected" : "");
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.addEventListener("click", function () {
        document.querySelectorAll(".color-swatch").forEach(function (s) { s.classList.remove("selected"); });
        swatch.classList.add("selected");
      });
      grid.appendChild(swatch);
    });
  }

  function toggleDayPickerVisibility() {
    var type = document.querySelector('input[name="freqType"]:checked').value;
    document.getElementById("dayPickerRow").style.display = type === "custom" ? "flex" : "none";
  }

  function openHabitModal(index) {
    editingIndex = (index === undefined) ? null : index;
    var isEdit = editingIndex !== null;
    var habit = isEdit ? window.habits[editingIndex] : null;

    document.getElementById("habitModalTitle").textContent = isEdit ? "Edit Habit" : "Add Habit";
    document.getElementById("modalHabitName").value = habit ? habit.name : "";
    document.getElementById("modalCategory").value = habit ? habit.category : "other";
    renderColorGrid(habit ? habit.color : HABIT_COLORS[0]);

    var freqType = habit && habit.frequency ? habit.frequency.type : "daily";
    document.querySelector('input[name="freqType"][value="' + freqType + '"]').checked = true;
    var selectedDays = habit && habit.frequency && habit.frequency.days ? habit.frequency.days : [];
    document.querySelectorAll(".day-toggle").forEach(function (btn) {
      btn.classList.toggle("selected", selectedDays.indexOf(parseInt(btn.dataset.day, 10)) !== -1);
    });
    toggleDayPickerVisibility();

    document.getElementById("habitModal").style.display = "flex";
    document.getElementById("modalHabitName").focus();
  }

  function closeHabitModal() {
    document.getElementById("habitModal").style.display = "none";
    editingIndex = null;
  }

  document.querySelectorAll('input[name="freqType"]').forEach(function (r) {
    r.addEventListener("change", toggleDayPickerVisibility);
  });

  document.getElementById("modalCancelBtn").addEventListener("click", closeHabitModal);

  document.getElementById("modalSaveBtn").addEventListener("click", function () {
    var nameInput = document.getElementById("modalHabitName");
    var name = nameInput.value.trim();
    if (name === "") { nameInput.focus(); return; }

    var category = document.getElementById("modalCategory").value;
    var selectedSwatch = document.querySelector(".color-swatch.selected");
    var color = selectedSwatch ? selectedSwatch.dataset.color : HABIT_COLORS[0];
    var freqType = document.querySelector('input[name="freqType"]:checked').value;

    var frequency;
    if (freqType === "custom") {
      var days = Array.prototype.slice.call(document.querySelectorAll(".day-toggle.selected"))
        .map(function (b) { return parseInt(b.dataset.day, 10); });
      frequency = { type: "custom", days: days.length ? days : [0, 1, 2, 3, 4, 5, 6] };
    } else {
      frequency = { type: "daily" };
    }

    if (editingIndex !== null) {
      var habit = window.habits[editingIndex];
      habit.name = name;
      habit.category = category;
      habit.color = color;
      habit.frequency = frequency;
    } else {
      window.habits.push({
        name: name, category: category, color: color, frequency: frequency,
        streak: 0, lastDone: null, history: [], badges: [], bestStreak: 0, notes: ""
      });
    }

    closeHabitModal();
    if (typeof window.saveAndRender === "function") window.saveAndRender();
  });

  /* ---------- replace the old Add button, hide the old text input ---------- */

  function setupAddButton() {
    var oldInput = document.getElementById("habitInput");
    var oldAddBtn = document.getElementById("addBtn");
    if (oldInput) oldInput.style.display = "none";
    if (oldAddBtn) {
      // clone to strip whatever click listener the original script attached
      var freshBtn = oldAddBtn.cloneNode(true);
      oldAddBtn.parentNode.replaceChild(freshBtn, oldAddBtn);
      freshBtn.id = "addBtn";
      freshBtn.textContent = "+ Add Habit";
      freshBtn.className = "add-habit-btn";
      freshBtn.addEventListener("click", function () { openHabitModal(null); });
    }
  }

  /* ---------- decorate each rendered habit row ---------- */

  function enhanceList() {
    if (typeof window.habits === "undefined") return;
    var today = todayStr();
    var items = document.querySelectorAll("#habitList > li");

    items.forEach(function (li, index) {
      var habit = window.habits[index];
      if (!habit) return;

      // category + frequency line
      var meta = li.querySelector(".habit-meta");
      if (!meta) {
        meta = document.createElement("div");
        meta.className = "habit-meta";
        li.appendChild(meta);
      }
      var cat = categoryInfo(habit.category);
      meta.innerHTML = "<span class=\"meta-dot\" style=\"background:" + habit.color + "\"></span>" +
        "<span>" + cat.icon + " " + cat.label + " \u00b7 " + frequencyLabel(habit) + "</span>";

      // rest-day handling for the Done button
      var doneBtn = li.querySelector(".primaryBtn");
      if (doneBtn && habit.lastDone !== today && !isScheduledDay(habit, today)) {
        doneBtn.textContent = "Rest day";
        doneBtn.disabled = true;
      }

      // edit button → open modal instead of the old prompt()
      var iconBtns = li.querySelectorAll(".icon-btn");
      for (var i = 0; i < iconBtns.length; i++) {
        if (iconBtns[i].textContent.indexOf("\u270f") !== -1 && !iconBtns[i].__addonPatched) {
          (function (index, original) {
            var fresh = original.cloneNode(true);
            original.parentNode.replaceChild(fresh, original);
            fresh.__addonPatched = true;
            fresh.addEventListener("click", function (e) {
              e.stopPropagation();
              openHabitModal(index);
            });
          })(index, iconBtns[i]);
        }
      }
    });
  }

  /* ---------- keep custom-frequency streaks from being reset by the
     original script's "missed a day" check, which only understands
     daily habits ---------- */

  function guardCustomStreaks(fn) {
    if (typeof window.habits === "undefined") { fn(); return; }
    var today = todayStr();
    var fudged = [];
    window.habits.forEach(function (h) {
      if (h.frequency && h.frequency.type === "custom" && h.lastDone && h.lastDone !== today) {
        if (!hasMissedScheduledDay(h, h.lastDone, today)) {
          var yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          fudged.push({ habit: h, real: h.lastDone });
          h.lastDone = yesterday.toISOString().split("T")[0];
        }
      }
    });
    fn();
    fudged.forEach(function (f) { f.habit.lastDone = f.real; });
  }

  /* ---------- hook into the existing renderHabits() from the outside ---------- */

  function hookRenderHabits() {
    if (typeof window.renderHabits !== "function" || window.renderHabits.__addonWrapped) return;
    var original = window.renderHabits;
    var wrapped = function () {
      migrate();
      guardCustomStreaks(function () { original.apply(this, arguments); });
      enhanceList();
    };
    wrapped.__addonWrapped = true;
    window.renderHabits = wrapped;
  }

  /* ---------- init ---------- */

  buildCategorySelect();
  buildDayPicker();
  hookRenderHabits();
  setupAddButton();
  migrate();
  enhanceList();
})();
