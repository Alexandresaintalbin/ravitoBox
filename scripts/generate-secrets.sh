#!/bin/sh
# Génère un JWT secret et les clés anon / service_role pour un déploiement.
# Les valeurs de .env.example suffisent pour le développement local.
set -eu

python3 - <<'PY'
import base64, hashlib, hmac, json, os, time

def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

secret = base64.b64encode(os.urandom(48)).decode()

def token(role: str) -> str:
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(json.dumps({
        "role": role,
        "iss": "ravitobox",
        "iat": int(time.time()),
        "exp": int(time.time()) + 10 * 365 * 24 * 3600,
    }, separators=(",", ":")).encode())
    signature = b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"

postgres = base64.b64encode(os.urandom(24)).decode()
print("# Collez ces valeurs dans .env puis recréez les conteneurs (le volume Postgres")
print("# conserve les mots de passe du premier démarrage : make reset-db).")
print(f"POSTGRES_PASSWORD={postgres}")
print(f"JWT_SECRET={secret}")
print(f"ANON_KEY={token('anon')}")
print(f"SERVICE_ROLE_KEY={token('service_role')}")
print(f"PG_META_CRYPTO_KEY={base64.b64encode(os.urandom(24)).decode()}")
print(f"DASHBOARD_PASSWORD={base64.b64encode(os.urandom(18)).decode()}")
PY
