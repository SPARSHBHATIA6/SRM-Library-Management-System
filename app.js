/**
 * LibraNet — Frontend JavaScript
 * ================================
 * This file handles:
 *  1. Simulated API calls to the C++ backend (via fetch / Crow routes)
 *  2. Form validation (login, signup, add-book)
 *  3. Dynamic UI updates (tabs, toasts, dashboards)
 *  4. Local session management (sessionStorage)
 *
 * In production, every `simulateAPI()` call is replaced by:
 *   fetch("http://localhost:18080/api/...", { method: "POST", body: JSON.stringify({...}) })
 */

"use strict";

/* ============================================================
   § 1 — SAMPLE DATA  (mirrors what the C++ backend stores)
   ============================================================ */

/**
 * In a real setup these arrays live in the C++ Library class
 * and are persisted to books.dat / users.dat via file I/O.
 * Here we initialise from localStorage so data survives refresh.
 */

const DEFAULT_BOOKS = [
  { id:"B001", title:"The Great Gatsby",           author:"F. Scott Fitzgerald", genre:"Fiction",    copies:3, available:2, desc:"A tale of wealth & obsession in the Roaring Twenties." },
  { id:"B002", title:"1984",                        author:"George Orwell",       genre:"Fiction",    copies:4, available:3, desc:"A chilling portrait of a totalitarian future." },
  { id:"B003", title:"To Kill a Mockingbird",       author:"Harper Lee",          genre:"Fiction",    copies:2, available:2, desc:"A story of racial injustice and childhood innocence." },
  { id:"B004", title:"Dune",                        author:"Frank Herbert",       genre:"Fantasy",    copies:3, available:1, desc:"An epic saga of politics, religion and survival on a desert planet." },
  { id:"B005", title:"A Brief History of Time",     author:"Stephen Hawking",     genre:"Science",    copies:2, available:2, desc:"Cosmology made accessible for everyone." },
  { id:"B006", title:"Sapiens",                     author:"Yuval Noah Harari",   genre:"History",    copies:3, available:3, desc:"A sweeping history of humankind." },
  { id:"B007", title:"The Alchemist",               author:"Paulo Coelho",        genre:"Fiction",    copies:5, available:4, desc:"A magical journey about following your dreams." },
  { id:"B008", title:"Clean Code",                  author:"Robert C. Martin",    genre:"Technology", copies:2, available:1, desc:"Writing maintainable, elegant software." },
];

const DEFAULT_USERS = [
  { id:"U001", name:"Alice Johnson", email:"user@demo.com",  password:"pass123",  role:"user",  borrowed:[], history:[] },
  { id:"U002", name:"Bob Smith",     email:"admin@demo.com", password:"admin123", role:"admin", borrowed:[], history:[] },
];

const DEFAULT_ACTIVITY = [
  { icon:"📖", text:"Alice borrowed 'The Great Gatsby'",  time:"2 hrs ago" },
  { icon:"✅", text:"Bob returned '1984'",                time:"5 hrs ago" },
  { icon:"➕", text:"Admin added 'Clean Code'",            time:"1 day ago" },
  { icon:"👤", text:"New user registered: Charlie Khan",   time:"2 days ago" },
];

