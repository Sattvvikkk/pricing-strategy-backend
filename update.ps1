$env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
& "C:\Program Files\Git\cmd\git.exe" add backend/routes/dashboard.py
& "C:\Program Files\Git\cmd\git.exe" commit -m "Fix dashboard to always show base_price (799) as current price"
& "C:\Program Files\Git\cmd\git.exe" push
