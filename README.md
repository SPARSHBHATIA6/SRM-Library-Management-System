# 📚  SRM Library Management System

A full-stack Library Management System with an **HTML/CSS/JS frontend** and a **C++ OOP backend**.

---

## 📁 Folder Structure

```
library-management/
├── frontend/
│   ├── index.html       ← Home page (browse books)
│   ├── login.html       ← Login page
│   ├── signup.html      ← Registration page
│   ├── dashboard.html   ← User dashboard (borrow/return)
│   ├── admin.html       ← Admin panel (manage catalog)
│   ├── style.css        ← All styles (responsive, themed)
│   └── app.js           ← All frontend logic + API calls
│
├── backend/
│   ├── main.cpp         ← C++ server (Crow framework)
│   ├── books.dat        ← Auto-generated: book storage
│   └── users.dat        ← Auto-generated: user storage
│
└── README.md            ← This file
```

---

## 🎯 OOP Concepts Used

| Concept       | Where Used |
|---------------|------------|
| **Encapsulation** | `Book`, `User`, `Admin` — all data members are `private`, accessed via public getters/setters |
| **Abstraction**   | `IUser` is a pure abstract base class with a pure virtual `getRole()` |
| **Inheritance**   | `User` inherits from `IUser`; `Admin` inherits from `User` |
| **Polymorphism**  | `getRole()` is overridden in `Admin` to return `"admin"` instead of `"user"`; `User*` pointers can hold `Admin*` objects |

### Class Hierarchy

```
IUser  (abstract)
  └── User
        ├── getRole() → "user"
        └── Admin
              └── getRole() → "admin"   ← overrides User

Book           → encapsulates title, author, availability
Library        → manages all Books and Users, handles file I/O
```

---

## 🌐 Request–Response Flow

```
Browser (HTML/JS)           C++ Backend (Crow)         File System
─────────────────           ──────────────────         ───────────
User clicks "Borrow"
  │
  ├─ fetch POST /api/borrow ─→  Find User by ID
  │   { userId, bookId }        Find Book by ID
  │                             book.borrow()          books.dat ← updated
  │                             user.addBorrow()       users.dat ← updated
  │
  ←─ { success: true,       ←──
       message: "Borrowed!" }
  │
  UI updates (badge, button)
```

**Key:** The `simulateAPI()` functions in `app.js` mirror every C++ route.
In production, swap each `simulateAPI()` with the real `fetch()` call.

---

## 🔑 API Routes (C++ Crow Server)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/login` | Authenticate user or admin |
| POST | `/api/register` | Create new user account |
| GET | `/api/books` | Fetch all books |
| POST | `/api/borrow` | User borrows a book |
| POST | `/api/return` | User returns a book |
| POST | `/api/admin/add-book` | Admin adds a book |
| DELETE | `/api/admin/remove-book/:id` | Admin removes a book |

---

## 🧪 Test Cases

### Login Tests
| Input | Expected |
|-------|----------|
| user@demo.com / pass123 / role=user | ✅ Login success → Dashboard |
| admin@demo.com / admin123 / role=admin | ✅ Login success → Admin Panel |
| user@demo.com / wrongpass / role=user | ❌ "Invalid credentials" |
| admin@demo.com / admin123 / role=user | ❌ Role mismatch error |

### Signup Tests
| Input | Expected |
|-------|----------|
| Valid new email | ✅ Account created |
| Existing email | ❌ "Email already registered" |
| Password < 6 chars | ❌ Frontend validation error |
| Passwords don't match | ❌ "Passwords do not match" |

### Borrow Tests
| Scenario | Expected |
|----------|----------|
| Book with copies available | ✅ Borrowed, count decremented |
| Book with 0 copies | ❌ "No copies available" |
| Already borrowed by user | ❌ "Already borrowed" |

---

## 🚀 How to Run

### Option A — Frontend Only (Demo Mode)
The frontend uses **simulated API calls** stored in `localStorage`.
No backend needed!

1. Open `frontend/index.html` in any browser
2. Use demo credentials:
   - User: `user@demo.com` / `pass123`
   - Admin: `admin@demo.com` / `admin123`

### Option B — Full Stack with C++ Backend

#### Step 1: Install Dependencies
```bash
# Install Crow and nlohmann/json (header-only)
git clone https://github.com/CrowCpp/Crow.git
git clone https://github.com/nlohmann/json.git

# Copy headers to backend/
cp -r Crow/include/crow.h backend/
cp json/single_include/nlohmann/json.hpp backend/
```

#### Step 2: Build the C++ Server
```bash
cd backend
g++ -std=c++17 -O2 -pthread main.cpp -o libra_server
./libra_server
# → Server starts on http://localhost:18080
```

#### Step 3: Update Frontend to Use Real API
In `app.js`, replace each `simulateAPI()` function with real fetch calls:

```javascript
// BEFORE (simulation):
async function apiLogin({ email, password, role }) {
  await delay(500);
  const user = USERS.find(...);
  ...
}

// AFTER (real backend):
async function apiLogin({ email, password, role }) {
  const res = await fetch("http://localhost:18080/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role })
  });
  return await res.json();
}
```

#### Step 4: Open the Frontend
Open `frontend/index.html` in a browser (or serve with `python3 -m http.server 8080`).

---

## 💡 Improvements for the Future

1. **Password Hashing** — Use `bcrypt` or `SHA-256` instead of plaintext passwords
2. **JWT Tokens** — Replace `sessionStorage` with signed JWT for secure auth
3. **SQLite/PostgreSQL** — Replace `.dat` files with a real database
4. **Due Date Tracking** — Auto-calculate and notify when books are overdue
5. **Search + Filter** — Advanced search by genre, year, availability
6. **Book Reservations** — Let users queue for unavailable books
7. **Email Notifications** — Send reminders for due dates via SMTP
8. **Docker** — Containerise frontend + backend for easy deployment
9. **HTTPS** — Add TLS via Let's Encrypt for production security
10. **Unit Tests** — Add Google Test for C++ class testing

---

## 🎓 Key Concepts Explained Simply

### What is the C++ backend doing?
Think of the C++ server as a **librarian** sitting behind a counter. When the browser (you) makes a request, the librarian:
1. Reads your request (JSON body)
2. Checks the records (books.dat / users.dat)
3. Processes the action (borrow / return / add)
4. Sends back a JSON response

### What is Crow?
Crow is a tiny C++ library that lets you write web servers the same way Flask does in Python. It maps URLs like `/api/login` to C++ functions.

### Why OOP?
Without OOP, you'd have hundreds of loose functions and global variables. With OOP:
- `Book` knows everything about itself (encapsulation)
- `Admin` IS-A `User` with extra powers (inheritance)
- You can treat Admin and User the same way through `User*` pointers (polymorphism)
