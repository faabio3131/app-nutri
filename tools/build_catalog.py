#!/usr/bin/env python3
"""Gera backend/internal/catalog/{foods,drinks}.json a partir da TACO (4a ed., NEPA/Unicamp).

Uso: python3 tools/build_catalog.py /caminho/taco.db
O banco SQLite da TACO vem de https://github.com/raulfdm/taco-api (apps/api/prisma/taco.db, licenca MIT).
Valores nutricionais: sempre da TACO (por 100 g) ou da Tabela IBGE (leites e macarrao cozido), nunca de memoria.
Medidas caseiras (g por colher de sopa cheia etc.): "Medidas Caseiras", Faculdade de Nutricao da UFG (UFG).
Itens sem medida caseira documentada exigem que o usuario informe os gramas (needs_grams).
"""
import json, sqlite3, sys, os

TACO = "TACO 4a ed. (NEPA/Unicamp)"
UFG = "Medidas Caseiras, Faculdade de Nutricao da UFG"
IBGE = "Tabela IBGE (POF), via tabelatacoonline.com.br"
DEC = "Decisao do produto: porcao de proteina 100-120 g (110 g)"

db = sqlite3.connect(sys.argv[1])
def taco(i):
    r = db.execute("select f.name,n.kcal,n.protein,n.lipids,n.carbohydrates from foods f join nutrients n on n.foodId=f.id where f.id=?", (i,)).fetchone()
    assert r and r[1] is not None, f"TACO id {i} sem dados"
    return r[0], r[1], r[2] or 0.0, r[3] or 0.0, r[4] or 0.0

# (id, nome exibido, categoria, taco_id | (kcal,p,c,f,fonte), apelidos, csch_g, fixed_g, default_g, unit_g, fonte_medida)
F = []
def add(id, nome, cat, src, ali=(), csch=0, fixed=0, default=0, unit=0, msrc="", est=False):
    F.append(dict(id=id, name=nome, category=cat, src=src, aliases=list(ali), csch=csch, fixed=fixed, default=default, unit=unit, msrc=msrc, est=est))