/* ── Helpers: read/write from localStorage ── */
function loadData(key, defaultVal) {
  try { return JSON.parse(localStorage.getItem(key)) || defaultVal; }
  catch { return defaultVal; }
}
function saveData(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* Initialise on first visit */
if (!localStorage.getItem("lm_books"))  saveData("lm_books",    DEFAULT_BOOKS);
if (!localStorage.getItem("lm_users"))  saveData("lm_users",    DEFAULT_USERS);
if (!localStorage.getItem("lm_activity")) saveData("lm_activity", DEFAULT_ACTIVITY);

/* Live references — write back after mutation */
let BOOKS    = loadData("lm_books",    DEFAULT_BOOKS);
let USERS    = loadData("lm_users",    DEFAULT_USERS);
let ACTIVITY = loadData("lm_activity", DEFAULT_ACTIVITY);

/* ============================================================
   § 2 — SIMULATED API  (replace with real fetch in production)
   ============================================================

   Each function below mirrors a C++ Crow route, e.g.:
     CROW_ROUTE(app, "/api/login").methods("POST"_method)([](const crow::request& req){...});

   The simulated version just manipulates the in-memory arrays
   and returns an object with { success, message, data }.
*/

/**
 * POST /api/login
 * Body: { email, password, role }
 * Returns: { success, user }
 */
async function apiLogin({ email, password, role }) {
  await delay(500); // simulate network latency
  const user = USERS.find(u => u.email === email && u.password === password && u.role === role);
  if (!user) return { success: false, message: "Invalid credentials. Check email, password and role." };
  return { success: true, user };
}

/**
 * POST /api/register
 * Body: { name, email, password }
 * Returns: { success, user }
 */
async function apiRegister({ name, email, password }) {
  await delay(500);
  if (USERS.find(u => u.email === email))
    return { success: false, message: "Email already registered." };
  const newUser = {
    id: "U" + String(USERS.length + 1).padStart(3, "0"),
    name, email, password, role: "user", borrowed: [], history: []
  };
  USERS.push(newUser);
  saveData("lm_users", USERS);
  return { success: true, user: newUser };
}

/**
 * GET /api/books
 * Returns: { books }
 */
async function apiGetBooks() {
  await delay(300);
  return { books: BOOKS };
}

/**
 * POST /api/borrow
 * Body: { userId, bookId }
 */
async function apiBorrow({ userId, bookId }) {
  await delay(400);
  const book = BOOKS.find(b => b.id === bookId);
  const user = USERS.find(u => u.id === userId);
  if (!book || !user) return { success: false, message: "Not found." };
  if (book.available < 1) return { success: false, message: "No copies available." };
  if (user.borrowed.includes(bookId)) return { success: false, message: "Already borrowed." };

  book.available--;
  user.borrowed.push(bookId);
  const due = new Date(); due.setDate(due.getDate() + 14);
  user.history.push({ bookId, action:"borrowed", date: new Date().toLocaleDateString(), due: due.toLocaleDateString() });

  saveData("lm_books", BOOKS);
  saveData("lm_users", USERS);

  const act = { icon:"📖", text:`${user.name} borrowed '${book.title}'`, time:"just now" };
  ACTIVITY.unshift(act); if (ACTIVITY.length > 20) ACTIVITY.pop();
  saveData("lm_activity", ACTIVITY);

  return { success: true, message: `Borrowed! Due: ${due.toLocaleDateString()}` };
}

/**
 * POST /api/return
 * Body: { userId, bookId }
 */
async function apiReturn({ userId, bookId }) {
  await delay(400);
  const book = BOOKS.find(b => b.id === bookId);
  const user = USERS.find(u => u.id === userId);
  if (!book || !user) return { success: false, message: "Not found." };

  book.available = Math.min(book.available + 1, book.copies);
  user.borrowed  = user.borrowed.filter(id => id !== bookId);
  user.history.push({ bookId, action:"returned", date: new Date().toLocaleDateString() });

  saveData("lm_books", BOOKS); saveData("lm_users", USERS);
  return { success: true, message: "Book returned successfully!" };
}

/**
 * POST /api/admin/add-book
 * Body: { title, author, genre, copies, desc }
 */
async function apiAddBook(book) {
  await delay(400);
  if (!book.title || !book.author) return { success: false, message: "Title and author required." };
  const newBook = {
    id:        "B" + String(BOOKS.length + 1).padStart(3,"0"),
    title:     book.title,
    author:    book.author,
    genre:     book.genre || "Fiction",
    copies:    parseInt(book.copies) || 1,
    available: parseInt(book.copies) || 1,
    desc:      book.desc || "",
  };
  BOOKS.push(newBook);
  saveData("lm_books", BOOKS);
  return { success: true, book: newBook };
}

/**
 * DELETE /api/admin/remove-book/:id
 */
async function apiRemoveBook(bookId) {
  await delay(300);
  BOOKS = BOOKS.filter(b => b.id !== bookId);
  saveData("lm_books", BOOKS);
  return { success: true };
}

/* ============================================================
   § 3 — SESSION MANAGEMENT
   ============================================================ */

function getSession() {
  try { return JSON.parse(sessionStorage.getItem("lm_session")); } catch { return null; }
}
function setSession(user) { sessionStorage.setItem("lm_session", JSON.stringify(user)); }
function clearSession()   { sessionStorage.removeItem("lm_session"); }

function logout() {
  clearSession();
  window.location.href = "index.html";
}

/* ============================================================
   § 4 — UTILITY HELPERS
   ============================================================ */

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg; t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, duration);
}

