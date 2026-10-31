"""E2E das rotas da fase de upgrade (fechar o dia, exercícios, histórico, peso, texto, porção, senha).
Uso: python3 tests/e2e_upgrade.py  (API em :8080 com Gemini falso em :18081; DATABASE_URL em PG_DSN para checagens diretas opcionais)."""
import json, sys, uuid, urllib.request, urllib.error
API = "http://127.0.0.1:8080/api/v1"
_ok = _bad = 0
def check(name, cond, extra=""):
    global _ok, _bad
    if cond: _ok += 1; print("  PASS", name)
    else: _bad += 1; print("  FAIL", name, extra)
def results(): return _ok, _bad
def call(method, path, body=None, token=None, headers=None, raw=None):
    h = dict(headers or {}); data = raw
    if body is not None: data = json.dumps(body).encode(); h["Content-Type"] = "application/json"
    if token: h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(API + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp: return resp.status, json.loads(resp.read() or b"{}"), resp.headers
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}"), e.headers
        except Exception: return e.code, {}, e.headers
JPG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300") + b"\x00" * 200 + b"\xff\xd9"
def analyze(token):
    b = "----t" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + JPG + f"\r\n--{b}--\r\n".encode()
    return call("POST", "/meals/analyze", raw=body, token=token, headers={"Content-Type": "multipart/form-data; boundary=" + b})
def signup():
    email = f"u{uuid.uuid4().hex[:10]}@teste.com"
    s, d, _ = call("POST", "/auth/signup", {"name": "Teste", "email": email, "password": "senha-segura-1", "accept_terms": True})
    return email, "senha-segura-1", d.get("token"), s

email, pw, tok, s = signup()
check("signup ok", s == 200 and tok)
call("GET", "/config")
s, d, _ = call("GET", "/config"); check("config: reset desligado sem SMTP", s == 200 and d.get("password_reset") is False)

# --- exercícios
s, d, _ = call("POST", "/workouts", {"activity_type": "caminhada", "duration_min": 60, "intensity": "moderada", "weight_kg": 70}, tok)
check("exercício avulso calcula 196 kcal (MET líquido, 70kg)", s == 200 and d["data"]["calories_burned"] == 196, str(d))
s, d, _ = call("POST", "/workouts", {"activity_type": "voar", "duration_min": 10}, tok); check("atividade inválida 400", s == 400)
s, d, _ = call("POST", "/workouts", {"activity_type": "corrida", "duration_min": 0}, tok); check("duração 0 -> 400", s == 400)
s, d, _ = call("POST", "/workouts", {"activity_type": "corrida", "duration_min": 20, "date": "2020-01-01"}, tok); check("data antiga -> 400", s == 400)
s, d, _ = call("POST", "/workouts", {"activity_type": "musculacao", "duration_min": 40, "intensity": "moderada", "ref": "rt-1-2026"}, tok)
check("ref sem peso informado usa padrão 70kg e sinaliza estimativa", s == 200 and d.get("weight_estimated") is True)
a = d["data"]["calories_burned"]
s, d, _ = call("POST", "/workouts", {"activity_type": "musculacao", "duration_min": 40, "intensity": "moderada", "ref": "rt-1-2026"}, tok)
check("ref repetido é idempotente (não duplica)", s == 200 and d["data"]["calories_burned"] == a)
s, d, _ = call("GET", "/workouts", token=tok); check("lista 2 exercícios (não 3)", s == 200 and len(d["workouts"]) == 2, str(d))
total = d["total_burned"]
s, d, _ = call("DELETE", "/workouts/by-ref?ref=rt-1-2026", token=tok); check("desmarcar por ref", s == 200)
s, d, _ = call("GET", "/workouts", token=tok); check("sobrou 1 exercício", len(d["workouts"]) == 1 and d["total_burned"] == 196)

# --- peso e exercício usando o peso registrado
s, d, _ = call("POST", "/weight", {"weight_kg": 100}, tok); check("registra peso", s == 200 and d["weights"][-1]["kg"] == 100)
s, d, _ = call("POST", "/weight", {"weight_kg": 10}, tok); check("peso inválido 400", s == 400)
s, d, _ = call("POST", "/workouts", {"activity_type": "caminhada", "duration_min": 60, "intensity": "moderada"}, tok)
check("sem peso no corpo usa o último peso (100kg => 280)", d["data"]["calories_burned"] == 280 and d.get("weight_estimated") is False, str(d))

# --- refeição por foto + texto + edição
s, d, _ = analyze(tok); check("foto analisa", s == 200, str(d)); meal_id = d.get("meal_id")
s, d, _ = call("POST", "/meals/text", {"text": "2 ovos mexidos e 1 pão"}, tok); check("texto analisa e não gasta foto", s == 200 and "usage" not in d, str(d))
s, d, _ = call("GET", "/me", token=tok); check("fotos usadas continuam 1", d["usage"]["used"] == 1, str(d["usage"]))
s, d, _ = call("POST", "/meals/text", {"text": "x"}, tok); check("texto curto 400", s == 400)
s, d, _ = call("POST", "/meals/text", {"text": "a" * 301}, tok); check("texto longo 400", s == 400)
n_ok = 1
for i in range(8):
    s, d, _ = call("POST", "/meals/text", {"text": "banana"}, tok)
    if s == 200: n_ok += 1