# Acompanhamentos (volume -> peso pela colher de sopa cheia)
add("arroz_branco", "Arroz branco", "base", 3, ["arroz"], csch=25, default=78, msrc=UFG + " (arroz branco cozido; escumadeira media rasa 78 g)")
add("arroz_integral", "Arroz integral", "base", 1, ["arroz integral"], csch=25, default=78, msrc=UFG + " (valor do arroz branco, densidade estimada)", est=True)
add("feijao_carioca", "Feijão carioca", "leguminosa", 561, ["feijao", "feijao carioca"], csch=25, default=160, msrc=UFG + " (feijao em caldo; concha media cheia 160 g)")
add("feijao_preto", "Feijão preto", "leguminosa", 567, ["feijao preto"], csch=25, default=160, msrc=UFG + " (feijao em caldo; concha media cheia 160 g)")
add("lentilha", "Lentilha", "leguminosa", 577, ["lentilha"], csch=20, default=60, msrc=UFG + " (colher de sopa cheia 20 g; 3 colheres)")
add("macarrao", "Macarrão cozido", "base", (158, 5.80, 0.93, 30.86, IBGE), ["macarrao", "espaguete", "massa", "talharim", "penne"], default=155, msrc=UFG + " (espaguete cozido; prato raso 155 g), densidade estimada", est=True)
add("macarrao_bolonhesa", "Macarrão à bolonhesa", "base", 542, ["macarrao a bolonhesa", "macarrao com molho", "espaguete a bolonhesa"], default=230, msrc=UFG + " (espaguete cozido; prato fundo raso 230 g), densidade estimada", est=True)
add("nhoque", "Nhoque de batata", "base", 136, ["nhoque", "nhoque de batata"], default=200, msrc=UFG + " (nhoque a bolonhesa; porcao media 200 g), densidade estimada", est=True)
add("batata_cozida", "Batata cozida", "base", 91, ["batata", "batata cozida"], default=120, msrc=UFG + " (batata inglesa cozida; unidade media 120 g), densidade estimada", est=True)
add("batata_frita", "Batata frita", "base", 93, ["batata frita", "fritas"], default=90, msrc=UFG + " (batata frita palito; escumadeira media rasa 30 g; 3 escumadeiras), densidade estimada", est=True)
add("batata_doce", "Batata-doce cozida", "base", 88, ["batata doce"], csch=20, default=60, msrc=UFG + " (colher de sopa cheia 20 g; 3 colheres)")
add("mandioca_cozida", "Mandioca cozida", "base", 129, ["mandioca", "aipim", "macaxeira"], csch=37, default=111, msrc=UFG + " (colher de sopa cheia 37 g; 3 colheres)")
add("mandioca_frita", "Mandioca frita", "base", 132, ["mandioca frita", "aipim frito"], default=0, msrc="", est=True)
add("farofa", "Farofa", "base", 131, ["farofa"], csch=15, default=30, msrc=UFG + " (farofa simples; porcao media 30 g)")
add("polenta", "Polenta / angu", "base", 62, ["polenta", "angu"], csch=35, default=110, msrc=UFG + " (angu de milho, similar; porcao media 110 g)")
add("cuscuz", "Cuscuz de milho", "base", 533, ["cuscuz"], msrc="", est=True)
add("pao_frances", "Pão francês", "unidade", 53, ["pao", "pao frances", "paozinho"], unit=50, msrc=UFG + " (unidade media 50 g)")
add("pao_forma_integral", "Pão de forma integral (fatia)", "unidade", 52, ["pao de forma", "pao integral", "torrada"], unit=25, msrc=UFG + " (pao de forma, fatia media 25 g)")
add("tapioca", "Tapioca com manteiga", "base", 551, ["tapioca"], msrc="", est=True)
# Proteinas (porcao fixa)
add("bife_patinho", "Bife (patinho grelhado)", "proteina", 377, ["bife", "carne", "carne grelhada", "patinho"], fixed=110, msrc=DEC + "; " + UFG + " (bife medio 80 g, grande 120 g)")
add("picanha", "Picanha grelhada", "proteina", 383, ["picanha"], fixed=110, msrc=DEC)
add("contrafile", "Contrafilé grelhado", "proteina", 346, ["contrafile", "contra file"], fixed=110, msrc=DEC)
add("alcatra", "Alcatra grelhada", "proteina", 370, ["alcatra"], fixed=110, msrc=DEC)
add("file_mignon", "Filé mignon grelhado", "proteina", 358, ["file mignon", "file"], fixed=110, msrc=DEC)
add("carne_moida", "Carne moída refogada", "base", 326, ["carne moida", "moida"], csch=20, default=60, msrc=UFG + " (carne moida refogada; colher de sopa cheia 20 g; 3 colheres)")
add("frango_grelhado", "Frango grelhado (peito)", "proteina", 410, ["frango", "frango grelhado", "file de frango", "peito de frango"], fixed=110, msrc=DEC + "; " + UFG + " (file grelhado medio 85 g)")
add("coxa_frango", "Coxa de frango assada", "proteina", 396, ["coxa", "coxa de frango", "sobrecoxa"], fixed=50, msrc=UFG + " (coxa assada sem osso 50 g)")
add("peixe_frito", "Peixe frito (filé)", "proteina", 306, ["peixe", "peixe frito", "pescada"], fixed=130, msrc=UFG + " (file de peixe frito, unidade media 130 g)")
add("salmao", "Salmão grelhado", "proteina", 317, ["salmao"], fixed=130, msrc=UFG + " (file de peixe, unidade media 130 g)")
add("bisteca_suina", "Bisteca suína grelhada", "proteina", 429, ["bisteca", "porco", "carne de porco"], fixed=110, msrc=DEC)
add("lombo_suino", "Lombo suíno assado", "proteina", 432, ["lombo"], fixed=110, msrc=DEC)
add("linguica", "Linguiça (frango, grelhada)", "proteina", 420, ["linguica"], fixed=80, msrc=UFG + " (linguica frita, porcao media 80 g)")
add("hamburguer", "Hambúrguer grelhado", "proteina", 417, ["hamburguer"], unit=42, msrc=UFG + " (hamburguer, unidade 42 g)")
add("ovo_cozido", "Ovo cozido", "unidade", 488, ["ovo cozido"], unit=50, msrc=UFG + " (ovo cozido, unidade media 50 g)")
add("ovo_frito", "Ovo frito", "unidade", 490, ["ovo", "ovos", "ovo frito"], unit=38, msrc=UFG + " (ovo frito gema solida, unidade media 38 g)")
add("omelete", "Omelete (1 ovo)", "unidade", 484, ["omelete"], unit=40, msrc=UFG + " (omelete 1 ovo, 40 g)")
add("presunto", "Presunto (fatia)", "unidade", 439, ["presunto"], unit=30, msrc=UFG + " (fatia media 30 g)")
add("queijo_mussarela", "Queijo muçarela (fatia)", "unidade", 463, ["queijo", "mussarela", "mucarela", "muçarela"], unit=30, msrc=UFG + " (fatia media 30 g)")
add("feijoada", "Feijoada", "leguminosa", 540, ["feijoada"], msrc="", est=True)
# Legumes e saladas
add("alface", "Alface crespa", "salada", 78, ["alface", "salada verde"], default=36, msrc=UFG + " (alface americana picada, pires de cha raso 36 g), densidade estimada", est=True)
add("tomate", "Tomate", "salada", 161, ["tomate"], csch=24, default=72, msrc=UFG + " (tomate picado, colher de sopa cheia 24 g; 3 colheres)")
add("cenoura_cozida", "Cenoura cozida", "salada", 109, ["cenoura"], csch=22, default=66, msrc=UFG + " (colher de sopa cheia 22 g; 3 colheres)")
add("brocolis", "Brócolis cozido", "salada", 100, ["brocolis"], csch=13, default=39, msrc=UFG + " (colher de sopa cheia 13 g; 3 colheres)")
add("couve_refogada", "Couve refogada", "salada", 116, ["couve"], csch=15, default=45, msrc=UFG + " (colher de sopa cheia 15 g; 3 colheres)")
add("abobrinha", "Abobrinha refogada", "salada", 72, ["abobrinha"], csch=20, default=60, msrc=UFG + " (abobrinha cozida, colher de sopa cheia 20 g; 3 colheres)")
add("chuchu", "Chuchu cozido", "salada", 112, ["chuchu"], csch=20, default=60, msrc=UFG + " (colher de sopa cheia 20 g; 3 colheres)")
add("couve_flor", "Couve-flor cozida", "salada", 118, ["couve flor"], csch=16, default=48, msrc=UFG + " (colher de sopa cheia 16 g; 3 colheres)")
add("beterraba", "Beterraba cozida", "salada", 97, ["beterraba"], csch=20, default=60, msrc=UFG + " (colher de sopa cheia 20 g; 3 colheres)")
add("molho_tomate", "Molho de tomate", "molho", 159, ["molho de tomate", "molho", "sugo"], csch=30, default=60, msrc=UFG + " (colher de sopa cheia 30 g; 2 colheres)")
# Frutas
add("banana_prata", "Banana prata", "fruta", 182, ["banana"], unit=75, msrc=UFG + " (banana prata sem casca, unidade media 75 g)")
add("banana_nanica", "Banana nanica", "fruta", 179, ["banana nanica"], unit=100, msrc=UFG + " (banana nanica sem casca, unidade media 100 g)")
add("maca", "Maçã Fuji", "fruta", 222, ["maca"], unit=125, msrc=UFG + " (maca fuji, unidade media 125 g)")
add("laranja", "Laranja pêra", "fruta", 214, ["laranja"], unit=150, msrc=UFG + " (laranja pera sem casca, unidade media 150 g)")
add("mamao", "Mamão papaia", "fruta", 226, ["mamao"], unit=90, msrc=UFG + " (mamao papaia, fatia media 90 g)")
# Gorduras e complementos
add("azeite", "Azeite de oliva", "gordura", 260, ["azeite"], default=10, msrc=UFG + " (colher de sopa nivelada 10 g)")
add("manteiga", "Manteiga", "gordura", 261, ["manteiga", "margarina"], default=20, msrc=UFG + " (manteiga/margarina, colher de sopa cheia 20 g)")
add("requeijao", "Requeijão cremoso", "gordura", 468, ["requeijao"], default=21, msrc=UFG + " (colher de sopa cheia 21 g)")
add("maionese", "Maionese", "gordura", 524, ["maionese"], msrc="", est=True)
# Sem medida caseira documentada: o usuario informa os gramas
for id_, nome, tid, ali in [
    ("coxinha", "Coxinha de frango frita", 386, ["coxinha"]), ("pastel_carne", "Pastel de carne frito", 56, ["pastel"]),
    ("pastel_queijo", "Pastel de queijo frito", 58, ["pastel de queijo"]), ("pao_de_queijo", "Pão de queijo assado", 140, ["pao de queijo"]),
    ("empada", "Empada de frango", 389, ["empada"]), ("bolo_chocolate", "Bolo de chocolate", 16, ["bolo"]),
    ("biscoito_cream_cracker", "Biscoito cream cracker", 13, ["biscoito", "bolacha"]), ("aveia", "Aveia em flocos", 7, ["aveia"]),
    ("amendoim", "Amendoim torrado", 558, ["amendoim"]), ("chocolate_leite", "Chocolate ao leite", 495, ["chocolate"]),
    ("iogurte_natural_g", "Iogurte natural (em g)", 448, ["iogurte"]), ("acai_polpa", "Açaí (polpa)", 168, ["acai"]),
]:
    add(id_, nome, "outro", tid, ali, msrc="", est=True)

