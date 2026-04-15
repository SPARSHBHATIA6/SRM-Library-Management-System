/**
 * ============================================================
 *  LibraNet — C++ Backend
 *  File: backend/main.cpp
 * ============================================================
 *
 *  OOP Principles Used:
 *  ┌────────────────────────────────────────────────────────┐
 *  │ Abstraction   → IUser base class (pure virtual)        │
 *  │ Encapsulation → private data members + public getters  │
 *  │ Inheritance   → Admin extends User                     │
 *  │ Polymorphism  → virtual getRole() overridden in Admin  │
 *  └────────────────────────────────────────────────────────┘
 *
 *  Dependencies:
 *    - Crow   (header-only C++ web framework)
 *    - nlohmann/json (header-only JSON library)
 *
 *  Build:
 *    g++ -std=c++17 -O2 -pthread main.cpp -o libra_server
 *    ./libra_server
 *
 *  Server runs at:  http://localhost:18080
 * ============================================================
 */

#include "crow.h"           // Lightweight C++ web framework
#include "nlohmann/json.hpp" // JSON serialization

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>
#include <stdexcept>

using json = nlohmann::json;

/* ============================================================
   § 1 — BOOK CLASS
   ============================================================
   Encapsulates all book data. Members are private;
   public getters and setters control access.
*/
class Book {
private:
    std::string id;        // Unique book ID e.g. "B001"
    std::string title;
    std::string author;
    std::string genre;
    std::string desc;
    int totalCopies;
    int available;         // copies currently on the shelf

public:
    /* Constructor */
    Book(std::string id, std::string title, std::string author,
         std::string genre, std::string desc, int copies)
        : id(id), title(title), author(author),
          genre(genre), desc(desc),
          totalCopies(copies), available(copies) {}

    /* ── Getters ── */
    std::string getId()     const { return id; }
    std::string getTitle()  const { return title; }
    std::string getAuthor() const { return author; }
    std::string getGenre()  const { return genre; }
    std::string getDesc()   const { return desc; }
    int getCopies()         const { return totalCopies; }
    int getAvailable()      const { return available; }

    /* ── Borrow / Return logic ── */
    bool borrow() {
        if (available < 1) return false;
        available--;
        return true;
    }

    bool returnBook() {
        if (available >= totalCopies) return false;
        available++;
        return true;
    }

    /* ── Serialization to JSON (for API responses) ── */
    json toJson() const {
        return {
            {"id",        id},
            {"title",     title},
            {"author",    author},
            {"genre",     genre},
            {"desc",      desc},
            {"copies",    totalCopies},
            {"available", available}
        };
    }

    /* ── File I/O helpers ── */
    // Serialize to CSV line: id|title|author|genre|copies|available|desc
    std::string toFileLine() const {
        return id + "|" + title + "|" + author + "|" + genre + "|" +
               std::to_string(totalCopies) + "|" + std::to_string(available) + "|" + desc;
    }

    // Parse from CSV line
    static Book fromFileLine(const std::string& line) {
        std::vector<std::string> parts;
        std::stringstream ss(line);
        std::string token;
        while (std::getline(ss, token, '|')) parts.push_back(token);
        if (parts.size() < 7) throw std::runtime_error("Bad book line");

        Book b(parts[0], parts[1], parts[2], parts[3], parts[6],
               std::stoi(parts[4]));
        b.available = std::stoi(parts[5]); // restore persisted availability
        return b;
    }
};


/* ============================================================
   § 2 — ABSTRACT BASE CLASS: IUser  (Abstraction)
   ============================================================
   Pure virtual getRole() forces every subclass to declare
   its role type — cannot instantiate IUser directly.
*/
class IUser {
public:
    virtual std::string getRole() const = 0; // pure virtual
    virtual ~IUser() = default;
};


/* ============================================================
   § 3 — USER CLASS  (Encapsulation + Inheritance)
   ============================================================
*/
class User : public IUser {
protected:
    std::string id;
    std::string name;
    std::string email;
    std::string password;           // stored hashed in production
    std::vector<std::string> borrowedBookIds;

public:
    User(std::string id, std::string name,
         std::string email, std::string password)
        : id(id), name(name), email(email), password(password) {}

