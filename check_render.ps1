$headers = @{ "Authorization" = "Bearer rnd_89DY8teRxlWC00CRHlGkbarH1diX"; "Accept" = "application/json" }
$response = Invoke-RestMethod -Uri "https://api.render.com/v1/services/srv-d7oj934m0tmc738cq7f0/deploys" -Headers $headers
$response | Select-Object -ExpandProperty deploy | Select-Object status, commit | Format-Table