foods = []
for f in F:
    if isinstance(f["src"], tuple):
        kcal, p, fat, c, srcname = f["src"]
        # tupla manual na ordem (kcal, proteina, lipideos, carboidrato, fonte)
        src_label = srcname
    else:
        _, kcal, p, fat, c = taco(f["src"])
        src_label = f"{TACO}, alimento n. {f['src']}"
    needs = f["csch"] == 0 and f["default"] == 0 and f["fixed"] == 0 and f["unit"] == 0
    foods.append({
        "id": f["id"], "name": f["name"], "category": f["category"], "aliases": f["aliases"],
        "per100g": {"kcal": kcal, "protein_g": p, "carbs_g": c, "fat_g": fat},
        "csch_g": f["csch"], "fixed_g": f["fixed"], "default_g": f["default"], "unit_g": f["unit"],
        "needs_grams": needs, "density_estimated": bool(f["est"]) or (f["csch"] == 0 and f["fixed"] == 0 and f["unit"] == 0),
        "source": src_label, "measure_source": f["msrc"],
    })

# Bebidas (por 100 ml; 1 g = 1 ml na aproximacao)
D = []
ZERO = "ANVISA RDC 54/2012: alegacao 'zero' exige no maximo 4 kcal por porcao; tratado como 0 (confira o rotulo)"
def drink(id, group, glabel, vlabel, src, ali=(), zero=False, source=""):
    if src is None: kcal = p = c = fat = 0.0; s = source
    elif isinstance(src, tuple): kcal, p, fat, c, s = src
    else:
        _, kcal, p, fat, c = taco(src); s = f"{TACO}, alimento n. {src}"
    D.append({"id": id, "group": group, "group_label": glabel, "variant": vlabel, "aliases": list(ali),
              "per100ml": {"kcal": kcal, "protein_g": p, "carbs_g": c, "fat_g": fat}, "sugar_free": zero, "source": s})
