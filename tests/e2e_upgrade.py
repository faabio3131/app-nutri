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

# --- leitura da foto + cálculo por tabela
def scan(token):
    b = "----t" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"a.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + JPG + f"\r\n--{b}--\r\n".encode()
    return call("POST", "/meals/scan", raw=body, token=token, headers={"Content-Type": "multipart/form-data; boundary=" + b})
def gem(path):
    return json.loads(urllib.request.urlopen("http://127.0.0.1:18081" + path, timeout=5).read())
ra, _, ta, _ = signup()
s, d, _ = call("GET", "/catalog"); check("catálogo exige login", s == 401)
s, d, _ = call("GET", "/catalog", token=ta); check("catálogo traz alimentos e bebidas", s == 200 and len(d["foods"]) >= 60 and len(d["drinks"]) >= 25, str(d)[:120])
gem("/__scan?kind=prato")
s, d, _ = scan(ta); check("scan lê o prato", s == 200 and d["scan"]["kind"] == "prato" and len(d["scan"]["items"]) == 3, str(d)[:300])
check("scan não devolve calorias", "calories" not in json.dumps(d["scan"]) and "total_calories" not in json.dumps(d["scan"]))
check("scan descarta id inventado", any(i["name"] == "Sushi" and i["food_id"] == "" for i in d["scan"]["items"]), str(d["scan"]["items"]))
check("scan sugere feijão sob o arroz? (não, falta item?)", any("feijão" in h["text"] for h in d["hints"]), str(d["hints"]))
check("scan gastou 1 foto", d["usage"]["used"] == 1, str(d["usage"]))
s, d, _ = call("GET", "/meals", token=ta); check("scan não grava refeição", s == 200 and len(d["meals"]) == 0, str(d))
base = {"mode": "prato", "save": False, "items": [{"food_id": "bife_patinho"}, {"food_id": "arroz_branco", "share": 1}, {"food_id": "feijao_carioca", "share": 1}], "total_g": 700}
s, d, _ = call("POST", "/meals/calc", base, ta)
check("prévia calcula pela tabela", s == 200 and d["status"] == "preview" and abs(d["result"]["total_g"] - 700) < 1 and d["result"]["total_calories"] > 500, str(d)[:300])
s, d2, _ = call("POST", "/meals/calc", base, ta); check("cálculo determinístico", d2["result"]["total_calories"] == d["result"]["total_calories"])
s, dd, _ = call("GET", "/me", token=ta); check("prévia não gasta foto", dd["usage"]["used"] == 1, str(dd["usage"]))
b2 = dict(base, complement="feijão preto por baixo, 2 ovos fritos")
s, d, _ = call("POST", "/meals/calc", b2, ta)
ids = [i["food_id"] for i in d["result"]["items"]]
check("farofa do complemento entra com porção padrão (30 g)", any(i["food_id"] == "farofa" and i["grams"] == 30 for i in call("POST", "/meals/calc", dict(base, complement="farofa"), ta)[1]["result"]["items"]))
check("complemento adiciona feijão preto e ovos", "feijao_preto" in ids and "ovo_frito" in ids, str(ids))
s, d, _ = call("POST", "/meals/calc", {"mode": "prato", "save": False, "items": [{"food_id": "coxinha"}]}, ta)
check("item sem medida pede gramas", s == 200 and d["status"] == "need_grams", str(d)[:200])
s, d, _ = call("POST", "/meals/calc", {"mode": "prato", "save": True, "items": [{"food_id": "coxinha"}]}, ta); check("salvar sem gramas 422", s == 422, str(d))
s, d, _ = call("POST", "/meals/calc", dict(base, items=[]), ta); check("prato vazio 400", s == 400)
s, d, _ = call("POST", "/meals/calc", dict(base, total_g=99999), ta); check("peso enorme 400", s == 400)
s, d, _ = call("POST", "/meals/calc", dict(base, items=[{"food_id": "arroz_branco", "grams": -5}]), ta); check("gramas negativos 400", s == 400)
s, d, _ = call("POST", "/meals/calc", dict(base, mode="x"), ta); check("modo inválido 400", s == 400)
s, d, _ = call("POST", "/meals/calc", base)
check("calc exige login", s == 401)
s, d, _ = call("POST", "/meals/calc", dict(base, save=True, name="Almoço <b>teste</b>"), ta)
check("registrar grava a refeição", s == 200 and d["status"] == "success" and d["meal_id"] and "<" not in d["data"]["meal_summary"]["name"], str(d)[:300])
mid = d["meal_id"]
s, d, _ = call("GET", "/meals", token=ta); check("refeição aparece no diário", len(d["meals"]) == 1 and d["meals"][0]["total_calories"] > 500, str(d)[:200])
s, d, _ = call("GET", "/me", token=ta); check("registrar não gasta foto", d["usage"]["used"] == 1)
# bebida
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": True, "drink": {"drink_id": "leite_integral", "ml": 200}}, ta)
check("bebida 200 ml leite integral ≈ 120 kcal", s == 200 and abs(d["data"]["meal_summary"]["total_calories"] - 120) < 1, str(d)[:200])
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": False, "drink": {"drink_id": "leite_integral", "ml": 500}}, ta)
check("bebida 500 ml difere de 200 ml", abs(d["result"]["total_calories"] - 300) < 1, str(d)[:200])
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": False, "drink": {"drink_id": "cola_zero", "ml": 350}}, ta); check("cola zero = 0 kcal", d["result"]["total_calories"] == 0)
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": False, "drink": {"drink_id": "x", "ml": 350}}, ta); check("bebida inexistente 400", s == 400)
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": False, "drink": {"drink_id": "cola", "ml": 0}}, ta); check("ml zero 400", s == 400)
s, d, _ = call("POST", "/meals/calc", {"mode": "bebida", "save": False, "drink": {"drink_id": "cola", "ml": 350, "label_kcal_100ml": 40}}, ta); check("rótulo informado prevalece", abs(d["result"]["total_calories"] - 140) < 1, str(d)[:200])
# item fora da tabela: IA com o mesmo limite das fotos (teste = 3 no total)
free = {"mode": "prato", "save": True, "items": [{"food_id": "arroz_branco", "grams": 100}, {"name": "Sushi", "grams": 120}]}
s, d, _ = call("POST", "/meals/calc", free, ta); check("item fora da tabela usa IA (1/3)", s == 200 and any(i["origin"] == "ia" for i in d["result"]["items"]), str(d)[:300])
for n in (2, 3):
    s, d, _ = call("POST", "/meals/calc", free, ta); check(f"item fora da tabela usa IA ({n}/3)", s == 200, str(d)[:200])