function showStatus(elId, msg, type="error") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = "status-msg status-" + type;
  el.style.display = "block";
}

function hideStatus(elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = "none";
}

function setLoading(btnId, loading, label="Submit") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled  = loading;
  btn.textContent = loading ? "Please wait…" : label;
}

/* Book cover colours cycle */
const COVER_COLORS = ["#8b5e3c","#2d6a4f","#5c4a7a","#c05c2a","#1e5f74","#7a4a1e","#3d5a80","#6b4c4c"];
function coverColor(idx) { return COVER_COLORS[idx % COVER_COLORS.length]; }
const GENRE_ICONS = { Fiction:"📖", Fantasy:"🧙", Science:"🔬", History:"🏛️", Technology:"💻", Mystery:"🔍", Biography:"🧑", "Non-Fiction":"📰" };

/* ============================================================
   § 5 — HOME PAGE
   ============================================================ */

function renderHomeCatalog() {
  const grid = document.getElementById("booksGrid");
  if (!grid) return;
  BOOKS = loadData("lm_books", DEFAULT_BOOKS); // refresh
  grid.innerHTML = BOOKS.slice(0,8).map((b, i) => `
    <div class="book-card">
      <div class="book-card-cover" style="background:${coverColor(i)}">
        ${GENRE_ICONS[b.genre] || "📚"}
      </div>
      <h4>${b.title}</h4>
      <p class="author">${b.author}</p>
      <span class="book-badge ${b.available > 0 ? 'badge-available':'badge-borrowed'}">
        ${b.available > 0 ? `${b.available} Available` : "Borrowed Out"}
      </span>
    </div>
  `).join("");
}

/* ============================================================
   § 6 — AUTH: LOGIN & SIGNUP
   ============================================================ */

function selectRole(role) {
  document.getElementById("loginRole").value = role;
  document.getElementById("userRoleBtn").classList.toggle("active", role === "user");
  document.getElementById("adminRoleBtn").classList.toggle("active", role === "admin");
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const role     = document.getElementById("loginRole").value;

  // — Validation —
  let valid = true;
  if (!email) { document.getElementById("emailError").textContent = "Email is required."; valid=false; }
  else         { document.getElementById("emailError").textContent = ""; }
  if (!password) { document.getElementById("passwordError").textContent = "Password is required."; valid=false; }
  else            { document.getElementById("passwordError").textContent = ""; }
  if (!valid) return;

  setLoading("loginBtn", true, "Sign In");
  hideStatus("loginStatus");

  const res = await apiLogin({ email, password, role });
  setLoading("loginBtn", false, "Sign In");

  if (!res.success) {
    showStatus("loginStatus", res.message, "error");
    return;
  }

  /* Store session and redirect */
  setSession(res.user);
  showStatus("loginStatus", "Login successful! Redirecting…", "success");

  setTimeout(() => {
    window.location.href = res.user.role === "admin" ? "admin.html" : "dashboard.html";
  }, 800);
}

