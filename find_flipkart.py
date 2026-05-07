import urllib.request
import re

url = "https://www.flipkart.com/search?q=white+round+neck+t-shirt"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    pids = re.findall(r'/p/([a-z0-9]{16})', html)
    print("Found Flipkart IDs:", list(set(pids))[:5])
except Exception as e:
    print(e)