s, d, _ = call("POST", "/meals/calc", free, ta); check("4ª chamada de IA bloqueada (mesmo limite das fotos)", s == 429 and d.get("code") == "calc_ai_limit", str(d))
s, d, _ = call("POST", "/meals/calc", base | {"save": True}, ta); check("cálculo só por tabela segue liberado após o limite de IA", s == 200)
# falha da IA libera a reserva
rb, _, tb, _ = signup()
gem("/__fail?on=1")
s, d, _ = call("POST", "/meals/calc", free, tb); check("falha da IA devolve 502", s == 502, str(d))
gem("/__fail?on=0")
s, d, _ = call("POST", "/meals/calc", free, tb); check("falha não gastou o limite de IA", s == 200, str(d)[:200])
# scan de bebida e falha do provedor
gem("/__scan?kind=bebida")
s, d, _ = scan(tb); check("scan lê a bebida", s == 200 and d["scan"]["kind"] == "bebida" and d["scan"]["drink"]["drink_id"] == "iogurte_natural" and d["scan"]["drink"]["volume_ml"] == 200, str(d)[:300])
used = d["usage"]["used"]
gem("/__fail?on=1")
s, d, _ = scan(tb); check("scan com falha do provedor 502", s == 502, str(d))
gem("/__fail?on=0")
s, dd, _ = call("GET", "/me", token=tb); check("scan que falhou não desconta a foto", dd["usage"]["used"] == used, str(dd["usage"]))
gem("/__scan?kind=prato")
# isolamento
_, _, tc, _ = signup()
s, d, _ = call("GET", "/meals", token=tc); check("outro usuário não vê as refeições", s == 200 and len(d["meals"]) == 0)
s, d, _ = call("PATCH", f"/meals/{mid}", {"factor": 2}, tc); check("não edita refeição alheia", s == 404)

ok, bad = results()
print(f"\n{ok} ok, {bad} falhas"); sys.exit(1 if bad else 0)
