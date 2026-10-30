"""Gemini falso para testes: responde um prato fixo. GET /__fail liga/desliga falha; /__delay?ms= define latência."""
import json, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
STATE = {"fail": False, "delay": 0.0, "calls": 0, "seen_key": None, "seen_path": None}
OK = {"candidates": [{"content": {"parts": [{"text": json.dumps({
    "meal_summary": {"name": "Arroz, feijão e frango", "total_calories": 640.5, "total_protein_g": 42, "total_carbs_g": 70, "total_fat_g": 18, "confidence_level": "MEDIO", "notes": "teste"},
    "items": [{"name": "Arroz", "estimated_weight_g": 150, "calories": 195, "protein_g": 4, "carbs_g": 42, "fat_g": 1},
              {"name": "Frango", "estimated_weight_g": 120, "calories": 200, "protein_g": 36, "carbs_g": 0, "fat_g": 5}]})}]}}]}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/__fail": STATE["fail"] = q.get("on", ["1"])[0] == "1"
        if u.path == "/__delay": STATE["delay"] = int(q.get("ms", ["0"])[0]) / 1000
        self._send(200, STATE)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); self.rfile.read(n)
        STATE["calls"] += 1; STATE["seen_key"] = self.headers.get("x-goog-api-key"); STATE["seen_path"] = self.path
        time.sleep(STATE["delay"])
        if "key=" in self.path: return self._send(400, {"error": "key na url"})
        if STATE["fail"]: return self._send(500, {"error": {"message": "boom SEGREDO-DO-PROVEDOR"}})
        self._send(200, OK)
ThreadingHTTPServer(("127.0.0.1", 18081), H).serve_forever()
