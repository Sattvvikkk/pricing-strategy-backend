import httpx, json, time, sys

start = time.time()
r = httpx.get("http://localhost:8000/api/strategy/vs-essential-cotton-tee", timeout=30)
elapsed = time.time() - start

print("Status:", r.status_code, f"({elapsed:.2f}s)")

if r.status_code == 200:
    d = r.json()
    print("archetype      :", d["archetype"])
    print("current_price  :", d["current_price"])
    print("recommended    :", d["recommended_price"])
    print("corridor       :", d["price_corridor"])
    print("confidence     :", d["confidence"])
    print("elasticity     :", d["elasticity"])
    print("rationale len  :", len(d["rationale"]), "chars")
    print("action_plan len:", len(d["action_plan"]), "days")
    print("triggers len   :", len(d["triggers"]), "rules")
    print("risk_flags     :", len(d["risk_flags"]), "flags")
    print("sim strategies :", list(d["simulation"]["summary"].keys()))
    print("expected_outcome:", d["expected_outcome"])
    print("comp_stats     :", d["competitor_stats"])
    print()
    print("--- First action plan day ---")
    print(json.dumps(d["action_plan"][0], indent=2))
    print()
    print("--- Last action plan day ---")
    print(json.dumps(d["action_plan"][-1], indent=2))
    print()
    print("--- First trigger ---")
    print(json.dumps(d["triggers"][0], indent=2))
    print()
    print("--- Rationale ---")
    print(d["rationale"])
else:
    print(r.text[:3000])