async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirm  = document.getElementById("confirmPassword").value;

  let valid = true;
  const clearErr = (...ids) => ids.forEach(id => document.getElementById(id).textContent = "");
  clearErr("nameError","signupEmailError","signupPasswordError","confirmError");

  if (name.length < 2)      { document.getElementById("nameError").textContent = "Name must be at least 2 characters."; valid=false; }
  if (!email.includes("@")) { document.getElementById("signupEmailError").textContent = "Enter a valid email."; valid=false; }
  if (password.length < 6) { document.getElementById("signupPasswordError").textContent = "Password must be at least 6 characters."; valid=false; }
  if (password !== confirm) { document.getElementById("confirmError").textContent = "Passwords do not match."; valid=false; }
  if (!valid) return;

  setLoading("signupBtn", true, "Create Account");
  const res = await apiRegister({ name, email, password });
  setLoading("signupBtn", false, "Create Account");

  if (!res.success) { showStatus("signupStatus", res.message, "error"); return; }

  showStatus("signupStatus", "Account created! Redirecting to login…", "success");
  setTimeout(() => window.location.href = "login.html", 1200);
}

/* Password strength checker */
function checkPwdStrength(pwd) {
  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0–5
}

function togglePassword(inputId) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === "password" ? "text" : "password";
}

function toggleMenu() {
  document.querySelector(".nav-links").classList.toggle("open");
}

/* ============================================================
   § 7 — USER DASHBOARD
   ============================================================ */

let currentUser = null; // set on page load

async function initDashboard() {
  currentUser = getSession();
  if (!currentUser || currentUser.role !== "user") {
    window.location.href = "login.html"; return;
  }
  // Refresh user data from storage
  USERS = loadData("lm_users", DEFAULT_USERS);
  currentUser = USERS.find(u => u.id === currentUser.id) || currentUser;

  document.getElementById("navUserName").textContent = `Hello, ${currentUser.name.split(" ")[0]}!`;
  renderCatalog();
  renderBorrowed();
  renderHistory();
  renderProfile();
}

function showTab(tabName) {
  document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".sidebar-menu li").forEach(l => l.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");
  event.currentTarget.classList.add("active");
}

function renderCatalog(filter = "") {
  BOOKS = loadData("lm_books", DEFAULT_BOOKS);
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;
  const list = filter
    ? BOOKS.filter(b => b.title.toLowerCase().includes(filter) || b.author.toLowerCase().includes(filter))
    : BOOKS;

  grid.innerHTML = list.length === 0
    ? `<p style="color:var(--muted)">No books found.</p>`
    : list.map((b, i) => `
      <div class="book-card">
        <div class="book-card-cover" style="background:${coverColor(i)}">${GENRE_ICONS[b.genre]||"📚"}</div>
        <h4>${b.title}</h4>
        <p class="author">${b.author} · <em>${b.genre}</em></p>
        <span class="book-badge ${b.available>0?'badge-available':'badge-borrowed'}">
          ${b.available>0 ? `${b.available} copies left` : "Not available"}
        </span>
        <button class="btn btn-primary btn-sm"
          onclick="borrowBook('${b.id}')"
          ${b.available<1 || currentUser.borrowed.includes(b.id) ? "disabled" : ""}>
          ${currentUser.borrowed.includes(b.id) ? "✓ Borrowed" : "Borrow"}
        </button>
      </div>
    `).join("");
}

function searchBooks() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  renderCatalog(q);
}

async function borrowBook(bookId) {
  const res = await apiBorrow({ userId: currentUser.id, bookId });
  USERS = loadData("lm_users", DEFAULT_USERS);
  currentUser = USERS.find(u => u.id === currentUser.id);
  setSession(currentUser);
  showToast(res.success ? "✓ " + res.message : "✗ " + res.message);
  renderCatalog(document.getElementById("searchInput")?.value.toLowerCase() || "");
  renderBorrowed();
  renderHistory();
}

function renderBorrowed() {
  BOOKS = loadData("lm_books", DEFAULT_BOOKS);
  const list = document.getElementById("borrowedList");
  if (!list) return;
  const borrowed = (currentUser.borrowed || []).map(id => BOOKS.find(b => b.id === id)).filter(Boolean);
  list.innerHTML = borrowed.length === 0
    ? `<p style="color:var(--muted)">You haven't borrowed any books yet.</p>`
    : borrowed.map(b => `
      <div class="borrow-item">
        <div class="borrow-info">
          <h4>${b.title}</h4>
          <p>${b.author} · ${b.genre}</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="returnBook('${b.id}')">Return</button>
      </div>
    `).join("");
}