    /* ── Polymorphism: overridden in Admin ── */
    virtual std::string getRole() const override { return "user"; }

    /* ── Getters ── */
    std::string getId()       const { return id; }
    std::string getName()     const { return name; }
    std::string getEmail()    const { return email; }
    std::string getPassword() const { return password; }

    const std::vector<std::string>& getBorrowed() const { return borrowedBookIds; }

    /* ── Business logic ── */
    bool hasBorrowed(const std::string& bookId) const {
        return std::find(borrowedBookIds.begin(), borrowedBookIds.end(), bookId)
               != borrowedBookIds.end();
    }

    bool addBorrow(const std::string& bookId) {
        if (hasBorrowed(bookId)) return false;
        borrowedBookIds.push_back(bookId);
        return true;
    }

    bool removeBorrow(const std::string& bookId) {
        auto it = std::find(borrowedBookIds.begin(), borrowedBookIds.end(), bookId);
        if (it == borrowedBookIds.end()) return false;
        borrowedBookIds.erase(it);
        return true;
    }

    /* ── Serialization ── */
    json toJson() const {
        json borrowed = json::array();
        for (auto& bid : borrowedBookIds) borrowed.push_back(bid);
        return {
            {"id",       id},
            {"name",     name},
            {"email",    email},
            {"role",     getRole()},
            {"borrowed", borrowed}
        };
    }

    // File line: id|name|email|password|role|B001,B002
    virtual std::string toFileLine() const {
        std::string bids;
        for (size_t i = 0; i < borrowedBookIds.size(); ++i) {
            if (i > 0) bids += ",";
            bids += borrowedBookIds[i];
        }
        return id + "|" + name + "|" + email + "|" + password + "|" + getRole() + "|" + bids;
    }
};


/* ============================================================
   § 4 — ADMIN CLASS  (Inheritance + Polymorphism)
   ============================================================
   Admin extends User — inherits all user capabilities and
   overrides getRole(). Adds book management operations.
*/
class Admin : public User {
public:
    Admin(std::string id, std::string name,
          std::string email, std::string password)
        : User(id, name, email, password) {}

    /* ── Polymorphism: override getRole() ── */
    std::string getRole() const override { return "admin"; }

    /* Admin-only operations — these are called from the Crow routes */

    static bool addBook(std::vector<Book>& library, const Book& book) {
        // Check for duplicate ID
        for (auto& b : library) {
            if (b.getId() == book.getId()) return false;
        }
        library.push_back(book);
        return true;
    }

    static bool removeBook(std::vector<Book>& library, const std::string& bookId) {
        auto it = std::find_if(library.begin(), library.end(),
                               [&](const Book& b){ return b.getId() == bookId; });
        if (it == library.end()) return false;
        library.erase(it);
        return true;
    }
};


/* ============================================================
   § 5 — LIBRARY CLASS  (Database / Storage)
   ============================================================
   Manages all books and users. Handles file I/O for
   persistence between server restarts.
*/
class Library {
private:
    std::vector<Book>   books;
    std::vector<User*>  users;  // polymorphic: User* or Admin*
    std::string booksFile = "books.dat";
    std::string usersFile = "users.dat";

public:
    Library() {
        loadBooks();
        loadUsers();
        // Seed default data if files are empty
        if (books.empty()) seedBooks();
        if (users.empty()) seedUsers();
    }

    ~Library() {
        for (auto u : users) delete u;
    }

    /* ── Seed default data ── */
    void seedBooks() {
        books = {
            Book("B001","The Great Gatsby",      "F. Scott Fitzgerald","Fiction",    "Wealth & obsession.",           3),
            Book("B002","1984",                  "George Orwell",      "Fiction",    "Totalitarian future.",          4),
            Book("B003","To Kill a Mockingbird", "Harper Lee",         "Fiction",    "Racial injustice.",             2),
            Book("B004","Dune",                  "Frank Herbert",      "Fantasy",    "Epic desert planet saga.",      3),
            Book("B005","A Brief History of Time","Stephen Hawking",   "Science",    "Cosmology for everyone.",       2),
            Book("B006","Sapiens",               "Yuval Noah Harari",  "History",    "History of humankind.",         3),
            Book("B007","The Alchemist",         "Paulo Coelho",       "Fiction",    "Follow your dreams.",           5),
            Book("B008","Clean Code",            "Robert C. Martin",   "Technology", "Writing maintainable software.",2),
        };
        saveBooks();
    }

