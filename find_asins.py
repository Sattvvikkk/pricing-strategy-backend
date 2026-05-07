import urllib.request
import re

url = "https://www.amazon.in/s?k=white+round+neck+t-shirt"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    asins = re.findall(r'dp/([A-Z0-9]{10})', html)
    print("Found ASINs:", list(set(asins))[:5])
except Exception as e:
    print(e)