async function returnBook(bookId) {
  const res = await apiReturn({ userId: currentUser.id, bookId });
  USERS = loadData("lm_users", DEFAULT_USERS);
  currentUser = USERS.find(u => u.id === currentUser.id);
  setSession(currentUser);
  showToast(res.success ? "✓ " + res.message : "✗ " + res.message);
  renderBorrowed();
  renderCatalog();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  const hist = (currentUser.history || []).slice().reverse();
  list.innerHTML = hist.length === 0
    ? `<p style="color:var(--muted)">No history yet.</p>`
    : hist.map(h => {
        const book = BOOKS.find(b => b.id === h.bookId);
        return `
          <div class="borrow-item">
            <div class="borrow-info">
              <h4>${book ? book.title : h.bookId}</h4>
              <p>${h.action === "borrowed" ? "📖 Borrowed" : "✅ Returned"} on ${h.date}
                ${h.due ? ` · Due: ${h.due}` : ""}</p>
            </div>
          </div>`;
      }).join("");
}

function renderProfile() {
  const card = document.getElementById("profileCard");
  if (!card || !currentUser) return;
  card.innerHTML = `
    <div class="profile-row"><span class="profile-label">Name</span><span class="profile-value">${currentUser.name}</span></div>
    <div class="profile-row"><span class="profile-label">Email</span><span class="profile-value">${currentUser.email}</span></div>
    <div class="profile-row"><span class="profile-label">Member ID</span><span class="profile-value">${currentUser.id}</span></div>
    <div class="profile-row"><span class="profile-label">Role</span><span class="profile-value">${currentUser.role}</span></div>
    <div class="profile-row"><span class="profile-label">Books Borrowed</span><span class="profile-value">${(currentUser.borrowed||[]).length}</span></div>
  `;
}

/* ============================================================
   § 8 — ADMIN PANEL
   ============================================================ */

let pendingDeleteId = null;

async function initAdmin() {
  const session = getSession();
  if (!session || session.role !== "admin") {
    window.location.href = "login.html"; return;
  }
  document.getElementById("adminNavName").textContent = session.name;
  renderStats();
  renderAdminBooks();
  renderAdminUsers();
  renderActivity();
}

function showAdminTab(tabName) {
  document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".sidebar-menu li").forEach(l => l.classList.remove("active"));
  document.getElementById("admin-tab-" + tabName).classList.add("active");
  event.currentTarget.classList.add("active");
}

