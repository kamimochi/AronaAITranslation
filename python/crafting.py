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

    
    # 使用 NameKr 和 NameJp 組合作為鍵，NameTw 作為值
    key = f"{name_kr}"
    result[key] = name_tw
    
    result[name_jp] =  ""  # 確保輸出空字串


    


# 輸出為新的 JSON 檔案
output_path = 'crafting.json'
with open(output_path, 'w', encoding='utf-8') as output_file:
    json.dump(result, output_file, ensure_ascii=False, indent=4)

print(f"轉換完成！檔案已輸出至：{output_path}")
