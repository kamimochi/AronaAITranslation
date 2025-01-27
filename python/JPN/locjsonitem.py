import json
import requests

# 定义 URLs
jp_url = 'https://schaledb.com/data/jp/items.json'
kr_url = 'https://schaledb.com/data/kr/items.json'

# 获取数据
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# 确保请求成功
jp_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
jp_data = jp_response.json()
kr_data = kr_response.json()

# 创建字典存储韩文到繁体中文的名称映射
name_mapping = {}

# 遍历韩文数据，使用相同的 ID 匹配繁体中文数据
for item_id, kr_item in kr_data.items():
    jp_item = jp_data.get(item_id)  # 获取繁体中文数据
    if jp_item:  # 如果繁体中文数据存在
        kr_name = kr_item.get("Name")
        jp_name = jp_item.get("Name")
        if kr_name and jp_name:  # 确保名称字段存在
            name_mapping[kr_name] = jp_name

# 将结果保存到 JSON 文件
output_file = 'item_name_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
