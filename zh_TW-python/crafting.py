import json
import requests

# 讀取 crafting.json 檔案
url = 'https://schaledb.com/data/crafting.json'
url_response = requests.get(url)
url_response.raise_for_status()
url_data = url_response.json()

result = {}
for node in url_data.get("Nodes", []):
    name_kr = node.get("NameKr", "")
    name_tw = node.get("NameTw", "")
    name_jp = node.get("NameJp", "")  # 預設為空字串

    # 當 NameJp 和 NameTw 一樣時，對應的 NameKr 設為空字串，否則保留 NameTw 的值
    if name_jp == name_tw:
        result[name_kr] = ""
    else:
        result[name_kr] = name_tw
        # 將 NameJp 的鍵對應空字串
        result[name_jp] = ""

    

# 加入 "/" : ""
result["/"] = ""

# 輸出為新的 JSON 檔案
output_path = 'crafting.json'
with open(output_path, 'w', encoding='utf-8') as output_file:
    json.dump(result, output_file, ensure_ascii=False, indent=4)

print(f"轉換完成！檔案已輸出至：{output_path}")