drink("leite_integral", "leite", "Leite", "Integral", (60, 3.22, 3.25, 4.52, IBGE), ["leite", "leite integral"])
drink("leite_semi", "leite", "Leite", "Semidesnatado", (42, 3.37, 0.97, 4.99, IBGE), ["leite semidesnatado"])
drink("leite_desnatado", "leite", "Leite", "Desnatado", (34.15, 3.38, 0.08, 4.98, IBGE), ["leite desnatado"])
drink("leite_achocolatado", "leite", "Leite", "Achocolatado", 455, ["achocolatado", "toddynho"])
drink("leite_fermentado", "leite", "Leite", "Fermentado (tipo Yakult)", 460, ["yakult", "leite fermentado"])
drink("iogurte_natural", "iogurte", "Iogurte", "Natural integral", 448, ["iogurte", "iogurte natural"])
drink("iogurte_desnatado", "iogurte", "Iogurte", "Natural desnatado", 449, ["iogurte desnatado"])
drink("iogurte_morango", "iogurte", "Iogurte", "Sabor morango", 451, ["iogurte de morango"])
drink("iogurte_pessego", "iogurte", "Iogurte", "Sabor pêssego", 452, ["iogurte de pessego"])
drink("bebida_lactea", "iogurte", "Iogurte", "Bebida láctea (pêssego)", 446, ["bebida lactea"])
drink("cola", "refrigerante", "Refrigerante", "Cola (com açúcar)", 480, ["coca", "coca cola", "refrigerante de cola", "pepsi"])
drink("cola_zero", "refrigerante", "Refrigerante", "Cola zero", None, ["coca zero", "cola zero"], True, ZERO)
drink("guarana", "refrigerante", "Refrigerante", "Guaraná (com açúcar)", 481, ["guarana", "guarana antarctica"])
drink("guarana_zero", "refrigerante", "Refrigerante", "Guaraná zero", None, ["guarana zero"], True, ZERO)
drink("laranja_refri", "refrigerante", "Refrigerante", "Laranja, tipo Fanta (com açúcar)", 482, ["fanta", "fanta laranja", "refrigerante de laranja"])
drink("laranja_refri_zero", "refrigerante", "Refrigerante", "Laranja zero", None, ["fanta zero"], True, ZERO)
drink("limao_refri", "refrigerante", "Refrigerante", "Limão, tipo Sprite (com açúcar)", 483, ["sprite", "refrigerante de limao"])
drink("limao_refri_zero", "refrigerante", "Refrigerante", "Limão zero", None, ["sprite zero"], True, ZERO)
drink("tonica", "refrigerante", "Refrigerante", "Água tônica", 479, ["agua tonica", "tonica"])
drink("suco_laranja", "suco", "Suco", "Laranja natural (sem açúcar)", 209, ["suco de laranja", "laranja"])
drink("suco_limao", "suco", "Suco", "Limão (sem açúcar)", 219, ["suco de limao", "limonada"])
drink("suco_caju", "suco", "Suco", "Caju envasado", 188, ["suco de caju"])
drink("suco_maracuja", "suco", "Suco", "Maracujá envasado", 234, ["suco de maracuja"])
drink("suco_uva", "suco", "Suco", "Uva envasado", 258, ["suco de uva"])
drink("agua_coco", "outras", "Outras bebidas", "Água de coco", 478, ["agua de coco"])
drink("caldo_cana", "outras", "Outras bebidas", "Caldo de cana", 473, ["garapa", "caldo de cana"])
drink("isotonico", "outras", "Outras bebidas", "Isotônico", 470, ["gatorade", "isotonico"])
drink("cafe", "outras", "Outras bebidas", "Café sem açúcar", 471, ["cafe"])
drink("cha_mate", "outras", "Outras bebidas", "Chá mate", 476, ["cha mate", "mate"])
drink("cha_preto", "outras", "Outras bebidas", "Chá preto", 477, ["cha"])
drink("cerveja", "outras", "Outras bebidas", "Cerveja pilsen", 474, ["cerveja", "chopp"])
drink("agua", "outras", "Outras bebidas", "Água", None, ["agua"], True, "Sem calorias")

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "internal", "catalog")
json.dump(foods, open(os.path.join(out, "foods.json"), "w"), ensure_ascii=False, indent=1)
json.dump(D, open(os.path.join(out, "drinks.json"), "w"), ensure_ascii=False, indent=1)
print(len(foods), "alimentos;", len(D), "bebidas")