    void seedUsers() {
        users.push_back(new User ("U001","Alice Johnson","user@demo.com", "pass123"));
        users.push_back(new Admin("U002","Bob Smith",    "admin@demo.com","admin123"));
        saveUsers();
    }

    /* ── File I/O ── */
    void saveBooks() {
        std::ofstream f(booksFile);
        for (auto& b : books) f << b.toFileLine() << "\n";
    }

    void loadBooks() {
        std::ifstream f(booksFile);
        std::string line;
        while (std::getline(f, line)) {
            if (!line.empty()) {
                try { books.push_back(Book::fromFileLine(line)); }
                catch (...) {}
            }
        }
    }

    void saveUsers() {
        std::ofstream f(usersFile);
        for (auto u : users) f << u->toFileLine() << "\n";
    }

    void loadUsers() {
        std::ifstream f(usersFile);
        std::string line;
        while (std::getline(f, line)) {
            if (line.empty()) continue;
            std::vector<std::string> p;
            std::stringstream ss(line);
            std::string tok;
            while (std::getline(ss, tok, '|')) p.push_back(tok);
            if (p.size() < 5) continue;

            User* u;
            if (p[4] == "admin") u = new Admin(p[0],p[1],p[2],p[3]);
            else                 u = new User (p[0],p[1],p[2],p[3]);

            // Restore borrowed list (comma-separated book IDs)
            if (p.size() > 5 && !p[5].empty()) {
                std::stringstream bs(p[5]);
                std::string bid;
                while (std::getline(bs, bid, ',')) u->addBorrow(bid);
            }
            users.push_back(u);
        }
    }

    /* ── Lookups ── */
    Book* findBook(const std::string& id) {
        for (auto& b : books) if (b.getId() == id) return &b;
        return nullptr;
    }

    User* findUserByEmail(const std::string& email) {
        for (auto u : users) if (u->getEmail() == email) return u;
        return nullptr;
    }

    User* findUserById(const std::string& id) {
        for (auto u : users) if (u->getId() == id) return u;
        return nullptr;
    }

    /* ── Expose collections ── */
    std::vector<Book>&  getBooks() { return books; }
    std::vector<User*>& getUsers() { return users; }

    /* ── Next IDs ── */
    std::string nextBookId() {
        return "B" + std::string(3 - std::to_string(books.size()+1).size(), '0')
               + std::to_string(books.size()+1);
    }
    std::string nextUserId() {
        return "U" + std::string(3 - std::to_string(users.size()+1).size(), '0')
               + std::to_string(users.size()+1);
    }
};


