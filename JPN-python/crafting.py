import json
import requests

# 讀取 crafting.json 檔案
url = 'https://schaledb.com/data/crafting.json'
url_response = requests.get(url)
url_response.raise_for_status()
url_data = url_response.json()
result = {}
for node in url_data.get("Nodes", []):
    name_kr = node.get("NameKr")  # 預設為空字串
    result[name_kr] =  ""  # 確保輸出空字串

result["/"] = ""

# 輸出為新的 JSON 檔案
output_path = 'crafting.json'
with open(output_path, 'w', encoding='utf-8') as output_file:
    json.dump(result, output_file, ensure_ascii=False, indent=4)

print(f"轉換完成！檔案已輸出至：{output_path}")
