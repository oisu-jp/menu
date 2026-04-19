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
  holidaysByDate: loadJson("meal-planner-v5-holidays-cache", {}),
  holidaySource: "読み込み中",
};

const weekRangeEl = document.getElementById("weekRange");
const plannerBodyEl = document.getElementById("plannerBody");
const shoppingBoxEl = document.getElementById("shoppingBox");
const holidaySourceBadgeEl = document.getElementById("holidaySourceBadge");

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

document.getElementById("prevWeekBtn").addEventListener("click", async () => {
  state.currentWeekStart = addDays(state.currentWeekStart, -7);
  await render();
});

document.getElementById("nextWeekBtn").addEventListener("click", async () => {
  state.currentWeekStart = addDays(state.currentWeekStart, 7);
  await render();
});

document.getElementById("thisWeekBtn").addEventListener("click", async () => {
  state.currentWeekStart = getStartOfWeek(new Date());
  await render();
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
  if (value) state.meals[state.editing.key] = value;
  else delete state.meals[state.editing.key];
  saveMeals();
  closeEditor();
  render();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.close === "true") closeEditor();
  if (target.dataset.close === "shopping") closeShoppingModal();

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

async function render() {
  renderWeekRange();
  renderShoppingPreview();
  await ensureHolidayDataForVisibleRange();
  renderPlanner();
  renderShoppingItemsList();
  holidaySourceBadgeEl.textContent = `祝日: ${state.holidaySource}`;
}

function renderWeekRange() {
  const start = state.currentWeekStart;
  const end = addDays(start, 6);
  weekRangeEl.textContent = `${formatMonthDay(start)} 〜 ${formatMonthDay(end)}`;
}

function renderShoppingPreview() {
  if (state.shoppingItems.length) {
    shoppingBoxEl.textContent = state.shoppingItems.map((item) => item.name).join("、");
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
    empty.textContent = "まだアイテムがありません。上の入力欄から追加してください。";
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
    if (item.checked) name.classList.add("checked");
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
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(state.currentWeekStart, i);
    const iso = toISODate(date);
    const holidayName = state.holidaysByDate[iso] || "";

    const row = document.createElement("div");
    row.className = "day-row";

    const day = date.getDay();
    if (day === 0) row.classList.add("sunday");
    else if (day === 6) row.classList.add("saturday");
    if (holidayName) row.classList.add("holiday");

    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (targetDate.getTime() === todayMidnight.getTime()) row.classList.add("today");

    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}(${DAYS_JA[day]})`;
    if (holidayName) dayLabel.title = holidayName;

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

async function ensureHolidayDataForVisibleRange() {
  const start = state.currentWeekStart;
  const end = addDays(start, 6);
  const years = new Set([start.getFullYear(), end.getFullYear()]);
  const missing = [...years].find((year) => !Object.keys(state.holidaysByDate).some((d) => d.startsWith(`${year}-`)));

  if (!missing) {
    if (state.holidaySource === "読み込み中") state.holidaySource = "キャッシュ";
    return;
  }

  try {
    const response = await fetch(`/api/holidays?start=${toISODate(start)}&end=${toISODate(end)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("holiday fetch failed");
    const payload = await response.json();

    if (payload && payload.holidays && typeof payload.holidays === "object") {
      state.holidaysByDate = { ...state.holidaysByDate, ...payload.holidays };
      localStorage.setItem("meal-planner-v5-holidays-cache", JSON.stringify(state.holidaysByDate));
      state.holidaySource = payload.source || "API";
      return;
    }

    throw new Error("invalid payload");
  } catch (error) {
    console.error(error);
    state.holidaySource = "取得失敗";
  }
}

function createMemoButton({ key, label, value }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "memo-box tappable";
  button.setAttribute("aria-label", `${label}を編集`);

  if (value) button.textContent = value;
  else {
    button.textContent = "タップして入力";
    button.classList.add("empty");
  }

  button.addEventListener("click", () => {
    openEditor({ key, title: `${label}を編集`, value, placeholder: "ここに献立を入力" });
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
  if (Number.isNaN(index) || index < 0 || index >= state.shoppingItems.length) return;
  state.shoppingItems.splice(index, 1);
  saveShoppingItems();
  renderShoppingPreview();
  renderShoppingItemsList();
}

function toggleShoppingItem(index, checked) {
  if (Number.isNaN(index) || index < 0 || index >= state.shoppingItems.length) return;
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

  if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.shoppingItems.length || toIndex >= state.shoppingItems.length) return;

  const [moved] = state.shoppingItems.splice(fromIndex, 1);
  state.shoppingItems.splice(toIndex, 0, moved);

  saveShoppingItems();
  renderShoppingPreview();
  renderShoppingItemsList();
}

function handleDragEnd(event) {
  const row = event.currentTarget;
  if (row instanceof HTMLElement) row.classList.remove("dragging");
}

function saveMeals() {
  localStorage.setItem(STORAGE_KEYS.meals, JSON.stringify(state.meals));
}

function saveShoppingItems() {
  localStorage.setItem(STORAGE_KEYS.shopping, JSON.stringify(state.shoppingItems));
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
    for (const key of [STORAGE_KEYS.shopping, "meal-planner-v3-shopping-items", "meal-planner-v2-shopping-items"]) {
      const value = localStorage.getItem(key);
      if (!value) continue;
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(normalizeShoppingItem).filter(Boolean);
    }

    const oldText = localStorage.getItem("meal-planner-v1-shopping");
    if (oldText && oldText.trim()) {
      return oldText.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean).map((name) => ({ name, checked: false }));
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

function getStartOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
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