check("teste grátis limita texto a 5/dia", s == 429 and d.get("code") == "text_limit" and n_ok == 5, f"{s} {n_ok} {d}")
s, d, _ = call("PATCH", f"/meals/{meal_id}", {"factor": 1.5, "name": "Prato maior"}, tok); check("ajusta porção 1,5x e nome", s == 200)
s, d, _ = call("GET", "/meals", token=tok)
m = [x for x in d["meals"] if x["id"] == meal_id][0]
check("calorias x1,5 (640,5 -> 960,75)", abs(m["total_calories"] - 960.75) < 0.01 and m["name"] == "Prato maior", str(m))
s, d, _ = call("PATCH", f"/meals/{meal_id}", {"factor": 9}, tok); check("fator 9 -> 400", s == 400)
s, d, _ = call("PATCH", f"/meals/{uuid.uuid4()}", {"factor": 1}, tok); check("refeição alheia/inexistente 404", s == 404)
s, d, _ = call("PATCH", f"/meals/{meal_id}", {}, tok); check("PATCH vazio 400", s == 400)

# --- isolamento entre usuários
e2, p2, t2, _ = signup()
s, d, _ = call("PATCH", f"/meals/{meal_id}", {"factor": 2}, t2); check("outro usuário não edita minha refeição", s == 404)
s, d, _ = call("GET", "/workouts", token=t2); check("outro usuário não vê meus exercícios", d["workouts"] == [])

# --- fechar o dia
s, d, _ = call("GET", "/days/summary", token=tok); live = d["live"]
check("resumo ao vivo soma refeições e exercícios", s == 200 and live["burned_kcal"] == 476 and live["consumed_kcal"] > 0 and d["closure"] is None, str(d))
body = {"calorie_goal": 2000, "protein_goal_g": 120, "carb_goal_g": 250, "fat_goal_g": 65, "water_ml": 1500, "water_goal_ml": 2500}
s, d, _ = call("POST", "/days/close", body, tok)
cl = d.get("closure", {})
check("fecha o dia: net = ingeridas - queimadas", s == 200 and cl["net_kcal"] == cl["consumed_kcal"] - cl["burned_kcal"] and cl["verdict"] in ("deficit", "na_meta", "superavit"), str(d))
check("veredito coerente com a meta", cl["verdict"] == ("deficit" if cl["net_kcal"] < 1900 else "na_meta" if cl["net_kcal"] <= 2100 else "superavit"), str(cl))
s, d, _ = call("POST", "/days/close", {**body, "calorie_goal": 100}, tok); check("meta absurda 400", s == 400)
s, d, _ = call("POST", "/days/close", {**body, "date": "2020-01-01"}, tok); check("fechar dia antigo 400", s == 400)
call("POST", "/workouts", {"activity_type": "corrida", "duration_min": 30, "intensity": "intensa"}, tok)
s, d, _ = call("POST", "/days/close", body, tok); check("refechar atualiza (upsert)", s == 200 and d["closure"]["burned_kcal"] > cl["burned_kcal"])
s, d, _ = call("GET", "/days/summary", token=tok); check("resumo traz fechamento", d["closure"] is not None and d["closure"]["water_ml"] == 1500)
s, d, _ = call("GET", "/days/summary", token=t2); check("fechamento isolado por usuário", d["closure"] is None)

# --- histórico
s, d, _ = call("GET", "/history?days=7", token=tok)
check("histórico 7 dias com hoje fechado", s == 200 and len(d["days"]) == 7 and d["days"][-1]["closed"] is True and d["days"][-1]["consumed_kcal"] > 0, str(d["days"][-1]))
s, d, _ = call("GET", "/history?days=30", token=tok); check("histórico 30 dias", len(d["days"]) == 30 and d["weights"][-1]["kg"] == 100)
s, d, _ = call("GET", "/history?days=99", token=tok); check("days inválido cai em 7", len(d["days"]) == 7)
s, d, _ = call("GET", "/history", token=t2); check("histórico de outro usuário vazio", all(x["consumed_kcal"] == 0 for x in d["days"]))

# --- autenticação obrigatória
for m, p in [("GET", "/history"), ("POST", "/days/close"), ("POST", "/weight"), ("GET", "/workouts"), ("POST", "/meals/text"), ("PATCH", "/meals/x")]:
    s, _, _ = call(m, p, {} if m != "GET" else None)
    check(f"{m} {p} exige login", s == 401, str(s))

