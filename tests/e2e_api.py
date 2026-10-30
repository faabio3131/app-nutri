"""Teste ponta a ponta da API NutriSnap. Uso: python3 tests/e2e_api.py (API em :18080, Gemini falso em :18081, segredo do webhook = test-secret)."""
import json, time, hmac, hashlib, uuid, sys, urllib.request, urllib.error
API = "http://127.0.0.1:18080/api/v1"; FAKE = "http://127.0.0.1:18081"; SECRET = "test-secret"
ok = bad = 0
def check(name, cond, extra=""):
    global ok, bad
    if cond: ok += 1; print("  PASS", name)
    else: bad += 1; print("  FAIL", name, extra)
def call(method, path, body=None, token=None, headers=None, raw=None, base=API):
    h = dict(headers or {}); data = raw
    if body is not None: data = json.dumps(body).encode(); h["Content-Type"] = "application/json"
    if token: h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp: return resp.status, json.loads(resp.read() or b"{}"), resp.headers
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}"), e.headers
        except Exception: return e.code, {}, e.headers
JPG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300") + b"\x00" * 200 + b"\xff\xd9"
def analyze(token, img=JPG, ctype="image/jpeg"):
    b = "----t" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a.jpg\"\r\nContent-Type: {ctype}\r\n\r\n").encode() + img + f"\r\n--{b}--\r\n".encode()
    return call("POST", "/meals/analyze", raw=body, token=token, headers={"Content-Type": "multipart/form-data; boundary=" + b})
def signup(email=None, pw="senha-segura-1"):
    email = email or f"u{uuid.uuid4().hex[:10]}@teste.com"
    s, d, _ = call("POST", "/auth/signup", {"name": "Teste", "email": email, "password": pw, "accept_terms": True})
    return email, pw, d.get("token"), s
