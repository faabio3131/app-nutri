"""Teste de carga simples (stdlib). Uso: python3 tests/load_api.py  (API :18080, Gemini falso :18081 com 300 ms)."""
import http.client, json, time, threading, uuid, statistics, sys
H, P = "127.0.0.1", 18080
def req(conn, method, path, body=None, token=None, raw=None, headers=None):
    h = dict(headers or {}); data = raw
    if body is not None: data = json.dumps(body); h["Content-Type"] = "application/json"
    if token: h["Authorization"] = "Bearer " + token
    conn.request(method, "/api/v1" + path, body=data, headers=h); r = conn.getresponse(); b = r.read(); return r.status, b
def setup_user():
    c = http.client.HTTPConnection(H, P); e = f"l{uuid.uuid4().hex[:10]}@t.com"
    s, b = req(c, "POST", "/auth/signup", {"email": e, "password": "senha-segura-1", "accept_terms": True}); return e, json.loads(b)["token"]
def run(name, fn, conc, secs):
    lat, errs, n = [], [0], [0]; stop = time.time() + secs; lock = threading.Lock()
    def w():
        c = http.client.HTTPConnection(H, P, timeout=60)
        while time.time() < stop:
            t = time.time()
            try: ok = fn(c)
            except Exception: ok = False; c = http.client.HTTPConnection(H, P, timeout=60)
            d = (time.time() - t) * 1000
            with lock:
                n[0] += 1; lat.append(d)
                if not ok: errs[0] += 1
    ts = [threading.Thread(target=w) for _ in range(conc)]; t0 = time.time()
    [t.start() for t in ts]; [t.join() for t in ts]; el = time.time() - t0; lat.sort()
    q = lambda p: lat[min(len(lat) - 1, int(len(lat) * p))]
    print(f"{name:28s} conc={conc:3d} req={n[0]:6d} rps={n[0]/el:7.1f} p50={q(.5):7.1f}ms p95={q(.95):7.1f}ms p99={q(.99):7.1f}ms erros={errs[0]} ({100*errs[0]/max(n[0],1):.2f}%)")
    return errs[0]
_, tok = setup_user()
JPG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300") + b"\x00" * 60000 + b"\xff\xd9"
def mp():
    b = "----l" + uuid.uuid4().hex
    return (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + JPG + f"\r\n--{b}--\r\n".encode(), "multipart/form-data; boundary=" + b
bad = 0
bad += run("health", lambda c: req(c, "GET", "/health")[0] == 200, 50, 5)
bad += run("/me (sessão+cota)", lambda c: req(c, "GET", "/me", token=tok)[0] == 200, 50, 5)
bad += run("diário", lambda c: req(c, "GET", "/meals", token=tok)[0] == 200, 50, 5)
bad += run("estado PUT", lambda c: req(c, "PUT", "/state", {"w": 1}, token=tok)[0] == 200, 30, 5)
em, _ = setup_user()
bad += run("login (bcrypt)", lambda c: req(c, "POST", "/auth/login", {"email": em, "password": "senha-segura-1"})[0] in (200, 429), 20, 5)
# análise: cada usuário tem 3 fotos de teste; 100 usuários x 3 = 300 análises com 300 ms de latência de IA
users = [setup_user()[1] for _ in range(60)]; idx = [0]; lk = threading.Lock()
def an(c):
    with lk:
        i = idx[0]; idx[0] += 1
    t = users[(i // 3) % len(users)]; b, ct = mp()
    return req(c, "POST", "/meals/analyze", token=t, raw=b, headers={"Content-Type": ct})[0] in (200, 402)
bad += run("analisar foto (IA 300ms)", an, 30, 8)
sys.exit(1 if bad else 0)