/* ============================================================
   § 6 — CROW HTTP SERVER
   ============================================================
   Maps URLs to C++ handler functions.
   CORS headers allow the HTML frontend to call these routes.

   Routes:
     POST /api/login          → authenticate user
     POST /api/register       → create new user
     GET  /api/books          → list all books
     POST /api/borrow         → borrow a book
     POST /api/return         → return a book
     POST /api/admin/add-book → admin adds a book
     DELETE /api/admin/remove-book/:id → admin removes book
*/
int main() {
    crow::SimpleApp app;
    Library lib;

    /* ── Helper: JSON response ── */
    auto jsonResp = [](int code, json body) {
        crow::response res(code, body.dump());
        res.set_header("Content-Type", "application/json");
        res.set_header("Access-Control-Allow-Origin", "*"); // CORS
        return res;
    };

    /* ────────────────────────────
       POST /api/login
       Body: { email, password, role }
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/login").methods("POST"_method)
    ([&](const crow::request& req) {
        auto body = json::parse(req.body, nullptr, false);
        if (body.is_discarded())
            return jsonResp(400, {{"success",false},{"message","Invalid JSON"}});

        std::string email    = body.value("email", "");
        std::string password = body.value("password", "");
        std::string role     = body.value("role", "user");

        User* user = lib.findUserByEmail(email);
        if (!user || user->getPassword() != password || user->getRole() != role)
            return jsonResp(401, {{"success",false},
                                  {"message","Invalid credentials."}});

        return jsonResp(200, {{"success",true},{"user", user->toJson()}});
    });

    /* ────────────────────────────
       POST /api/register
       Body: { name, email, password }
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/register").methods("POST"_method)
    ([&](const crow::request& req) {
        auto body = json::parse(req.body, nullptr, false);
        std::string name     = body.value("name", "");
        std::string email    = body.value("email", "");
        std::string password = body.value("password", "");

        if (lib.findUserByEmail(email))
            return jsonResp(409, {{"success",false},
                                  {"message","Email already registered."}});

        User* newUser = new User(lib.nextUserId(), name, email, password);
        lib.getUsers().push_back(newUser);
        lib.saveUsers();

        return jsonResp(201, {{"success",true},{"user", newUser->toJson()}});
    });

    /* ────────────────────────────
       GET /api/books
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/books").methods("GET"_method)
    ([&]() {
        json arr = json::array();
        for (auto& b : lib.getBooks()) arr.push_back(b.toJson());
        return crow::response(200, arr.dump());
    });

    /* ────────────────────────────
       POST /api/borrow
       Body: { userId, bookId }
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/borrow").methods("POST"_method)
    ([&](const crow::request& req) {
        auto body = json::parse(req.body, nullptr, false);
        std::string userId = body.value("userId", "");
        std::string bookId = body.value("bookId", "");

        User* user = lib.findUserById(userId);
        Book* book = lib.findBook(bookId);

        if (!user || !book)
            return jsonResp(404, {{"success",false},{"message","Not found."}});
        if (user->hasBorrowed(bookId))
            return jsonResp(400, {{"success",false},{"message","Already borrowed."}});
        if (!book->borrow())
            return jsonResp(400, {{"success",false},{"message","No copies available."}});

        user->addBorrow(bookId);
        lib.saveBooks(); lib.saveUsers();

        return jsonResp(200, {{"success",true},{"message","Book borrowed successfully!"}});
    });

    /* ────────────────────────────
       POST /api/return
       Body: { userId, bookId }
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/return").methods("POST"_method)
    ([&](const crow::request& req) {
        auto body = json::parse(req.body, nullptr, false);
        std::string userId = body.value("userId", "");
        std::string bookId = body.value("bookId", "");

        User* user = lib.findUserById(userId);
        Book* book = lib.findBook(bookId);

        if (!user || !book)
            return jsonResp(404, {{"success",false},{"message","Not found."}});

        book->returnBook();
        user->removeBorrow(bookId);
        lib.saveBooks(); lib.saveUsers();

        return jsonResp(200, {{"success",true},{"message","Book returned!"}});
    });

    /* ────────────────────────────
       POST /api/admin/add-book
       Body: { title, author, genre, copies, desc }
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/admin/add-book").methods("POST"_method)
    ([&](const crow::request& req) {
        auto body = json::parse(req.body, nullptr, false);
        std::string title  = body.value("title", "");
        std::string author = body.value("author", "");
        std::string genre  = body.value("genre", "Fiction");
        std::string desc   = body.value("desc", "");
        int copies         = body.value("copies", 1);

        if (title.empty() || author.empty())
            return jsonResp(400, {{"success",false},{"message","Title and author required."}});

        Book newBook(lib.nextBookId(), title, author, genre, desc, copies);
        Admin::addBook(lib.getBooks(), newBook);
        lib.saveBooks();

        return jsonResp(201, {{"success",true},{"book", newBook.toJson()}});
    });

    /* ────────────────────────────
       DELETE /api/admin/remove-book/:id
       ──────────────────────────── */
    CROW_ROUTE(app, "/api/admin/remove-book/<string>").methods("DELETE"_method)
    ([&](const std::string& bookId) {
        bool removed = Admin::removeBook(lib.getBooks(), bookId);
        lib.saveBooks();
        if (!removed)
            return jsonResp(404, {{"success",false},{"message","Book not found."}});
        return jsonResp(200, {{"success",true}});
    });

    std::cout << "✅ LibraNet backend running on http://localhost:18080\n";
    app.port(18080).multithreaded().run();
    return 0;
}
