#!/usr/bin/env node
// Regression checks for the API fixes. Run against a live API:
//   node scripts/verify-fixes.mjs            (defaults to http://localhost:3001)
//   API=http://host:port node scripts/verify-fixes.mjs
// Each check prints its ID, what was expected, what actually happened, and PASS/FAIL.
// Exits non-zero if any check fails.

const API = process.env.API ?? "http://localhost:3001";
const ORIGIN = "http://localhost:5173";
const run = Date.now().toString(36); // unique emails per run (DB is in-memory, but may be long-lived)

const results = [];

async function call(method, path, { body, token, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

function check(id, area, description, expected, actual, pass) {
  results.push({ id, area, description, expected, actual, pass: Boolean(pass) });
}

const short = (v) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 90 ? s.slice(0, 87) + "..." : s;
};

async function register(name) {
  const r = await call("POST", "/auth/register", {
    body: { username: name, email: `${name}.${run}@example.com`, password: "password123" },
  });
  return { token: r.body.token, user: r.body.user, email: `${name}.${run}@example.com` };
}

const names = (r) => (Array.isArray(r.body) ? r.body.map((p) => p.name) : []);
const prices = (r) => (Array.isArray(r.body) ? r.body.map((p) => p.price) : []);

async function main() {
  // ---------- Health / CORS ----------
  {
    const r = await call("GET", "/health");
    check("H1", "Infra", "Health endpoint", "200 {status:ok}", `${r.status} ${short(r.body)}`, r.status === 200 && r.body.status === "ok");

    const pre = await fetch(API + "/cart/x", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "DELETE" },
    });
    const allowed = pre.headers.get("access-control-allow-methods") ?? "";
    check("X1", "CORS", "Browser preflight allows DELETE", "allow-methods includes DELETE", allowed, /DELETE/.test(allowed));
  }

  // ---------- Auth & validation ----------
  {
    let r = await call("POST", "/auth/register", { body: { username: "   ", email: `ws.${run}@example.com`, password: "password123" } });
    check("A1", "Validation", "Register with whitespace-only username", "400", `${r.status} ${short(r.body)}`, r.status === 400);

    r = await call("POST", "/auth/register", { body: { username: "<script>", email: `xss.${run}@example.com`, password: "password123" } });
    check("A2", "Validation", "Register with disallowed username characters", "400", `${r.status}`, r.status === 400);

    const mixed = `  Mixed.${run}@Example.COM `;
    r = await call("POST", "/auth/register", { body: { username: "mixed", email: mixed, password: "password123" } });
    check("A3", "Validation", "Register trims + lowercases email", `201, email=mixed.${run}@example.com`, `${r.status} ${r.body?.user?.email}`, r.status === 201 && r.body.user.email === `mixed.${run}@example.com`);

    r = await call("POST", "/auth/register", { body: { username: "mixed2", email: `MIXED.${run}@example.com`, password: "password123" } });
    check("A4", "Validation", "Duplicate email with different case rejected", "409", `${r.status}`, r.status === 409);

    r = await call("POST", "/auth/register", { body: { username: "longpw", email: `longpw.${run}@example.com`, password: "a".repeat(200) } });
    check("A5", "Validation", "Password longer than 128 chars rejected", "400", `${r.status}`, r.status === 400);

    r = await call("POST", "/auth/register", { body: { username: "shortpw", email: `shortpw.${run}@example.com`, password: "123" } });
    check("A6", "Validation", "Password shorter than 6 chars rejected", "400", `${r.status}`, r.status === 400);

    r = await call("POST", "/auth/login", { body: { email: `mixed.${run}@example.com`, password: "" } });
    check("A7", "Validation", "Login with empty password", "400 'Password is required'", `${r.status} ${short(r.body)}`, r.status === 400);

    r = await call("POST", "/auth/login", { body: { email: `mixed.${run}@example.com`, password: "wrong-password" } });
    check("A8", "Auth", "Login with wrong password", "401", `${r.status}`, r.status === 401);

    r = await call("POST", "/auth/login", { body: { email: ` MIXED.${run}@example.com`, password: "password123" } });
    check("A9", "Auth", "Login response includes username (same shape as register)", "200, user.username='mixed'", `${r.status} ${short(r.body?.user)}`, r.status === 200 && r.body.user?.username === "mixed");
    const token = r.body.token;

    check("A10", "Auth", "User ids are not sequential (no 'user-1' reuse after restart)", "user-<uuid>", r.body.user?.id, /^user-[0-9a-f-]{36}$/.test(r.body.user?.id ?? ""));

    r = await call("GET", "/auth/me");
    check("A11", "Auth", "/auth/me without token", "401", `${r.status}`, r.status === 401);

    r = await call("GET", "/auth/me", { token });
    check("A12", "Auth", "/auth/me with valid token", "200 with username", `${r.status} ${short(r.body)}`, r.status === 200 && r.body.username === "mixed");

    r = await call("GET", "/favorites", { token: "not-a-jwt" });
    check("A13", "Auth", "Protected route with invalid token", "401", `${r.status}`, r.status === 401);
  }

  // ---------- Favorites ----------
  {
    const { token } = await register(`fav${run}`.slice(0, 20));

    let r = await call("GET", "/favorites");
    check("F1", "Favorites", "GET /favorites without token (was the QA-reported 500)", "401", `${r.status} ${short(r.body)}`, r.status === 401);

    r = await call("GET", "/favorites", { token });
    check("F2", "Favorites", "GET /favorites with token, empty list", "200 {favorites:[]}", `${r.status} ${short(r.body)}`, r.status === 200 && Array.isArray(r.body.favorites) && r.body.favorites.length === 0);

    r = await call("POST", "/favorites", { token });
    check("F3", "Favorites", "POST /favorites with no body", "400", `${r.status} ${short(r.body)}`, r.status === 400);

    r = await call("POST", "/favorites", { token, body: { personaId: "p-004" } });
    const list = await call("GET", "/favorites", { token });
    check("F4", "Favorites", "Add favorite then list it", "200, list=[p-004]", `${r.status}, list=${short(list.body.favorites?.map((p) => p.id))}`, r.status === 200 && list.body.favorites?.length === 1 && list.body.favorites[0].id === "p-004");

    r = await call("POST", "/favorites", { token, body: { personaId: "p-999" } });
    check("F5", "Favorites", "Favorite an unknown persona", "404", `${r.status}`, r.status === 404);

    r = await call("DELETE", "/favorites/p-004", { token });
    const again = await call("DELETE", "/favorites/p-004", { token });
    check("F6", "Favorites", "Remove favorite, then remove again", "200 then 404", `${r.status} then ${again.status}`, r.status === 200 && again.status === 404);
  }

  // ---------- Cart ----------
  {
    const alice = await register(`alice${run}`.slice(0, 20));
    const victim = await register(`victim${run}`.slice(0, 20));

    let r = await call("POST", "/cart", { token: victim.token, body: { personaId: "p-001" } });
    const victimItem = r.body.items?.[0]?.id;
    r = await call("DELETE", `/cart/${victimItem}`, { token: alice.token });
    const victimCart = await call("GET", "/cart", { token: victim.token });
    check("C1", "Cart", "User A deletes user B's cart item (IDOR)", "404, B's item still there", `${r.status}, B has ${victimCart.body.items?.length} item(s)`, r.status === 404 && victimCart.body.items?.length === 1);

    r = await call("DELETE", `/cart/${victimItem}`, { token: victim.token });
    check("C2", "Cart", "Owner deletes own cart item", "200, cart empty", `${r.status}, ${r.body.items?.length} item(s)`, r.status === 200 && r.body.items?.length === 0);

    r = await call("GET", "/cart");
    check("C3", "Cart", "GET /cart without token", "401", `${r.status}`, r.status === 401);

    r = await call("POST", "/cart", { token: alice.token, body: { personaId: "p-001", quantity: 1_000_000_000 } });
    check("C4", "Cart", "Add quantity 1,000,000,000", "400 (max 99)", `${r.status} ${short(r.body)}`, r.status === 400);

    await call("POST", "/cart", { token: alice.token, body: { personaId: "p-001", quantity: 98 } });
    r = await call("POST", "/cart", { token: alice.token, body: { personaId: "p-001", quantity: 2 } });
    const r2 = await call("POST", "/cart", { token: alice.token, body: { personaId: "p-001", quantity: 1 } });
    check("C5", "Cart", "Merged quantity capped: 98+2 rejected, 98+1 accepted", "400, then 200 qty=99", `${r.status}, then ${r2.status} qty=${r2.body.items?.[0]?.quantity}`, r.status === 400 && r2.status === 200 && r2.body.items?.[0]?.quantity === 99);

    const itemId = r2.body.items?.[0]?.id;
    r = await call("PUT", `/cart/${itemId}`, { token: alice.token, body: { quantity: Number.MAX_SAFE_INTEGER } });
    check("C6", "Cart", "PUT quantity 2^53-1", "400", `${r.status}`, r.status === 400);

    r = await call("PUT", `/cart/${itemId}`, { token: alice.token, body: { quantity: 0 } });
    check("C7", "Cart", "PUT quantity 0", "400", `${r.status}`, r.status === 400);

    r = await call("PUT", `/cart/${itemId}`, { token: alice.token, body: { quantity: 2 } });
    check("C8", "Cart", "PUT quantity 2, total recomputed", "200, total=99.98", `${r.status}, total=${r.body.total}`, r.status === 200 && r.body.total === 99.98);

    // ---------- Checkout ----------
    r = await call("POST", "/checkout", { token: alice.token, body: { name: "   ", email: "a@example.com" } });
    check("K1", "Checkout", "Checkout with whitespace-only name", "400 'Name is required'", `${r.status} ${short(r.body)}`, r.status === 400);

    r = await call("POST", "/checkout", { token: alice.token, body: { name: "  Jane Doe ", email: " jane@example.com " } });
    check("K2", "Checkout", "Checkout trims name and email", "201, 'Jane Doe' / 'jane@example.com'", `${r.status}, '${r.body.customerName}' / '${r.body.customerEmail}'`, r.status === 201 && r.body.customerName === "Jane Doe" && r.body.customerEmail === "jane@example.com");
    check("K3", "Checkout", "Order total matches cart", "99.98", `${r.body.total}`, r.body.total === 99.98);

    const after = await call("GET", "/cart", { token: alice.token });
    check("K4", "Checkout", "Cart is emptied after checkout", "0 items", `${after.body.items?.length} items`, after.body.items?.length === 0);

    r = await call("POST", "/checkout", { token: alice.token, body: { name: "Jane", email: "jane@example.com" } });
    check("K5", "Checkout", "Second checkout of the same cart", "400 'Cart is empty'", `${r.status} ${short(r.body)}`, r.status === 400);
  }

  // ---------- Personas: search / filters ----------
  {
    let r = await call("GET", "/personas");
    check("P1", "Personas", "List all", "15 personas", `${r.body.length}`, r.body.length === 15);

    r = await call("GET", "/personas?q=security");
    check("P2", "Search", "q=security", "includes Zero-Day Zara", short(names(r)), names(r).includes("Zero-Day Zara"));

    r = await call("GET", "/personas?q=devops");
    check("P3", "Search", "q=devops matches DevOps specialty", "Pipeline Pete, Terraform Tina", short(names(r)), names(r).includes("Pipeline Pete") && names(r).includes("Terraform Tina"));

    r = await call("GET", "/personas?specialty=Security");
    check("P4", "Filter", "specialty=Security", "2 results, all Security", `${r.body.length}: ${short(names(r))}`, r.body.length === 2 && r.body.every((p) => p.specialty === "Security"));

    r = await call("GET", "/personas?specialty=Engineering&tier=Pro");
    check("P5", "Filter", "specialty=Engineering&tier=Pro (combined)", "3 results, all Engineering+Pro", `${r.body.length}: ${short(names(r))}`, r.body.length === 3 && r.body.every((p) => p.specialty === "Engineering" && p.tier === "Pro"));

    r = await call("GET", "/personas?minPrice=90");
    check("P6", "Filter", "minPrice=90", "only prices >= 90", short(prices(r)), r.body.length > 0 && prices(r).every((p) => p >= 90));

    r = await call("GET", "/personas?minPrice=60&maxPrice=70");
    check("P7", "Filter", "minPrice=60&maxPrice=70", "only 60 <= price <= 70", short(prices(r)), r.body.length > 0 && prices(r).every((p) => p >= 60 && p <= 70));

    r = await call("GET", "/personas?sort=price-asc");
    const asc = prices(r);
    check("P8", "Sort", "sort=price-asc", "ascending prices", short(asc), asc.every((p, i) => i === 0 || asc[i - 1] <= p));

    r = await call("GET", "/personas?minPrice=abc");
    check("P9", "Validation", "minPrice=abc", "400", `${r.status}`, r.status === 400);

    r = await call("GET", "/personas?specialty=Marketing");
    check("P10", "Validation", "Unknown specialty", "400", `${r.status}`, r.status === 400);

    r = await call("GET", "/personas/p-001");
    check("P11", "Personas", "GET /personas/p-001", "200 Refactor Rex", `${r.status} ${r.body.name}`, r.status === 200 && r.body.name === "Refactor Rex");

    r = await call("GET", "/personas/p-999");
    check("P12", "Personas", "GET unknown persona", "404", `${r.status}`, r.status === 404);
  }

  // ---------- Report ----------
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nAPI: ${API}\n`);
  console.log(pad("ID", 5), pad("Result", 7), pad("Area", 11), pad("Check", 58), pad("Expected", 36), "Actual");
  console.log("-".repeat(160));
  for (const r of results) {
    console.log(pad(r.id, 5), pad(r.pass ? "PASS" : "FAIL", 7), pad(r.area, 11), pad(r.description, 58), pad(r.expected, 36), r.actual);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`Could not reach ${API}: ${err.message}`);
  process.exit(2);
});
