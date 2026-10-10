/* DRIPCTRL × Supabase — real sign-in, orders, tracking, email list and contact messages.
   Loads after the main inline script and replaces its browser-only (demo) handlers.
   If Supabase isn't configured, the site keeps working in demo mode. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = await fetch("/api/config").then(r => (r.ok ? r.json() : {})).catch(() => ({}));
if (cfg.url && cfg.anonKey) start(createClient(cfg.url, cfg.anonKey));

function start(sb) {
  CFG.demo = false;
  orders = [];
  let otp = null; // {email} or {phone} while waiting for a code

  const toOrder = o => ({ id: o.id, date: new Date(o.created_at).toLocaleString("en-IN"), items: o.items, total: o.total, status: o.status, user: user && user.id });
  const fail = (el, err, fallback) => { el.textContent = (err && err.message) || fallback; };

  /* ---------- session ---------- */
  async function loadUser(su) {
    const meta = su.user_metadata || {};
    let { data: prof } = await sb.from("profiles").select("username,pic").eq("id", su.id).maybeSingle();
    if (!prof) {
      const username = (meta.username || (su.email || "").split("@")[0] || "Drip").slice(0, 40).padEnd(2, "_");
      prof = { username, pic: null };
      await sb.from("profiles").insert({ id: su.id, username });
    }
    user = { uid: su.id, id: su.email || "+91 " + String(su.phone || "").slice(-10), name: prof.username, pic: prof.pic, type: su.email ? "g" : "m" };
    const { data: rows } = await sb.from("orders").select("*").order("created_at", { ascending: false });
    orders = (rows || []).map(toOrder);
    chip();
    if ($("#au").classList.contains("on")) {
      $("#au").classList.remove("on");
      if (pend) { pend = false; placeOrder(); } else openProfile();
    }
  }
  sb.auth.onAuthStateChange((ev, session) => {
    // Defer Supabase calls out of the auth callback, as the SDK recommends.
    setTimeout(() => {
      if (session) { if (!user || user.uid !== session.user.id) loadUser(session.user); }
      else { user = null; orders = []; chip(); }
    });
  });
  user = null; chip();

  /* ---------- sign in / sign up (one-time code or email link) ---------- */
  const code = document.createElement("input");
  code.id = "aotp"; code.placeholder = "6-digit code"; code.inputMode = "numeric"; code.autocomplete = "one-time-code"; code.style.display = "none";
  $("#ago").before(code);

  const baseAuthUI = authUI;
  authUI = msg => { otp = null; code.style.display = "none"; code.value = ""; $("#ai").style.display = ""; $("#ago").textContent = "Continue"; baseAuthUI(msg); };

  $("#ago").onclick = async () => {
    const e = $("#ae"), btn = $("#ago");
    e.textContent = "";
    if (otp) {
      const token = code.value.trim();
      if (!/^\d{6}$/.test(token)) { e.textContent = "Enter the 6-digit code."; return; }
      btn.disabled = true;
      const { error } = await sb.auth.verifyOtp(otp.email ? { email: otp.email, token, type: "email" } : { phone: otp.phone, token, type: "sms" });
      btn.disabled = false;
      if (error) fail(e, error, "That code didn't work. Try again.");
      return;
    }
    const name = $("#un").value.trim(), v = $("#ai").value.trim();
    if (am === "up" && name.length < 2) { e.textContent = "Choose a username."; return; }
    if (ay === "g" && !/^[^@\s]+@gmail\.com$/i.test(v)) { e.textContent = "Enter a valid Gmail address."; return; }
    if (ay === "m" && !/^[6-9]\d{9}$/.test(v)) { e.textContent = "Enter a valid 10-digit mobile number."; return; }
    const target = ay === "g" ? { email: v.toLowerCase() } : { phone: "+91" + v };
    const options = { shouldCreateUser: am === "up", data: am === "up" ? { username: name } : undefined, emailRedirectTo: location.origin };
    btn.disabled = true; btn.textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ ...target, options });
    btn.disabled = false; btn.textContent = "Continue";
    if (error) {
      if (/signups? not allowed|not found/i.test(error.message) && am === "in") e.textContent = "No account found. Sign up first.";
      else if (ay === "m" && /sms|phone|provider/i.test(error.message)) e.textContent = "Mobile sign-in isn't available yet. Please use Gmail.";
      else fail(e, error, "Couldn't send the code. Try again.");
      return;
    }
    otp = target;
    $("#am").textContent = ay === "g" ? `We emailed ${target.email}. Enter the code or tap the link in the email.` : `We sent a code to +91 ${v}.`;
    $("#un").style.display = "none"; $("#ai").style.display = "none"; code.style.display = ""; code.focus();
    btn.textContent = "Verify";
  };

  /* ---------- profile ---------- */
  const baseProfile = openProfile;
  openProfile = msg => {
    baseProfile(msg);
    if (!user) return;
    $("#pfi").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.onload = async () => {
          const c = document.createElement("canvas"); c.width = c.height = 160;
          const s = Math.min(im.width, im.height);
          c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 160, 160);
          const pic = c.toDataURL("image/jpeg", .8);
          const { error } = await sb.from("profiles").update({ pic, updated_at: new Date().toISOString() }).eq("id", user.uid);
          if (!error) { user.pic = pic; chip(); openProfile(); }
        };
        im.src = r.result;
      };
      r.readAsDataURL(f);
    };
    $("#lo").onclick = async () => { await sb.auth.signOut(); user = null; orders = []; chip(); cM(); };
  };

  /* ---------- orders ---------- */
  placeOrder = async () => {
    if (!cart.length || !user) return;
    const { data, error } = await sb.rpc("place_order", { items: cart.map(l => ({ id: l.id, size: l.size, qty: l.qty })) });
    if (error) { openD("c"); $("#foot").insertAdjacentHTML("beforeend", `<p class="note" style="color:#e66">${esc(error.message || "Couldn't place the order. Try again.")}</p>`); return; }
    orders.unshift(toOrder(data)); cart = []; save(); upd(); closeD();
    $("#lkid").textContent = data.id; $("#lk").classList.add("on");
  };

  /* ---------- tracking + contact ---------- */
  const baseOpenM = openM;
  openM = k => {
    baseOpenM(k);
    if (k === "track") $("#tgo").onclick = async () => {
      const v = $("#tid").value.trim().toUpperCase(), out = $("#tres");
      if (!v) return;
      out.innerHTML = "<p>Looking up your order…</p>";
      const { data: o, error } = await sb.rpc("track_order", { order_id: v });
      if (error) { out.innerHTML = "<p>Couldn't look that up right now. Try again.</p>"; return; }
      out.innerHTML = o ? `<table><tr><th>Order</th><td>${esc(o.id)}</td></tr><tr><th>Status</th><td>${esc(o.status)}</td></tr><tr><th>Placed</th><td>${new Date(o.created_at).toLocaleString("en-IN")}</td></tr><tr><th>Total</th><td>${inr(o.total)}</td></tr><tr><th>Items</th><td>${o.items.map(i => esc((pr(i.id) || { name: i.id }).name) + " · " + esc(i.size) + " × " + i.qty).join("<br>")}</td></tr></table>` : "<p>No order found with that ID. Check it and try again.</p>";
    };
    if (k === "contact") $("#cs").onclick = async () => {
      const name = $("#cn").value.trim(), email = $("#ce").value.trim(), message = $("#cm").value.trim(), r = $("#cr");
      if (!message) { r.textContent = "Write a message first."; return; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { r.textContent = "Enter a valid email so we can reply."; return; }
      $("#cs").disabled = true;
      const { error } = await sb.from("contact_messages").insert({ name: name || null, email: email || null, message });
      $("#cs").disabled = false;
      if (error) { r.textContent = "Couldn't send right now. Please try again or message @dripctrlwear on Instagram."; return; }
      r.textContent = "Message sent. We'll get back to you soon."; $("#cn").value = $("#ce").value = $("#cm").value = "";
    };
  };

  /* ---------- email list ---------- */
  $("#sf").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, email = f.querySelector("input").value.trim().toLowerCase();
    const { error } = await sb.from("subscribers").insert({ email });
    if (error && error.code !== "23505") { $("#sm").textContent = "Couldn't subscribe right now. Try again."; return; }
    $("#sm").textContent = "You're on the list."; f.reset();
  };
}
