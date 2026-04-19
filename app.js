const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const STORAGE_KEYS = {
  meals: "meal-planner-v1-meals",
  shopping: "meal-planner-v4-shopping-items",
};

const state = {
  currentWeekStart: getStartOfWeek(new Date()),
  meals: loadJson(STORAGE_KEYS.meals, {}),
  shoppingItems: loadShoppingItems(),
  editing: null,
};

const weekRangeEl = document.getElementById("weekRange");
const plannerBodyEl = document.getElementById("plannerBody");
const shoppingBoxEl = document.getElementById("shoppingBox");

const modalEl = document.getElementById("editorModal");
const editorTitleEl = document.getElementById("editorTitle");
const editorTextareaEl = document.getElementById("editorTextarea");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

const shoppingModalEl = document.getElementById("shoppingModal");
const shoppingItemsListEl = document.getElementById("shoppingItemsList");
const shoppingItemInputEl = document.getElementById("shoppingItemInput");
const shoppingAddBtn = document.getElementById("shoppingAddBtn");
const shoppingCloseBtn = document.getElementById("shoppingCloseBtn");

document.getElementById("prevWeekBtn").addEventListener("click", () => {
  state.currentWeekStart = addDays(state.currentWeekStart, -7);
  render();
});

document.getElementById("nextWeekBtn").addEventListener("click", () => {
  state.currentWeekStart = addDays(state.currentWeekStart, 7);
  render();
});

document.getElementById("thisWeekBtn").addEventListener("click", () => {
  state.currentWeekStart = getStartOfWeek(new Date());
  render();
});

shoppingBoxEl.addEventListener("click", openShoppingModal);
shoppingAddBtn.addEventListener("click", addShoppingItem);
shoppingCloseBtn.addEventListener("click", closeShoppingModal);

shoppingItemInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addShoppingItem();
  }
});

deleteBtn.addEventListener("click", () => {
  if (!state.editing) return;
  delete state.meals[state.editing.key];
  saveMeals();
  closeEditor();
  render();
});

cancelBtn.addEventListener("click", closeEditor);

saveBtn.addEventListener("click", () => {
  if (!state.editing) return;
  const value = editorTextareaEl.value.trim();

  if (value) {
    state.meals[state.editing.key] = value;
  } else {
    delete state.meals[state.editing.key];
  }

  saveMeals();
  closeEditor();
  render();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.close === "true") {
    closeEditor();
  }

  if (target.dataset.close === "shopping") {
    closeShoppingModal();
  }

  if (target.matches(".delete-item-btn")) {
    const index = Number(target.dataset.index);
    removeShoppingItem(index);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches(".shopping-check")) {
    const index = Number(target.dataset.index);
    toggleShoppingItem(index, target.checked);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeEditor();
    closeShoppingModal();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

render();

function render() {
  renderWeekRange();
  renderShoppingPreview();
  renderPlanner();
  renderShoppingItemsList();
}

function renderWeekRange() {
  const start = state.currentWeekStart;
  const end = addDays(start, 6);
  weekRangeEl.textContent = `${formatMonthDay(start)} 〜 ${formatMonthDay(end)}`;
}

function renderShoppingPreview() {
  if (state.shoppingItems.length) {
    shoppingBoxEl.textContent = state.shoppingItems
      .map((item) => item.name)
      .join("、");
    shoppingBoxEl.classList.remove("empty");
  } else {
    shoppingBoxEl.textContent = "タップして買い物リストを追加";
    shoppingBoxEl.classList.add("empty");
  }
}

function renderShoppingItemsList() {
  shoppingItemsListEl.innerHTML = "";

  if (!state.shoppingItems.length) {
    const empty = document.createElement("div");
    empty.className = "shopping-empty";
    empty.textContent =
      "まだアイテムがありません。上の入力欄から追加してください。";
    shoppingItemsListEl.appendChild(empty);
    return;
  }

  state.shoppingItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "shopping-item-row";
    row.draggable = true;
    row.dataset.index = String(index);

    row.addEventListener("dragstart", handleDragStart);
    row.addEventListener("dragover", handleDragOver);
    row.addEventListener("drop", handleDrop);
    row.addEventListener("dragend", handleDragEnd);

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "drag-handle";
    handle.setAttribute("aria-label", `${item.name} を並び替え`);
    handle.textContent = "⋮⋮";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "shopping-check";
    checkbox.dataset.index = String(index);
    checkbox.checked = !!item.checked;
    checkbox.setAttribute("aria-label", `${item.name} をチェック`);

    const name = document.createElement("div");
    name.className = "shopping-item-name";
    if (item.checked) {
      name.classList.add("checked");
    }
    name.textContent = item.name;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-item-btn";
    deleteButton.dataset.index = String(index);
    deleteButton.setAttribute("aria-label", `${item.name} を削除`);
    deleteButton.textContent = "🗑";

    row.append(handle, checkbox, name, deleteButton);
    shoppingItemsListEl.appendChild(row);
  });
}