function renderStats() {
  BOOKS = loadData("lm_books", DEFAULT_BOOKS);
  USERS = loadData("lm_users", DEFAULT_USERS);
  const grid = document.getElementById("statsGrid");
  if (!grid) return;
  const totalBooks   = BOOKS.length;
  const totalCopies  = BOOKS.reduce((s,b) => s+b.copies, 0);
  const borrowed     = BOOKS.reduce((s,b) => s+(b.copies-b.available), 0);
  const members      = USERS.filter(u => u.role === "user").length;
  grid.innerHTML = [
    { num: totalBooks,  label: "Book Titles" },
    { num: totalCopies, label: "Total Copies" },
    { num: borrowed,    label: "Currently Borrowed" },
    { num: members,     label: "Registered Members" },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join("");
}

function renderActivity() {
  ACTIVITY = loadData("lm_activity", DEFAULT_ACTIVITY);
  const log = document.getElementById("activityLog");
  if (!log) return;
  log.innerHTML = ACTIVITY.slice(0,8).map(a => `
    <div class="activity-item">
      <span class="activity-icon">${a.icon}</span>
      <span class="activity-text">${a.text}</span>
      <span class="activity-time">${a.time}</span>
    </div>
  `).join("");
}

function renderAdminBooks(filter = "") {
  BOOKS = loadData("lm_books", DEFAULT_BOOKS);
  const tbody = document.getElementById("booksTableBody");
  if (!tbody) return;
  const list = filter ? BOOKS.filter(b => b.title.toLowerCase().includes(filter) || b.author.toLowerCase().includes(filter)) : BOOKS;
  tbody.innerHTML = list.map(b => `
    <tr>
      <td>${b.id}</td>
      <td><strong>${b.title}</strong></td>
      <td>${b.author}</td>
      <td>${b.genre}</td>
      <td>
        <span class="book-badge ${b.available>0?'badge-available':'badge-borrowed'}">
          ${b.available}/${b.copies}
        </span>
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${b.id}','${b.title.replace(/'/g,"\\'")}')">Remove</button>
      </td>
    </tr>
  `).join("");
}

function adminSearchBooks() {
  renderAdminBooks(document.getElementById("adminSearchInput").value.toLowerCase());
}

function renderAdminUsers() {
  USERS = loadData("lm_users", DEFAULT_USERS);
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = USERS.filter(u => u.role==="user").map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${(u.borrowed||[]).length}</td>
      <td><span class="book-badge badge-available">Active</span></td>
    </tr>
  `).join("");
}

async function handleAddBook(e) {
  e.preventDefault();
  const title   = document.getElementById("bookTitle").value.trim();
  const author  = document.getElementById("bookAuthor").value.trim();
  const genre   = document.getElementById("bookGenre").value;
  const copies  = document.getElementById("bookCopies").value;
  const desc    = document.getElementById("bookDesc").value.trim();

  let valid = true;
  document.getElementById("bookTitleError").textContent  = "";
  document.getElementById("bookAuthorError").textContent = "";
  if (!title)  { document.getElementById("bookTitleError").textContent  = "Title is required.";  valid=false; }
  if (!author) { document.getElementById("bookAuthorError").textContent = "Author is required."; valid=false; }
  if (!valid) return;

  const res = await apiAddBook({ title, author, genre, copies, desc });
  if (res.success) {
    showStatus("addBookStatus", `✓ '${title}' added successfully!`, "success");
    document.getElementById("addBookForm").reset();
    BOOKS = loadData("lm_books", DEFAULT_BOOKS);
    renderStats(); renderAdminBooks();

    const act = { icon:"➕", text:`Admin added '${title}'`, time:"just now" };
    ACTIVITY.unshift(act); saveData("lm_activity", ACTIVITY);
    renderActivity();
  } else {
    showStatus("addBookStatus", res.message, "error");
  }
}

function openDeleteModal(bookId, title) {
  pendingDeleteId = bookId;
  document.getElementById("deleteModalText").textContent = `Remove "${title}" from the catalog?`;
  document.getElementById("deleteModal").style.display = "flex";
}
function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById("deleteModal").style.display = "none";
}
async function confirmDelete() {
  if (!pendingDeleteId) return;
  await apiRemoveBook(pendingDeleteId);
  BOOKS = loadData("lm_books", DEFAULT_BOOKS);
  closeDeleteModal();
  renderAdminBooks();
  renderStats();
  showToast("Book removed from catalog.");
}

/* ============================================================
   § 9 — PAGE DETECTION & INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("index.html") || path.endsWith("/")) renderHomeCatalog();
  if (path.includes("dashboard.html")) initDashboard();
  if (path.includes("admin.html"))     initAdmin();

  /* Password strength listener */
  const pwdInput = document.getElementById("signupPassword");
  if (pwdInput) {
    pwdInput.addEventListener("input", () => {
      const score  = checkPwdStrength(pwdInput.value);
      const fill   = document.getElementById("pwdStrengthFill");
      const label  = document.getElementById("pwdStrengthLabel");
      const pct    = (score / 5) * 100;
      const colors = ["#dc2626","#f97316","#eab308","#22c55e","#16a34a"];
      const labels = ["Very Weak","Weak","Fair","Strong","Very Strong"];
      fill.style.width      = pct + "%";
      fill.style.background = colors[score - 1] || "#dc2626";
      label.textContent     = pwdInput.value ? labels[score-1] || "Very Weak" : "";
    });
  }
});
