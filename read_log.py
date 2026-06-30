import urllib.request
import gzip
import io

url = "https://storage.googleapis.com/eas-workflows-production/logs/42e0262f-af70-42de-b998-f5c39898298c/2534ab88-0f6e-4916-bac1-8dc6f7af3ec7/2026-06-25T21%3A14%3A12Z-7a9d0234-751f-4eca-ae7c-ba5caff86043.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260625%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260625T211543Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=0ab4c921feab56951bc92cbd983dbc0e4b69be0157ea20b9817447e5aa971d2f0d226e285e4712904450a7010e43520b4823f60b4a6251cabfac516a189f6304df81e1d659642d984ccd749950b0b18521353fe5046d52dedf89655ab434604f4357ce67295b77d11e66353a11688a2dd56f10d91f7e1695e340cf5eeea056277474fede810e7ea94d9fae68b6c14ab5c9282cf1c515b4b05d567786eceb1ba34d9e8c4e8e74d1f85d313cf99959ae599c47648fcd82022e0aba087494e2740b9699b0cb1d79b68f9fa19d93025ae43835fd784f5548465ef2ab36b8cf89f4b6d45c866afb8c42c60b138f27a93006fd45ac082d343ba00722d2cf1a9585e70a"

req = urllib.request.Request(url)
req.add_header('Accept-Encoding', 'gzip')
response = urllib.request.urlopen(req)

content = response.read()
print(f"Downloaded {len(content)} bytes")

# Check if response is gzipped
if response.info().get('Content-Encoding') == 'gzip' or content[:2] == b'\x1f\x8b':
    print("Content is gzipped. Decompressing...")
    try:
        content = gzip.decompress(content)
    except Exception as e:
        print("Gzip decompression failed, trying raw data...", e)

with open("d:\\debt\\eas-build-log-decompressed.txt", "wb") as f:
    f.write(content)
print("Saved decompressed logs.")
