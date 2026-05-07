$env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
& "C:\Program Files\GitHub CLI\gh.exe" repo create pricing-strategy-backend --public --source=. --push