# --- recuperação de senha (sem SMTP: resposta neutra, nada vaza)
s, d, _ = call("POST", "/auth/forgot", {"email": email}); check("forgot responde 200 neutro", s == 200 and d == {"status": "ok"})
s, d, _ = call("POST", "/auth/forgot", {"email": "naoexiste@teste.com"}); check("forgot com e-mail inexistente igual", s == 200 and d == {"status": "ok"})
s, d, _ = call("POST", "/auth/reset", {"token": "x" * 43, "password": "novasenha123"}); check("reset com token inválido 400", s == 400)

# --- exportação LGPD inclui os dados novos
s, d, _ = call("GET", "/account/export", token=tok)
check("export inclui exercícios, pesos e fechamentos", s == 200 and len(d["workouts"]) >= 3 and len(d["weights"]) == 1 and len(d["day_closures"]) == 1, str({k: len(v) for k, v in d.items() if isinstance(v, list)}))


# --- redefinição de senha ponta a ponta (token gravado direto no banco, como o e-mail entregaria)
import hashlib, subprocess, os
PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"), "-p", os.environ.get("PGPORT", "55432"), "-U", os.environ.get("PGUSER", "nutri"), "-d", os.environ.get("PGDATABASE", "nutrisnap_up"), "-Atq", "-c"]
def sql(q): return subprocess.run(PSQL + [q], capture_output=True, text=True).stdout.strip()
e3, p3, t3, _ = signup()
uid = sql(f"select id from users where email='{e3}'")
raw = "tok" + uuid.uuid4().hex + uuid.uuid4().hex[:12]
sql(f"insert into password_resets(token_hash,user_id,expires_at) values('{hashlib.sha256(raw.encode()).hexdigest()}','{uid}', now()+interval '30 minutes')")
s, d, _ = call("POST", "/auth/reset", {"token": raw, "password": "curta"}); check("reset com senha curta 400 (token não é gasto)", s == 400)
s, d, _ = call("POST", "/auth/reset", {"token": raw, "password": "NovaSenha#456"}); check("reset com token válido 200", s == 200, str(d))
s, d, _ = call("GET", "/me", token=t3); check("sessões antigas encerradas após o reset", s == 401)
s, d, _ = call("POST", "/auth/login", {"email": e3, "password": p3}); check("senha antiga não funciona", s == 401)
s, d, _ = call("POST", "/auth/login", {"email": e3, "password": "NovaSenha#456"}); check("senha nova funciona", s == 200)
s, d, _ = call("POST", "/auth/reset", {"token": raw, "password": "OutraSenha#789"}); check("token não pode ser reutilizado", s == 400)
raw2 = "tok" + uuid.uuid4().hex + uuid.uuid4().hex[:12]
sql(f"insert into password_resets(token_hash,user_id,expires_at) values('{hashlib.sha256(raw2.encode()).hexdigest()}','{uid}', now()-interval '1 minute')")
s, d, _ = call("POST", "/auth/reset", {"token": raw2, "password": "OutraSenha#789"}); check("token expirado 400", s == 400)

# --- confirmar/refinar refeição (nome + quantidade)
ra, _, ta, _ = signup()
s, d, _ = analyze(ta); check("foto analisa", s == 200 and d.get("meal_id"), str(d))
mid = d["meal_id"]; used0 = d["usage"]["used"]
ms = d["data"]["meal_summary"]
check("resumo traz alternativas/unidade saneadas", isinstance(ms.get("alternatives"), list) and ms.get("serving_unit") in ("ml", "g"), str(ms))
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Iogurte natural", "amount": 200, "unit": "ml"}, ta)
check("refine recalcula 200 ml", s == 200 and d["data"]["meal_summary"]["name"] == "Iogurte natural" and d["data"]["meal_summary"]["total_calories"] > 0, str(d))
s, d, _ = call("GET", "/meals", token=ta)
check("refeição atualizada no diário (nome novo)", s == 200 and any(m["name"] == "Iogurte natural" for m in d["meals"]), str(d)[:200])
s, d, _ = call("GET", "/me", token=ta); check("refine não gasta foto", d["usage"]["used"] == used0, str(d["usage"]))
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "x", "amount": 200, "unit": "ml"}, ta); check("refine nome curto 400", s == 400)
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Leite", "amount": 200, "unit": "oz"}, ta); check("refine unidade inválida 400", s == 400)
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Leite", "amount": 0, "unit": "ml"}, ta); check("refine quantidade 0 400", s == 400)
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Leite", "amount": 9999, "unit": "ml"}, ta); check("refine quantidade enorme 400", s == 400)
_, _, tb, _ = signup()
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Leite", "amount": 200, "unit": "ml"}, tb); check("refine de refeição alheia 404", s == 404)
s, d, _ = call("POST", f"/meals/{mid}/refine", {"name": "Leite", "amount": 200, "unit": "ml"}); check("refine exige login", s == 401)

ok, bad = results()
print(f"\n{ok} ok, {bad} falhas"); sys.exit(1 if bad else 0)
