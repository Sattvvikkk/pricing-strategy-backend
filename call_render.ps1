$headers = @{ "Authorization" = "Bearer rnd_89DY8teRxlWC00CRHlGkbarH1diX"; "Accept" = "application/json"; "Content-Type" = "application/json" }
$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Method Get -Headers $headers
$ownerId = $owners[0].owner.id

$payload = Get-Content render_payload.json | ConvertFrom-Json
$payload | Add-Member -Type NoteProperty -Name "ownerId" -Value $ownerId
$body = $payload | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
