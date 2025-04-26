import requests
import json

url = "https://raw.githubusercontent.com/electricgoat/ba-data/refs/heads/jp/Excel/LocalizeCharProfileExcelTable.json"
response = requests.get(url)
data = response.json()

mapping = {}
for entry in data.get("DataList", []):
    kr = entry.get("StatusMessageKr", "").strip()
    Jp = entry.get("StatusMessageJp", "").strip()
    # 只在兩種語言都有內容時才加入
    if kr and Jp:
        mapping[kr] = Jp

with open("StatusMessage.json", "w", encoding="utf-8") as outfile:
    json.dump(mapping, outfile, ensure_ascii=False, indent=4)

print(f"Mapping 共包含 {len(mapping)} 筆對應")
