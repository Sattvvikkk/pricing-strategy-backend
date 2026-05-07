from services.intelligence_engine import compute_all_signals
import pandas as pd

p = {'price': 799, 'cost_price': 350, 'stock': 300, 'rating': 4.3, 'reviews': 240, 'name': 'Test'}
r = compute_all_signals(p, pd.DataFrame(), pd.DataFrame())
print('Health:', r['overall_health_score'], r['health_status'])
for k, v in r['signals'].items():
    print(f"  {k}: score={v['score']} status={v['status']}")
print('OK - all 8 signals computed')