function renderPlanner() {
  plannerBodyEl.innerHTML = "";

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(state.currentWeekStart, i);
    const iso = toISODate(date);
    const holidayName = getJapaneseHolidayName(date);

    const row = document.createElement("div");
    row.className = "day-row";
    const today = new Date();
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isToday) {
      row.classList.add("today");
    }

    const day = date.getDay();
    if (day === 0) row.classList.add("sunday");
    else if (day === 6) row.classList.add("saturday");
    if (holidayName) row.classList.add("holiday");

    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}(${DAYS_JA[day]})`;
    if (holidayName) {
      dayLabel.title = holidayName;
    }

    const lunchBtn = createMemoButton({
      key: `${iso}-lunch`,
      label: `${formatMonthDay(date)} の昼`,
      value: state.meals[`${iso}-lunch`] || "",
    });

    const dinnerBtn = createMemoButton({
      key: `${iso}-dinner`,
      label: `${formatMonthDay(date)} の夜`,
      value: state.meals[`${iso}-dinner`] || "",
    });

    row.append(dayLabel, lunchBtn, dinnerBtn);
    plannerBodyEl.appendChild(row);
  }
}

function createMemoButton({ key, label, value }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "memo-box tappable";
  button.setAttribute("aria-label", `${label}を編集`);

  if (value) {
    button.textContent = value;
  } else {
    button.textContent = "タップして入力";
    button.classList.add("empty");
  }

  button.addEventListener("click", () => {
    openEditor({
      key,
      title: `${label}を編集`,
      value,
      placeholder: "ここに献立を入力",
    });
  });

  return button;
}

function openEditor({ key, title, value, placeholder }) {
  state.editing = { key };
  editorTitleEl.textContent = title;
  editorTextareaEl.value = value;
  editorTextareaEl.placeholder = placeholder || "";
  modalEl.classList.remove("hidden");
  modalEl.setAttribute("aria-hidden", "false");
  setTimeout(() => editorTextareaEl.focus(), 0);
}

function closeEditor() {
  state.editing = null;
  modalEl.classList.add("hidden");
  modalEl.setAttribute("aria-hidden", "true");
}

function openShoppingModal() {
  shoppingModalEl.classList.remove("hidden");
  shoppingModalEl.setAttribute("aria-hidden", "false");
  renderShoppingItemsList();
  setTimeout(() => shoppingItemInputEl.focus(), 0);
}

function closeShoppingModal() {
  shoppingModalEl.classList.add("hidden");
  shoppingModalEl.setAttribute("aria-hidden", "true");
  shoppingItemInputEl.value = "";
}

function addShoppingItem() {
  const value = shoppingItemInputEl.value.trim();
  if (!value) return;

  state.shoppingItems.push({ name: value, checked: false });
  saveShoppingItems();
  shoppingItemInputEl.value = "";
  renderShoppingPreview();
  renderShoppingItemsList();
  shoppingItemInputEl.focus();
}

function removeShoppingItem(index) {
  if (Number.isNaN(index) || index < 0 || index >= state.shoppingItems.length)
    return;
  state.shoppingItems.splice(index, 1);
  saveShoppingItems();
  renderShoppingPreview();
  renderShoppingItemsList();
}

function toggleShoppingItem(index, checked) {
  if (Number.isNaN(index) || index < 0 || index >= state.shoppingItems.length)
    return;
  state.shoppingItems[index].checked = checked;
  saveShoppingItems();
  renderShoppingPreview();
  renderShoppingItemsList();
}

function handleDragStart(event) {
  const row = event.currentTarget;
  if (!(row instanceof HTMLElement)) return;
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.index || "");
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDrop(event) {
  event.preventDefault();
  const toRow = event.currentTarget;
  if (!(toRow instanceof HTMLElement)) return;

  const fromIndex = Number(event.dataTransfer.getData("text/plain"));
  const toIndex = Number(toRow.dataset.index);

  if (
    Number.isNaN(fromIndex) ||
    Number.isNaN(toIndex) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.shoppingItems.length ||
    toIndex >= state.shoppingItems.length
  ) {
    return;
  }

  const [moved] = state.shoppingItems.splice(fromIndex, 1);
  state.shoppingItems.splice(toIndex, 0, moved);

  saveShoppingItems();
  renderShoppingPreview();
  renderShoppingItemsList();
}

function handleDragEnd(event) {
  const row = event.currentTarget;
  if (row instanceof HTMLElement) {
    row.classList.remove("dragging");
  }
}

function saveMeals() {
  localStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(state.meals));
}

function saveShoppingItems() {
  localStorage.setItem(
    STORAGE_KEYS.shopping,
    JSON.stringify(state.shoppingItems),
  );
}

function loadJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function loadShoppingItems() {
  try {
    const current = localStorage.getItem(STORAGE_KEYS.shopping);
    if (current) {
      const parsed = JSON.parse(current);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeShoppingItem).filter(Boolean);
      }
    }

    const v3 = localStorage.getItem("meal-planner-v3-shopping-items");
    if (v3) {
      const parsed = JSON.parse(v3);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeShoppingItem).filter(Boolean);
      }
    }

    const v2 = localStorage.getItem("meal-planner-v2-shopping-items");
    if (v2) {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeShoppingItem).filter(Boolean);
      }
    }

    const oldText = localStorage.getItem("meal-planner-v1-shopping");
    if (oldText && oldText.trim()) {
      return oldText
        .split(/[、,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((name) => ({ name, checked: false }));
    }

    return [];
  } catch {
    return [];
  }
}

function normalizeShoppingItem(item) {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name, checked: false } : null;
  }
  if (item && typeof item === "object") {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) return null;
    return { name, checked: Boolean(item.checked) };
  }
  return null;
}

// 日本の祝日判定
// 固定日、ハッピーマンデー、春分・秋分の近似式、振替休日、国民の休日に対応。
// 春分日・秋分日が官報で毎年確定することを踏まえた近似計算を使っています。
function getJapaneseHolidayName(date) {
  const normalized = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const base = getBaseHolidayName(normalized);
  if (base) return base;

  if (isSubstituteHoliday(normalized)) return "振替休日";
  if (isCitizenHoliday(normalized)) return "国民の休日";
  return "";
}

function getBaseHolidayName(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = date.getDay();

  if (m === 1 && d === 1) return "元日";
  if (m === 1 && isNthMonday(date, 2)) return "成人の日";
  if (m === 2 && d === 11) return "建国記念の日";
  if (m === 2 && d === 23 && y >= 2020) return "天皇誕生日";

  if (m === 3 && d === calcSpringEquinoxDay(y)) return "春分の日";
  if (m === 4 && d === 29) return "昭和の日";
  if (m === 5 && d === 3) return "憲法記念日";
  if (m === 5 && d === 4) return "みどりの日";
  if (m === 5 && d === 5) return "こどもの日";

  if (m === 7 && isNthMonday(date, 3)) return "海の日";
  if (m === 8 && d === 11) return "山の日";
  if (m === 9 && isNthMonday(date, 3)) return "敬老の日";
  if (m === 9 && d === calcAutumnEquinoxDay(y)) return "秋分の日";
  if (m === 10 && isNthMonday(date, 2)) return "スポーツの日";
  if (m === 11 && d === 3) return "文化の日";
  if (m === 11 && d === 23) return "勤労感謝の日";

  return "";
}

function isSubstituteHoliday(date) {
  if (date.getDay() === 0) return false;

  const prev = addDays(date, -1);
  if (prev.getDay() === 0 && getBaseHolidayName(prev)) return true;

  if (date >= new Date(2007, 0, 1)) {
    let cursor = addDays(date, -1);
    let foundHoliday = false;

    while (cursor.getDay() !== 0) {
      if (getBaseHolidayName(cursor)) {
        foundHoliday = true;
        cursor = addDays(cursor, -1);
      } else {
        return false;
      }
    }

    return foundHoliday && getBaseHolidayName(cursor) !== "";
  }

  return false;
}

function isCitizenHoliday(date) {
  if (date < new Date(1985, 11, 27)) return false;
  if (date.getDay() === 0) return false;
  if (getBaseHolidayName(date)) return false;
  if (isSubstituteHoliday(date)) return false;

  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  const prevHoliday =
    getBaseHolidayName(prev) ||
    isSubstituteHoliday(prev) ||
    isCitizenHolidaySimple(prev);
  const nextHoliday =
    getBaseHolidayName(next) ||
    isSubstituteHoliday(next) ||
    isCitizenHolidaySimple(next);

  return !!prevHoliday && !!nextHoliday;
}

function isCitizenHolidaySimple(date) {
  if (date < new Date(1985, 11, 27)) return false;
  if (date.getDay() === 0) return false;
  if (getBaseHolidayName(date)) return false;
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  return !!getBaseHolidayName(prev) && !!getBaseHolidayName(next);
}

function isNthMonday(date, nth) {
  return date.getDay() === 1 && Math.ceil(date.getDate() / 7) === nth;
}

function calcSpringEquinoxDay(year) {
  if (year <= 2099) {
    return Math.floor(
      20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
    );
  }
  return 20;
}

function calcAutumnEquinoxDay(year) {
  if (year <= 2099) {
    return Math.floor(
      23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
    );
  }
  return 23;
}

function getStartOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = copy.getDay();
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
