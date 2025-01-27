import json
import requests

# 定义 URLs
tw_url = 'https://schaledb.com/data/tw/furniture.json'
kr_url = 'https://schaledb.com/data/kr/furniture.json'

# 获取数据
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# 确保请求成功
tw_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
tw_data = tw_response.json()
kr_data = kr_response.json()

# 创建字典存储韩文到繁体中文的名称映射
name_mapping = {}

# 遍历韩文数据，通过相同的 ID 匹配繁体中文数据
for item_id, kr_item in kr_data.items():
    tw_item = tw_data.get(item_id)  # 获取繁体中文数据
    if tw_item:  # 如果繁体中文数据存在
        kr_name = kr_item.get("Name")  # 韩文名称
        tw_name = tw_item.get("Name")  # 繁体中文名称
        if kr_name and tw_name:  # 确保名称字段存在
            name_mapping[kr_name] = tw_name

# 将结果保存到 JSON 文件
output_file = 'furniture_name_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