def hook(event, email, oid, price=49.9, status="paid", secret=SECRET, ts=None, mode="sig", offer="off1"):
    payload = {"secret": secret if mode == "body" else "", "event": event, "data": {"id": oid, "status": status, "customer": {"email": email}, "product": {"id": "p1"}, "offer": {"id": offer, "price": price}}}
    raw = json.dumps(payload).encode(); h = {"Content-Type": "application/json"}
    if mode == "sig":
        ts = str(ts or int(time.time())); h["X-Cakto-Timestamp"] = ts
        h["X-Cakto-Signature"] = "v1=" + hmac.new(secret.encode(), ts.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return call("POST", "/webhooks/cakto", raw=raw, headers=h)

print("== básico")
s, d, h = call("GET", "/health"); check("health 200", s == 200 and d.get("status") == "online")
check("cabeçalho nosniff", h.get("X-Content-Type-Options") == "nosniff"); check("no-store", h.get("Cache-Control") == "no-store")
print("== cadastro/login")
s, _, _ = call("POST", "/auth/signup", {"email": "a@b.com", "password": "senha-segura-1", "accept_terms": False}); check("sem aceite → 400", s == 400)
s, _, _ = call("POST", "/auth/signup", {"email": "a@b.com", "password": "curta", "accept_terms": True}); check("senha curta → 400", s == 400)
s, _, _ = call("POST", "/auth/signup", {"email": "nao-e-email", "password": "senha-segura-1", "accept_terms": True}); check("email inválido → 400", s == 400)
s, _, _ = call("POST", "/auth/signup", {"email": "x'; DROP TABLE users;--@a.com", "password": "senha-segura-1", "accept_terms": True}); check("SQLi no e-mail rejeitado", s == 400)
emailA, pwA, tokA, s = signup(); check("signup ok", s == 200 and tokA)
s, _, _ = call("POST", "/auth/signup", {"email": emailA.upper(), "password": pwA, "accept_terms": True}); check("e-mail duplicado (maiúsculas) → 409", s == 409)
s, _, _ = call("POST", "/auth/login", {"email": emailA, "password": "errada-errada"}); check("login senha errada → 401", s == 401)
s, d, _ = call("POST", "/auth/login", {"email": emailA.upper(), "password": pwA}); check("login ok", s == 200 and d.get("token"))
s, d, _ = call("GET", "/me", token=tokA); check("/me teste 3 fotos", s == 200 and d["usage"]["plan"] == "teste" and d["usage"]["remaining"] == 3, d)
s, _, _ = call("GET", "/me"); check("sem token → 401", s == 401)
s, _, _ = call("GET", "/me", token="invalido"); check("token inválido → 401", s == 401)
print("== análise de foto e cota do teste")
s, d, _ = analyze(tokA, img=b"nao sou imagem", ctype="image/jpeg"); check("arquivo não-imagem → 400", s == 400, d)
s, d, _ = analyze(tokA, img=b"\x00" * (9 << 20)); check("foto > 8MB → 400/413", s in (400, 413), s)
for i in range(3):
    s, d, _ = analyze(tokA); check(f"foto {i+1}/3 ok", s == 200 and d["data"]["meal_summary"]["total_calories"] > 0 and d["usage"]["remaining"] == 2 - i, d)
s, d, _ = analyze(tokA); check("4ª foto → 402 quota_trial", s == 402 and d.get("code") == "quota_trial", (s, d))
f = call("GET", "/__fail?on=0", base=FAKE)
print("== falha da IA não consome cota")
_, _, tokF, _ = signup(); call("GET", "/__fail?on=1", base=FAKE)
s, d, _ = analyze(tokF); check("IA falhou → 502", s == 502, s); check("sem vazar texto do provedor", "SEGREDO" not in json.dumps(d), d)
call("GET", "/__fail?on=0", base=FAKE)
s, d, _ = call("GET", "/me", token=tokF); check("cota intacta após falha", d["usage"]["remaining"] == 3, d)
st = call("GET", "/__fail?on=0", base=FAKE)[1]; check("chave Gemini em cabeçalho, nunca na URL", st["seen_path"] and "key=" not in st["seen_path"] and st["seen_key"] is not None, st)
print("== corrida: 12 pedidos simultâneos, só 3 passam")
import concurrent.futures as cf
_, _, tokR, _ = signup(); call("GET", "/__delay?ms=300", base=FAKE)
with cf.ThreadPoolExecutor(12) as ex: res = list(ex.map(lambda _: analyze(tokR)[0], range(12)))
call("GET", "/__delay?ms=0", base=FAKE)
check("exatamente 3 aprovadas", res.count(200) == 3 and res.count(402) == 9, res)
print("== diário")
s, d, _ = call("GET", "/meals", token=tokA); check("lista 3 refeições do dia", s == 200 and len(d["meals"]) == 3, d)
mid = d["meals"][0]["id"]
emailB, _, tokB, _ = signup()
s, _, _ = call("DELETE", f"/meals/{mid}", token=tokB); check("outro usuário não apaga (404)", s == 404)
s, d, _ = call("GET", "/meals?date=2000-01-01'--", token=tokA); check("date malformado tratado", s == 200)
s, _, _ = call("DELETE", f"/meals/{mid}", token=tokA); check("dono apaga", s == 200)
print("== estado")
s, _, _ = call("PUT", "/state", {"water": {"2026-10-30": 500}}, token=tokA); check("grava estado", s == 200)
s, d, _ = call("GET", "/state", token=tokA); check("lê estado", d["data"]["water"]["2026-10-30"] == 500, d)
s, _, _ = call("PUT", "/state", {"x": "a" * 70000}, token=tokA); check("estado gigante recusado", s in (400, 413), s)
s, _, _ = call("PUT", "/state", raw=b"[1,2]", token=tokA, headers={"Content-Type": "application/json"}); check("estado não-objeto recusado", s == 400)
print("== metas")
s, d, _ = call("POST", "/nutrition/calculate", {"weight_kg": 80, "target_weight_kg": 74, "height_cm": 175, "age": 32, "gender": "male", "activity_level": "moderate"}, token=tokA); check("cálculo ok", s == 200 and 1500 < d["data"]["calorie_target"] < 3500, d)
s, _, _ = call("POST", "/nutrition/calculate", {"weight_kg": 5, "target_weight_kg": 4, "height_cm": 20, "age": 3, "gender": "male", "activity_level": "x"}, token=tokA); check("valores absurdos → 400", s == 400)
print("== webhook Cakto")
emailP = f"pro{uuid.uuid4().hex[:6]}@teste.com"; _, _, tokP, _ = signup(emailP)
s, d, _ = hook("purchase_approved", emailP, "ord1", secret="errado"); check("assinatura errada → 401", s == 401)
s, d, _ = hook("purchase_approved", emailP, "ord1", ts=int(time.time()) - 3600); check("timestamp velho (replay) → 401", s == 401)
s, d, _ = call("POST", "/webhooks/cakto", raw=b'{"event":"purchase_approved"}', headers={"Content-Type": "application/json"}); check("sem assinatura → 401", s == 401)
s, d, _ = hook("purchase_approved", emailP, "ord1", price=49.9); check("compra Pro aprovada", s == 200 and d["results"] == ["ok"], d)
s, d, _ = call("GET", "/me", token=tokP); check("plano Pro ativo, limite 150", d["usage"]["plan"] == "pro" and d["usage"]["limit"] == 150, d)
s, d, _ = hook("purchase_approved", emailP, "ord1"); check("reenvio duplicado ignorado", d["results"] == ["duplicado"], d)
s, d, _ = hook("purchase_approved", emailP, "ord9", status="waiting_payment"); check("não pago não libera", "ignored" in d["results"][0], d)
s, d, _ = hook("purchase_approved", "novo-cliente@teste.com", "ord2", price=79.9, mode="body", offer="x"); check("segredo no corpo (fallback) aceito; compra antes do cadastro", s == 200 and d["results"] == ["ok"], d)
_, _, tokN, _ = signup("novo-cliente@teste.com"); s, d, _ = call("GET", "/me", token=tokN); check("cadastro posterior já nasce Power", d["usage"]["plan"] == "power" and d["usage"]["limit"] == 300, d)
s, d, _ = hook("purchase_approved", "desconhecido@teste.com", "ord3", price=12.34, offer="y"); check("valor sem plano → revisão manual", d["results"] == ["revisar:plano_desconhecido"], d)
print("== limite diário do Pro (5/dia)")
for i in range(5):
    s, d, _ = analyze(tokP); check(f"Pro foto {i+1}", s == 200 and d["usage"]["plan"] == "pro", (s, d))
s, d, _ = analyze(tokP); check("6ª no dia → 402 quota_plan", s == 402 and d.get("code") == "quota_plan", (s, d))
print("== cancelamento, reembolso")
s, d, _ = hook("subscription_canceled", emailP, "ord4"); s, d, _ = call("GET", "/me", token=tokP); check("cancelada mantém acesso até o fim do período", d["usage"]["plan"] == "pro" and d["usage"].get("canceled"), d)
s, d, _ = hook("refund", emailP, "ord5", status="refunded"); s, d, _ = call("GET", "/me", token=tokP); check("reembolso corta o acesso", d["usage"]["plan"] == "teste", d)
s, d, _ = hook("subscription_renewed", emailP, "ord6"); s, d, _ = call("GET", "/me", token=tokP); check("renovação reativa", d["usage"]["plan"] == "pro", d)
s, d, _ = hook("chargeback", emailP, "ord7", status="chargedback"); s, d, _ = call("GET", "/me", token=tokP); check("chargeback corta o acesso", d["usage"]["plan"] == "teste", d)
print("== LGPD")
s, d, h = call("GET", "/account/export", token=tokA); check("exportação traz refeições e conta", s == 200 and "meals" in d and d["user"]["email"] == emailA and "password" not in json.dumps(d).lower(), list(d))
s, _, _ = call("DELETE", "/account", {"password": "errada"}, token=tokA); check("excluir com senha errada → 403", s == 403)
s, _, _ = call("DELETE", "/account", {"password": pwA}, token=tokA); check("excluir conta ok", s == 200)
s, _, _ = call("GET", "/me", token=tokA); check("sessão morre com a conta", s == 401)
s, _, _ = call("POST", "/auth/login", {"email": emailA, "password": pwA}); check("não entra mais", s == 401)
print(f"\nRESULTADO: {ok} passaram, {bad} falharam"); sys.exit(1 if bad else 0)
